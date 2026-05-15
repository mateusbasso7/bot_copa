const players = require("../../data/players.json");

const PACK_SIZE = 5;
const PAGE_SIZE = 6;
const RARITY_WEIGHTS = {
  comum: 60,
  raro: 25,
  epico: 10,
  lendario: 5
};
const ACHIEVEMENTS = [
  { id: "first_pack", name: "Primeiro Pacote", description: "Abra seu primeiro pacote." },
  { id: "ten_cards", name: "Dez no Album", description: "Colete 10 jogadores unicos." },
  { id: "half_album", name: "Meio Caminho", description: "Complete 50% do album." },
  { id: "full_selection", name: "Selecao Fechada", description: "Complete uma selecao inteira." },
  { id: "legendary_pull", name: "Brilho Maximo", description: "Consiga um jogador lendario." },
  { id: "collector", name: "Colecionador", description: "Abra 10 pacotes." }
];

class AlbumService {
  constructor(store) {
    this.store = store;
    this.playerMap = new Map(players.map((player) => [player.id, player]));
  }

  async ensureProfile(userId, username = "Usuario") {
    return this.store.getUser(userId, username);
  }

  async openPack(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    const pulledPlayers = [];

    for (let index = 0; index < PACK_SIZE; index += 1) {
      const player = this.rollPlayer();
      const isNew = !profile.collection[player.id];

      profile.collection[player.id] = (profile.collection[player.id] || 0) + 1;
      pulledPlayers.push({ ...player, isNew });
    }

    profile.openedPacks += 1;
    profile.lastKnownUsername = username;
    profile.lastPackOpenedAt = new Date().toISOString();
    profile.duplicates = this.calculateDuplicates(profile.collection);

    const unlockedAchievements = this.refreshAchievements(profile, pulledPlayers);
    await this.store.saveUser(userId, profile);

    return {
      pulledPlayers,
      unlockedAchievements
    };
  }

  async getAlbumStatus(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    const collected = this.getCollectedCount(profile);
    const total = players.length;

    return {
      collected,
      total,
      completion: Math.floor((collected / total) * 100),
      openedPacks: profile.openedPacks,
      topCountries: this.buildCountryRanking(profile.collection),
      selectionProgress: await this.getSelectionProgress(userId, username)
    };
  }

  async getProfileSummary(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    const status = await this.getAlbumStatus(userId, username);
    const favorites = await this.getFavoritePlayers(userId, username);
    const legendaryCount = Object.keys(profile.collection).filter((playerId) => this.playerMap.get(playerId)?.rarity === "lendario").length;

    return {
      joinedAt: profile.createdAt,
      username: profile.lastKnownUsername,
      openedPacks: profile.openedPacks,
      completion: status.completion,
      collected: status.collected,
      total: status.total,
      favorites,
      achievements: await this.getAchievements(userId, username),
      selectionProgress: status.selectionProgress,
      duplicates: Object.keys(profile.duplicates).length,
      legendaryCount
    };
  }

  async getAlbumPage(userId, username, filters = {}, page = 0, pageSize = PAGE_SIZE) {
    const profile = await this.ensureProfile(userId, username);
    const filtered = players.filter((player) => {
      if (filters.country && player.country !== filters.country) {
        return false;
      }

      if (filters.rarity && player.rarity !== filters.rarity) {
        return false;
      }

      if (filters.status === "owned" && !profile.collection[player.id]) {
        return false;
      }

      if (filters.status === "missing" && profile.collection[player.id]) {
        return false;
      }

      if (filters.status === "favorite" && !profile.favorites.includes(player.id)) {
        return false;
      }

      return true;
    });

    return paginate(filtered, page, pageSize, (player) => ({
      ...player,
      owned: Boolean(profile.collection[player.id]),
      copies: profile.collection[player.id] || 0,
      favorite: profile.favorites.includes(player.id)
    }), filters);
  }

