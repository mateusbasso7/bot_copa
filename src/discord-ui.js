const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const { ACHIEVEMENTS, PAGE_SIZE } = require("./game/album-service");

function formatRarity(rarity) {
  switch (rarity) {
    case "lendario":
      return "Lendario";
    case "epico":
      return "Epico";
    case "raro":
      return "Raro";
    default:
      return "Comum";
  }
}

function getRarityColor(rarity) {
  switch (rarity) {
    case "lendario":
      return 0xf1c40f;
    case "epico":
      return 0x9b59b6;
    case "raro":
      return 0x3498db;
    default:
      return 0x95a5a6;
  }
}

function getHighestRarityColor(players) {
  if (players.some((player) => player.rarity === "lendario")) {
    return getRarityColor("lendario");
  }

  if (players.some((player) => player.rarity === "epico")) {
    return getRarityColor("epico");
  }

  if (players.some((player) => player.rarity === "raro")) {
    return getRarityColor("raro");
  }

  return getRarityColor("comum");
}

function formatRemainingTime(remainingMs) {
  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

function encodeOptional(value) {
  return value || "-";
}

function decodeOptional(value) {
  return value === "-" ? null : value;
}

function buildPackEmbeds(packResult, cooldownText) {
  const summaryEmbed = new EmbedBuilder()
    .setTitle("Pacote aberto")
    .setDescription(`Voce abriu ${packResult.pulledPlayers.length} figurinhas.`)
    .setColor(getHighestRarityColor(packResult.pulledPlayers))
    .setFooter({ text: `Novo pacote em ${cooldownText}.` });

  if (packResult.unlockedAchievements.length) {
    summaryEmbed.addFields({
      name: "Conquistas desbloqueadas",
      value: packResult.unlockedAchievements.map((achievement) => `- ${achievement.name}`).join("\n")
    });
  }

  const playerEmbeds = packResult.pulledPlayers.map((player, index) =>
    new EmbedBuilder()
      .setTitle(`${index + 1}. ${player.name}`)
      .setColor(getRarityColor(player.rarity))
      .addFields(
        { name: "Selecao", value: player.country, inline: true },
        { name: "Posicao", value: player.position, inline: true },
        { name: "Raridade", value: formatRarity(player.rarity), inline: true },
        { name: "Status", value: player.isNew ? "Nova no album" : "Repetida", inline: true }
      )
  );

  return [summaryEmbed, ...playerEmbeds];
}

function buildAlbumView(user, pageData) {
  const description = pageData.items.length
    ? pageData.items
        .map((player) => {
          const owned = player.owned ? `[X] x${player.copies}` : "[ ] faltando";
          const favorite = player.favorite ? " | favorito" : "";
          return `${owned} ${player.name} | ${player.country} | ${player.position} | ${formatRarity(player.rarity)}${favorite}`;
        })
        .join("\n")
    : "Nenhum jogador encontrado com esses filtros.";

  const filterSummary = [
    pageData.filters.country ? `Pais: ${pageData.filters.country}` : null,
    pageData.filters.rarity ? `Raridade: ${formatRarity(pageData.filters.rarity)}` : null,
    pageData.filters.status ? `Status: ${pageData.filters.status}` : null
  ]
    .filter(Boolean)
    .join(" | ");

  const embed = new EmbedBuilder()
    .setTitle(`Album de ${user.username}`)
    .setDescription(description)
    .setColor(0x1abc9c)
    .setFooter({
      text: `Pagina ${pageData.page + 1}/${pageData.totalPages} | ${pageData.totalItems} resultados | ${PAGE_SIZE} por pagina`
    });

  if (filterSummary) {
    embed.addFields({ name: "Filtros", value: filterSummary });
  }

  return {
    embeds: [embed],
    components: buildNavComponents("album", user.id, pageData.page, pageData.totalPages, [
      encodeOptional(pageData.filters.country),
      encodeOptional(pageData.filters.rarity),
      encodeOptional(pageData.filters.status)
    ])
  };
}

function buildSelectionView(user, selectionData) {
  const description = selectionData.items
    .map((player) => {
      const owned = player.owned ? `[X] x${player.copies}` : "[ ] faltando";
      const favorite = player.favorite ? " | favorito" : "";
      return `${owned} ${player.name} | ${player.position} | ${formatRarity(player.rarity)}${favorite}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Selecao: ${selectionData.country}`)
    .setDescription(description)
    .setColor(0x2ecc71)
    .addFields(
      { name: "Progresso", value: `${selectionData.collected}/${selectionData.total}`, inline: true },
      { name: "Percentual", value: `${selectionData.completion}%`, inline: true },
      { name: "Faltam", value: String(selectionData.missing), inline: true }
    )
    .setFooter({ text: `Pagina ${selectionData.page + 1}/${selectionData.totalPages}` });

  return {
    embeds: [embed],
    components: buildNavComponents("selection", user.id, selectionData.page, selectionData.totalPages, [selectionData.country])
  };
}

function buildCatalogView(pageData) {
  const description = pageData.items
    .map((player) => `${player.name} | ${player.country} | ${player.position} | ${formatRarity(player.rarity)}`)
    .join("\n") || "Nenhum jogador encontrado.";

  const filterSummary = [
    pageData.filters.country ? `Pais: ${pageData.filters.country}` : null,
    pageData.filters.rarity ? `Raridade: ${formatRarity(pageData.filters.rarity)}` : null
  ]
    .filter(Boolean)
    .join(" | ");

  const embed = new EmbedBuilder()
    .setTitle("Catalogo da Copa 2026")
    .setDescription(description)
    .setColor(0xe67e22)
    .setFooter({ text: `Pagina ${pageData.page + 1}/${pageData.totalPages} | ${pageData.totalItems} jogadores` });

  if (filterSummary) {
    embed.addFields({ name: "Filtros", value: filterSummary });
  }

  return {
    embeds: [embed],
    components: buildNavComponents("catalog", "public", pageData.page, pageData.totalPages, [
      encodeOptional(pageData.filters.country),
      encodeOptional(pageData.filters.rarity)
    ])
  };
}

function buildProfileView(targetUser, profile) {
  const selections = profile.selectionProgress
    .map((item) => `${item.country}: ${item.completion}% (${item.collected}/${item.total})`)
    .join("\n");
  const favorites = profile.favorites.length
    ? profile.favorites.map((player) => `${player.name} (${player.country})`).join("\n")
    : "Nenhum favorito marcado.";
  const achievements = profile.achievements.length
    ? profile.achievements.map((achievement) => achievement.name).join(" | ")
    : "Nenhuma conquista ainda.";

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`Perfil de ${targetUser.username}`)
        .setColor(0x34495e)
        .addFields(
          { name: "Album", value: `${profile.collected}/${profile.total} (${profile.completion}%)`, inline: true },
          { name: "Pacotes", value: String(profile.openedPacks), inline: true },
          { name: "Lendarios", value: String(profile.legendaryCount), inline: true },
          { name: "Favoritos", value: favorites },
          { name: "Conquistas", value: achievements },
          { name: "Percentual por selecao", value: selections }
        )
    ]
  };
}

