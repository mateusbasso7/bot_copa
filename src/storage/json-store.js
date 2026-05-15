const fs = require("node:fs");
const path = require("node:path");

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "{}\n", "utf8");
    }
  }

  async readData() {
    this.ensureFile();
    const content = fs.readFileSync(this.filePath, "utf8");
    return content.trim() ? JSON.parse(content) : {};
  }

  async writeData(data) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  buildNewProfile(username = "Usuario") {
    return {
      createdAt: new Date().toISOString(),
      lastKnownUsername: username,
      openedPacks: 0,
      lastPackOpenedAt: null,
      collection: {},
      duplicates: {},
      favorites: [],
      achievements: [],
      tradeHistory: []
    };
  }

  normalizeProfile(profile, username = "Usuario") {
    return {
      createdAt: profile.createdAt || new Date().toISOString(),
      lastKnownUsername: profile.lastKnownUsername || username,
      openedPacks: profile.openedPacks || 0,
      lastPackOpenedAt: profile.lastPackOpenedAt || null,
      collection: profile.collection || {},
      duplicates: profile.duplicates || {},
      favorites: Array.isArray(profile.favorites) ? profile.favorites : [],
      achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
      tradeHistory: Array.isArray(profile.tradeHistory) ? profile.tradeHistory : []
    };
  }

  normalizeMeta(meta) {
    return {
      nextTradeId: meta?.nextTradeId || 1
    };
  }

  async getUser(userId, username = "Usuario") {
    const data = await this.readData();
    const profile = data[userId] ? this.normalizeProfile(data[userId], username) : this.buildNewProfile(username);
    if (!data[userId] || data[userId].lastKnownUsername !== profile.lastKnownUsername) {
      data[userId] = profile;
      await this.writeData(data);
    }
    return profile;
  }

  async saveUser(userId, profile) {
    const data = await this.readData();
    data[userId] = this.normalizeProfile(profile, profile.lastKnownUsername);
    await this.writeData(data);
    return data[userId];
  }

  async listUsers() {
    const data = await this.readData();
    return Object.entries(data)
      .filter(([key]) => key !== "__meta" && key !== "__trades")
      .map(([userId, profile]) => ({
        userId,
        profile: this.normalizeProfile(profile)
      }));
  }

  async getMeta() {
    const data = await this.readData();
    const meta = this.normalizeMeta(data.__meta);
    if (!data.__meta) {
      data.__meta = meta;
      await this.writeData(data);
    }
    return meta;
  }

  async saveMeta(meta) {
    const data = await this.readData();
    data.__meta = this.normalizeMeta(meta);
    await this.writeData(data);
    return data.__meta;
  }

  async listTrades() {
    const data = await this.readData();
    return Array.isArray(data.__trades) ? data.__trades : [];
  }

  async saveTrade(trade) {
    const data = await this.readData();
    const trades = Array.isArray(data.__trades) ? data.__trades : [];
    const index = trades.findIndex((item) => item.id === trade.id);

    if (index >= 0) {
      trades[index] = trade;
    } else {
      trades.unshift(trade);
    }

    data.__trades = trades;
    await this.writeData(data);
    return trade;
  }

  async findTradeById(tradeId) {
    const trades = await this.listTrades();
    return trades.find((trade) => trade.id === tradeId) || null;
  }
}

module.exports = {
  JsonStore
};