  async getSelectionPage(userId, username, country, page = 0, pageSize = PAGE_SIZE) {
    const profile = await this.ensureProfile(userId, username);
    const selectionPlayers = players.filter((player) => player.country === country);
    const pageData = paginate(selectionPlayers, page, pageSize, (player) => ({
      ...player,
      owned: Boolean(profile.collection[player.id]),
      copies: profile.collection[player.id] || 0,
      favorite: profile.favorites.includes(player.id)
    }));
    const collected = selectionPlayers.filter((player) => profile.collection[player.id]).length;

    return {
      ...pageData,
      country,
      total: selectionPlayers.length,
      collected,
      missing: selectionPlayers.length - collected,
      completion: selectionPlayers.length ? Math.floor((collected / selectionPlayers.length) * 100) : 0
    };
  }

  async getDuplicates(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    return Object.entries(profile.duplicates)
      .map(([playerId, extraCount]) => ({
        player: this.playerMap.get(playerId),
        extraCount
      }))
      .sort((left, right) => right.extraCount - left.extraCount);
  }

  getCatalogSummary() {
    return {
      totalPlayers: players.length,
      byCountry: players.reduce((accumulator, player) => {
        accumulator[player.country] = (accumulator[player.country] || 0) + 1;
        return accumulator;
      }, {}),
      byRarity: players.reduce((accumulator, player) => {
        accumulator[player.rarity] = (accumulator[player.rarity] || 0) + 1;
        return accumulator;
      }, {})
    };
  }

  getCatalogPage(page = 0, pageSize = PAGE_SIZE, filters = {}) {
    const filtered = players.filter((player) => {
      if (filters.country && player.country !== filters.country) {
        return false;
      }

      if (filters.rarity && player.rarity !== filters.rarity) {
        return false;
      }

      return true;
    });

    return paginate(filtered, page, pageSize, (player) => player, filters);
  }

  getCountries() {
    return [...new Set(players.map((player) => player.country))].sort((left, right) => left.localeCompare(right));
  }

  async toggleFavorite(userId, username, playerId) {
    const profile = await this.ensureProfile(userId, username);

    if (!this.playerMap.has(playerId)) {
      throw new Error("Jogador invalido.");
    }

    const hasFavorite = profile.favorites.includes(playerId);
    profile.favorites = hasFavorite
      ? profile.favorites.filter((favoriteId) => favoriteId !== playerId)
      : [...profile.favorites, playerId];

    await this.store.saveUser(userId, profile);

    return {
      player: this.playerMap.get(playerId),
      isFavorite: !hasFavorite
    };
  }

  async getFavoritePlayers(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    return profile.favorites
      .map((playerId) => this.playerMap.get(playerId))
      .filter(Boolean)
      .map((player) => ({
        ...player,
        copies: profile.collection[player.id] || 0
      }));
  }

  async getSelectionProgress(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    return this.getCountries().map((country) => {
      const selectionPlayers = players.filter((player) => player.country === country);
      const collected = selectionPlayers.filter((player) => profile.collection[player.id]).length;

      return {
        country,
        collected,
        total: selectionPlayers.length,
        completion: selectionPlayers.length ? Math.floor((collected / selectionPlayers.length) * 100) : 0
      };
    });
  }

  async getAchievements(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    const unlocked = this.refreshAchievements(profile);
    if (unlocked.length) {
      await this.store.saveUser(userId, profile);
    }
    return ACHIEVEMENTS.filter((achievement) => profile.achievements.includes(achievement.id));
  }

  async getRanking() {
    const users = await this.store.listUsers();
    return users
      .map(({ userId, profile }) => ({
        userId,
        username: profile.lastKnownUsername,
        collected: this.getCollectedCount(profile),
        total: players.length,
        completion: Math.floor((this.getCollectedCount(profile) / players.length) * 100),
        openedPacks: profile.openedPacks,
        legendaryCount: Object.keys(profile.collection).filter((playerId) => this.playerMap.get(playerId)?.rarity === "lendario").length,
        achievements: profile.achievements.length
      }))
      .sort((left, right) => {
        if (right.completion !== left.completion) {
          return right.completion - left.completion;
        }

        if (right.legendaryCount !== left.legendaryCount) {
          return right.legendaryCount - left.legendaryCount;
        }

        return right.openedPacks - left.openedPacks;
      });
  }

