const nacl = require("tweetnacl");
const { MessageFlags } = require("discord.js");
const { AlbumService } = require("./game/album-service");
const {
  buildAchievementsView,
  buildAlbumView,
  buildCatalogView,
  buildCompareView,
  buildFavoritesView,
  buildHistoryView,
  buildPackEmbeds,
  buildProfileView,
  buildRankingView,
  buildSelectionView,
  buildTradeProposalView,
  buildTradeResultView,
  decodeOptional
} = require("./discord-ui");
const { createStore } = require("./storage");

const store = createStore();
const albumService = new AlbumService(store);

async function handleDiscordRequest(req, res) {
  const rawBody = await readRawBody(req);

  if (!verifyDiscordRequest(req, rawBody)) {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "invalid request signature" }));
    return;
  }

  const interaction = JSON.parse(rawBody || "{}");
  const response = await handleInteraction(interaction);

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(response));
}

async function handleInteraction(interaction) {
  if (interaction.type === 1) {
    return { type: 1 };
  }

  if (interaction.type === 2) {
    return handleApplicationCommand(interaction);
  }

  if (interaction.type === 3) {
    return handleMessageComponent(interaction);
  }

  return messageResponse("Interacao nao suportada.", true);
}

async function handleApplicationCommand(interaction) {
  const user = getInvoker(interaction);
  const options = normalizeOptions(interaction.data.options || []);

  switch (interaction.data.name) {
    case "ping":
      return messageResponse("Bot online.");
    case "iniciar":
      await albumService.ensureProfile(user.id, user.username);
      return messageResponse("Sua colecao foi criada. Use `/pacote` para abrir seu primeiro pacote.");
    case "pacote": {
      const packResult = await albumService.openPack(user.id, user.username);
      return richMessageResponse({
        embeds: buildPackEmbeds(packResult, "agora mesmo")
      });
    }
    case "album": {
      const pageData = await albumService.getAlbumPage(
        user.id,
        user.username,
        {
          country: getStringOption(options, "pais"),
          rarity: getStringOption(options, "raridade"),
          status: getStringOption(options, "status")
        },
        0
      );
      return richMessageResponse(buildAlbumView(user, pageData));
    }
    case "selecao": {
      const selectionData = await albumService.getSelectionPage(
        user.id,
        user.username,
        getStringOption(options, "pais", true),
        0
      );
      return richMessageResponse(buildSelectionView(user, selectionData));
    }
    case "repetidas": {
      const duplicates = await albumService.getDuplicates(user.id, user.username);

      if (!duplicates.length) {
        return messageResponse("Voce ainda nao tem figurinhas repetidas.");
      }

      return messageResponse(
        duplicates
          .slice(0, 10)
          .map(({ player, extraCount }, index) => `${index + 1}. ${player.name} (${player.country}) x${extraCount}`)
          .join("\n")
      );
    }
    case "catalogo": {
      const pageData = albumService.getCatalogPage(0, undefined, {
        country: getStringOption(options, "pais"),
        rarity: getStringOption(options, "raridade")
      });
      return richMessageResponse(buildCatalogView(pageData));
    }
    case "perfil": {
      const target = getUserOption(interaction, options, "usuario") || user;
      const profile = await albumService.getProfileSummary(target.id, target.username);
      return richMessageResponse(buildProfileView(target, profile));
    }
    case "ranking": {
      const ranking = await albumService.getRanking();
      return richMessageResponse(buildRankingView(ranking, (entryUserId) => {
        const entry = ranking.find((item) => item.userId === entryUserId);
        return entry?.username || `Usuario ${entryUserId}`;
      }));
    }
    case "conquistas":
      return richMessageResponse(buildAchievementsView(await albumService.getAchievements(user.id, user.username)));
    case "favorito": {
      const subcommand = getSubcommand(options);
      if (subcommand === "listar") {
        return richMessageResponse(buildFavoritesView(await albumService.getFavoritePlayers(user.id, user.username)));
      }

      const result = await albumService.toggleFavorite(user.id, user.username, getStringOption(options, "jogador", true));
      return messageResponse(
        `${result.player.name} ${result.isFavorite ? "foi marcado como favorito" : "foi removido dos favoritos"}.`
      );
    }
    case "comparar": {
      const target = getUserOption(interaction, options, "usuario", true);
      const comparison = await albumService.compareCollections(user.id, user.username, target.id, target.username);
      return richMessageResponse(buildCompareView(user, target, comparison));
    }
    case "trocar": {
      const target = getUserOption(interaction, options, "usuario", true);
      const trade = await albumService.createTrade(
        user.id,
        user.username,
        target.id,
        target.username,
        getStringOption(options, "oferecer", true),
        getStringOption(options, "receber", true)
      );

      return richMessageResponse(
        buildTradeProposalView(
          trade,
          user,
          target,
          albumService.getPlayerById(trade.offerPlayerId),
          albumService.getPlayerById(trade.requestPlayerId)
        )
      );
    }
    case "historico":
      return richMessageResponse(
        buildHistoryView(
          await albumService.getTradeHistory(user.id, user.username),
          (playerId) => albumService.getPlayerById(playerId),
          (userId) => resolveUsernameFromHistory(interaction, userId)
        )
      );
    default:
      return messageResponse("Comando nao implementado.");
  }
}