function buildRankingView(entries, resolveName) {
  const lines = entries.length
    ? entries
        .slice(0, 10)
        .map((entry, index) => {
          const name = resolveName(entry.userId);
          return `${index + 1}. ${name} | ${entry.completion}% | ${entry.collected}/${entry.total} | lendarios ${entry.legendaryCount}`;
        })
        .join("\n")
    : "Ninguem entrou no album ainda.";

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Ranking de Colecionadores")
        .setDescription(lines)
        .setColor(0xe74c3c)
    ]
  };
}

function buildAchievementsView(achievements) {
  const remaining = ACHIEVEMENTS.filter((achievement) => !achievements.some((item) => item.id === achievement.id));

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Conquistas")
        .setColor(0xf39c12)
        .addFields(
          {
            name: "Desbloqueadas",
            value: achievements.length
              ? achievements.map((achievement) => `${achievement.name}: ${achievement.description}`).join("\n")
              : "Nenhuma conquista desbloqueada ainda."
          },
          {
            name: "Proximas",
            value: remaining.length
              ? remaining.map((achievement) => `${achievement.name}: ${achievement.description}`).join("\n")
              : "Voce desbloqueou tudo."
          }
        )
    ]
  };
}

function buildFavoritesView(players) {
  const description = players.length
    ? players.map((player) => `${player.name} | ${player.country} | x${player.copies || 0}`).join("\n")
    : "Nenhum favorito marcado.";

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Favoritos")
        .setDescription(description)
        .setColor(0xff66a3)
    ]
  };
}