  async compareCollections(leftUserId, leftUsername, rightUserId, rightUsername) {
    const left = await this.ensureProfile(leftUserId, leftUsername);
    const right = await this.ensureProfile(rightUserId, rightUsername);
    const leftOwned = new Set(Object.keys(left.collection));
    const rightOwned = new Set(Object.keys(right.collection));

    return {
      onlyLeft: [...leftOwned].filter((playerId) => !rightOwned.has(playerId)).map((playerId) => this.playerMap.get(playerId)),
      onlyRight: [...rightOwned].filter((playerId) => !leftOwned.has(playerId)).map((playerId) => this.playerMap.get(playerId)),
      both: [...leftOwned].filter((playerId) => rightOwned.has(playerId)).map((playerId) => this.playerMap.get(playerId)),
      leftCompletion: Math.floor((leftOwned.size / players.length) * 100),
      rightCompletion: Math.floor((rightOwned.size / players.length) * 100)
    };
  }

  async createTrade(initiatorId, initiatorUsername, targetId, targetUsername, offerPlayerId, requestPlayerId) {
    const initiator = await this.ensureProfile(initiatorId, initiatorUsername);
    const target = await this.ensureProfile(targetId, targetUsername);
    const meta = await this.store.getMeta();

    if (initiatorId === targetId) {
      throw new Error("Nao da para trocar com voce mesmo.");
    }

    if (!this.playerMap.has(offerPlayerId) || !this.playerMap.has(requestPlayerId)) {
      throw new Error("Jogadores invalidos na troca.");
    }

    if ((initiator.collection[offerPlayerId] || 0) < 2) {
      throw new Error("Voce precisa ter a figurinha oferecida repetida para trocar.");
    }

    if ((target.collection[requestPlayerId] || 0) < 2) {
      throw new Error("O outro usuario precisa ter a figurinha pedida repetida para trocar.");
    }

    const trade = {
      id: String(meta.nextTradeId),
      fromUserId: initiatorId,
      fromUsername: initiator.lastKnownUsername,
      toUserId: targetId,
      toUsername: target.lastKnownUsername,
      offerPlayerId,
      requestPlayerId,
      createdAt: new Date().toISOString(),
      status: "pending"
    };

    meta.nextTradeId += 1;
    await this.store.saveMeta(meta);
    await this.store.saveTrade(trade);
    return trade;
  }

  async respondTrade(targetUserId, targetUsername, tradeId, accept) {
    const trade = await this.store.findTradeById(tradeId);

    if (!trade || trade.status !== "pending") {
      throw new Error("Troca nao encontrada ou ja resolvida.");
    }

    if (trade.toUserId !== targetUserId) {
      throw new Error("Somente o destinatario pode responder essa troca.");
    }

    const fromProfile = await this.ensureProfile(trade.fromUserId, trade.fromUsername);
    const toProfile = await this.ensureProfile(trade.toUserId, targetUsername);
    trade.toUsername = toProfile.lastKnownUsername;

    if (!accept) {
      trade.status = "rejected";
      trade.resolvedAt = new Date().toISOString();
      this.appendTradeHistory(fromProfile, toProfile, trade);
      await this.store.saveUser(trade.fromUserId, fromProfile);
      await this.store.saveUser(trade.toUserId, toProfile);
      await this.store.saveTrade(trade);
      return trade;
    }

    if ((fromProfile.collection[trade.offerPlayerId] || 0) < 2) {
      throw new Error("Quem ofereceu nao tem mais a repetida disponivel.");
    }

    if ((toProfile.collection[trade.requestPlayerId] || 0) < 2) {
      throw new Error("Quem recebeu nao tem mais a repetida pedida disponivel.");
    }

    this.removeCopy(fromProfile, trade.offerPlayerId);
    this.addCopy(toProfile, trade.offerPlayerId);
    this.removeCopy(toProfile, trade.requestPlayerId);
    this.addCopy(fromProfile, trade.requestPlayerId);

    trade.status = "accepted";
    trade.resolvedAt = new Date().toISOString();
    this.appendTradeHistory(fromProfile, toProfile, trade);

    await this.store.saveUser(trade.fromUserId, fromProfile);
    await this.store.saveUser(trade.toUserId, toProfile);
    await this.store.saveTrade(trade);
    return trade;
  }

  async getTradeHistory(userId, username) {
    const profile = await this.ensureProfile(userId, username);
    return [...profile.tradeHistory].sort((left, right) => new Date(right.at) - new Date(left.at));
  }