async function handleMessageComponent(interaction) {
  const user = getInvoker(interaction);
  const parts = interaction.data.custom_id.split("|");
  const [type, action] = parts;

  if (type === "nav") {
    return handleNavigation(interaction, user, action, parts.slice(2));
  }

  if (type === "trade") {
    return handleTradeAction(user, action, parts.slice(2));
  }

  return messageResponse("Acao desconhecida.", true);
}

async function handleNavigation(interaction, user, view, params) {
  const [ownerId, pageRaw, ...rest] = params;
  const page = Number(pageRaw) || 0;

  if (ownerId !== "public" && user.id !== ownerId) {
    return messageResponse("Somente quem abriu essa visualizacao pode trocar de pagina.", true);
  }

  if (view === "album") {
    const pageData = await albumService.getAlbumPage(
      ownerId,
      ownerId === user.id ? user.username : "Usuario",
      {
        country: decodeOptional(rest[0]),
        rarity: decodeOptional(rest[1]),
        status: decodeOptional(rest[2])
      },
      page
    );

    return updateMessageResponse(buildAlbumView(user, pageData));
  }

  if (view === "selection") {
    const selectionData = await albumService.getSelectionPage(
      ownerId,
      ownerId === user.id ? user.username : "Usuario",
      rest[0],
      page
    );

    return updateMessageResponse(buildSelectionView(user, selectionData));
  }

  if (view === "catalog") {
    const pageData = albumService.getCatalogPage(page, undefined, {
      country: decodeOptional(rest[0]),
      rarity: decodeOptional(rest[1])
    });

    return updateMessageResponse(buildCatalogView(pageData));
  }

  return messageResponse("Navegacao invalida.", true);
}

async function handleTradeAction(user, action, params) {
  const [tradeId, targetUserId] = params;

  if (user.id !== targetUserId) {
    return messageResponse("Somente o destinatario pode responder a esta troca.", true);
  }

  const accepted = action === "accept";
  const trade = await albumService.respondTrade(targetUserId, user.username, tradeId, accepted);
  return updateMessageResponse(
    buildTradeResultView(
      trade,
      albumService.getPlayerById(trade.offerPlayerId),
      albumService.getPlayerById(trade.requestPlayerId),
      accepted
    )
  );
}

function verifyDiscordRequest(req, rawBody) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return process.env.SKIP_DISCORD_SIGNATURE === "true";
  }

  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!signature || !timestamp) {
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

function getInvoker(interaction) {
  return interaction.member?.user || interaction.user;
}

function normalizeOptions(options) {
  return options.map((option) => ({
    ...option,
    options: normalizeOptions(option.options || [])
  }));
}

function getSubcommand(options) {
  const subcommand = options.find((option) => option.type === 1);
  return subcommand?.name || null;
}

function getNestedOptions(options) {
  const subcommand = options.find((option) => option.type === 1);
  return subcommand ? subcommand.options || [] : options;
}

function getStringOption(options, name, required = false) {
  const option = getNestedOptions(options).find((item) => item.name === name);
  if (!option && required) {
    throw new Error(`Opcao obrigatoria ausente: ${name}`);
  }
  return option?.value || null;
}

function getUserOption(interaction, options, name, required = false) {
  const option = getNestedOptions(options).find((item) => item.name === name);
  if (!option && required) {
    throw new Error(`Usuario obrigatorio ausente: ${name}`);
  }

  if (!option) {
    return null;
  }

  const resolvedUser = interaction.data.resolved?.users?.[option.value];
  return resolvedUser ? { id: resolvedUser.id, username: resolvedUser.username } : { id: option.value, username: `Usuario ${option.value}` };
}

function resolveUsernameFromHistory(interaction, userId) {
  const current = getInvoker(interaction);
  if (current.id === userId) {
    return current.username;
  }

  return interaction.data?.resolved?.users?.[userId]?.username || `Usuario ${userId}`;
}

function messageResponse(content, ephemeral = false) {
  return {
    type: 4,
    data: {
      content,
      ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {})
    }
  };
}

function richMessageResponse(payload) {
  return {
    type: 4,
    data: serializeMessagePayload(payload)
  };
}

function updateMessageResponse(payload) {
  return {
    type: 7,
    data: serializeMessagePayload(payload)
  };
}

function serializeMessagePayload(payload) {
  return {
    ...(payload.content ? { content: payload.content } : {}),
    ...(payload.flags ? { flags: payload.flags } : {}),
    ...(payload.embeds ? { embeds: payload.embeds.map((embed) => (typeof embed.toJSON === "function" ? embed.toJSON() : embed)) } : {}),
    ...(payload.components
      ? { components: payload.components.map((component) => (typeof component.toJSON === "function" ? component.toJSON() : component)) }
      : {})
  };
}

async function readRawBody(req) {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
    return JSON.stringify(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = {
  handleDiscordRequest
};