function buildCompareView(leftUser, rightUser, comparison) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`Comparativo: ${leftUser.username} x ${rightUser.username}`)
        .setColor(0x16a085)
        .addFields(
          { name: `${leftUser.username} exclusivo`, value: formatPlayerList(comparison.onlyLeft) },
          { name: `${rightUser.username} exclusivo`, value: formatPlayerList(comparison.onlyRight) },
          { name: "Em comum", value: formatPlayerList(comparison.both) },
          {
            name: "Resumo",
            value: `${leftUser.username}: ${comparison.leftCompletion}% | ${rightUser.username}: ${comparison.rightCompletion}%`
          }
        )
    ]
  };
}

function buildTradeProposalView(trade, fromUser, toUser, offerPlayer, requestPlayer) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Proposta de troca")
        .setColor(0x8e44ad)
        .setDescription(`${fromUser.username} quer trocar com ${toUser.username}`)
        .addFields(
          { name: "Oferece", value: `${offerPlayer.name} (${offerPlayer.country})` },
          { name: "Quer receber", value: `${requestPlayer.name} (${requestPlayer.country})` }
        )
        .setFooter({ text: `Trade #${trade.id}` })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade|accept|${trade.id}|${toUser.id}`)
          .setLabel("Aceitar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade|reject|${trade.id}|${toUser.id}`)
          .setLabel("Recusar")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function buildTradeResultView(trade, offerPlayer, requestPlayer, accepted) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(accepted ? "Troca aceita" : "Troca recusada")
        .setColor(accepted ? 0x27ae60 : 0xc0392b)
        .setDescription(
          `${offerPlayer.name} foi trocado por ${requestPlayer.name}. Status final: ${accepted ? "aceita" : "recusada"}.`
        )
        .setFooter({ text: `Trade #${trade.id}` })
    ],
    components: []
  };
}

function buildHistoryView(history, getPlayerById, resolveName) {
  const lines = history.length
    ? history
        .slice(0, 10)
        .map((entry) => {
          const offer = getPlayerById(entry.offerPlayerId);
          const request = getPlayerById(entry.requestPlayerId);
          const fromName = entry.fromUsername || resolveName(entry.fromUserId);
          const toName = entry.toUsername || resolveName(entry.toUserId);
          return `#${entry.tradeId} | ${entry.status} | ${fromName} -> ${toName} | ${offer?.name} x ${request?.name}`;
        })
        .join("\n")
    : "Nenhuma troca registrada.";

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Historico de trocas")
        .setDescription(lines)
        .setColor(0x7f8c8d)
    ]
  };
}

function buildNavRow(view, ownerId, page, totalPages, params) {
  const prevPage = Math.max(0, page - 1);
  const nextPage = Math.min(totalPages - 1, page + 1);

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`nav|${view}|${ownerId}|${prevPage}|${params.join("|")}`)
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`nav|${view}|${ownerId}|${nextPage}|${params.join("|")}`)
      .setLabel("Proxima")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1)
  );
}

function buildNavComponents(view, ownerId, page, totalPages, params) {
  if (totalPages <= 1) {
    return [];
  }

  return [buildNavRow(view, ownerId, page, totalPages, params)];
}

function formatPlayerList(players) {
  if (!players.length) {
    return "Nada aqui.";
  }

  return players.slice(0, 10).map((player) => `${player.name} (${player.country})`).join("\n");
}

module.exports = {
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
  decodeOptional,
  formatRarity,
  formatRemainingTime,
  getHighestRarityColor,
  getRarityColor
};