  getPlayerById(playerId) {
    return this.playerMap.get(playerId);
  }

  getPlayers() {
    return players;
  }

  rollPlayer() {
    const rarity = this.rollRarity();
    const pool = players.filter((player) => player.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  rollRarity() {
    const roll = Math.random() * 100;
    let current = 0;

    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
      current += weight;
      if (roll <= current) {
        return rarity;
      }
    }

    return "comum";
  }

  refreshAchievements(profile, pulledPlayers = []) {
    const before = new Set(profile.achievements);

    if (profile.openedPacks >= 1) {
      before.add("first_pack");
    }

    if (profile.openedPacks >= 10) {
      before.add("collector");
    }

    if (this.getCollectedCount(profile) >= 10) {
      before.add("ten_cards");
    }

    if (this.getCollectedCount(profile) >= Math.ceil(players.length / 2)) {
      before.add("half_album");
    }

    if (this.getCountries().some((country) => this.isSelectionComplete(profile, country))) {
      before.add("full_selection");
    }

    if (pulledPlayers.some((player) => player.rarity === "lendario") || this.hasCollectedRarity(profile, "lendario")) {
      before.add("legendary_pull");
    }

    const previousAchievements = new Set(profile.achievements);
    profile.achievements = [...before];

    return ACHIEVEMENTS.filter((achievement) => !previousAchievements.has(achievement.id) && profile.achievements.includes(achievement.id));
  }

  buildCountryRanking(collection) {
    const countryTotals = Object.entries(collection).reduce((accumulator, [playerId]) => {
      const player = this.playerMap.get(playerId);
      if (player) {
        accumulator[player.country] = (accumulator[player.country] || 0) + 1;
      }
      return accumulator;
    }, {});

    return Object.entries(countryTotals).sort((left, right) => right[1] - left[1]).slice(0, 3);
  }

  calculateDuplicates(collection) {
    return Object.entries(collection).reduce((accumulator, [playerId, copies]) => {
      if (copies > 1) {
        accumulator[playerId] = copies - 1;
      }
      return accumulator;
    }, {});
  }

  getCollectedCount(profile) {
    return Object.keys(profile.collection).filter((playerId) => profile.collection[playerId] > 0).length;
  }

  isSelectionComplete(profile, country) {
    return players.filter((player) => player.country === country).every((player) => profile.collection[player.id]);
  }

  hasCollectedRarity(profile, rarity) {
    return Object.keys(profile.collection).some((playerId) => this.playerMap.get(playerId)?.rarity === rarity);
  }

  removeCopy(profile, playerId) {
    profile.collection[playerId] -= 1;
    if (profile.collection[playerId] <= 0) {
      delete profile.collection[playerId];
      profile.favorites = profile.favorites.filter((favoriteId) => favoriteId !== playerId);
    }
    profile.duplicates = this.calculateDuplicates(profile.collection);
    this.refreshAchievements(profile);
  }

  addCopy(profile, playerId) {
    profile.collection[playerId] = (profile.collection[playerId] || 0) + 1;
    profile.duplicates = this.calculateDuplicates(profile.collection);
    this.refreshAchievements(profile);
  }

  appendTradeHistory(fromProfile, toProfile, trade) {
    const entry = {
      tradeId: trade.id,
      status: trade.status,
      offerPlayerId: trade.offerPlayerId,
      requestPlayerId: trade.requestPlayerId,
      fromUserId: trade.fromUserId,
      fromUsername: trade.fromUsername,
      toUserId: trade.toUserId,
      toUsername: trade.toUsername,
      at: trade.resolvedAt || new Date().toISOString()
    };

    fromProfile.tradeHistory = [entry, ...fromProfile.tradeHistory].slice(0, 20);
    toProfile.tradeHistory = [entry, ...toProfile.tradeHistory].slice(0, 20);
  }
}

function paginate(items, page, pageSize, mapper, filters = {}) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);

  return {
    items: items.slice(safePage * pageSize, safePage * pageSize + pageSize).map(mapper),
    page: safePage,
    totalPages,
    totalItems: items.length,
    filters
  };
}

module.exports = {
  ACHIEVEMENTS,
  AlbumService,
  PACK_SIZE,
  PAGE_SIZE,
  players
};
