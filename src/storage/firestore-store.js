const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

class FirestoreStore {
  constructor(options) {
    this.db = createFirestore(options);
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
      createdAt: profile?.createdAt || new Date().toISOString(),
      lastKnownUsername: profile?.lastKnownUsername || username,
      openedPacks: profile?.openedPacks || 0,
      lastPackOpenedAt: profile?.lastPackOpenedAt || null,
      collection: profile?.collection || {},
      duplicates: profile?.duplicates || {},
      favorites: Array.isArray(profile?.favorites) ? profile.favorites : [],
      achievements: Array.isArray(profile?.achievements) ? profile.achievements : [],
      tradeHistory: Array.isArray(profile?.tradeHistory) ? profile.tradeHistory : []
    };
  }

  async getUser(userId, username = "Usuario") {
    const ref = this.db.collection("users").doc(userId);
    const snapshot = await ref.get();
    const profile = snapshot.exists ? this.normalizeProfile(snapshot.data(), username) : this.buildNewProfile(username);

    if (!snapshot.exists || profile.lastKnownUsername !== username) {
      profile.lastKnownUsername = username;
      await ref.set(profile, { merge: true });
    }

    return profile;
  }

  async saveUser(userId, profile) {
    const normalized = this.normalizeProfile(profile, profile.lastKnownUsername);
    await this.db.collection("users").doc(userId).set(normalized, { merge: true });
    return normalized;
  }

  async listUsers() {
    const snapshot = await this.db.collection("users").get();
    return snapshot.docs.map((doc) => ({
      userId: doc.id,
      profile: this.normalizeProfile(doc.data())
    }));
  }

  async getMeta() {
    const ref = this.db.collection("meta").doc("app");
    const snapshot = await ref.get();
    const meta = {
      nextTradeId: snapshot.exists && snapshot.data().nextTradeId ? snapshot.data().nextTradeId : 1
    };

    if (!snapshot.exists) {
      await ref.set(meta, { merge: true });
    }

    return meta;
  }

  async saveMeta(meta) {
    const normalized = {
      nextTradeId: meta?.nextTradeId || 1
    };
    await this.db.collection("meta").doc("app").set(normalized, { merge: true });
    return normalized;
  }

  async listTrades() {
    const snapshot = await this.db.collection("trades").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async saveTrade(trade) {
    await this.db.collection("trades").doc(trade.id).set(trade, { merge: true });
    return trade;
  }

  async findTradeById(tradeId) {
    const snapshot = await this.db.collection("trades").doc(tradeId).get();
    return snapshot.exists ? snapshot.data() : null;
  }
}

function createFirestore(options = {}) {
  if (!getApps().length) {
    const serviceAccountJson = options.serviceAccountJson || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountJson))
      });
    } else {
      initializeApp();
    }
  }

  return getFirestore();
}

module.exports = {
  FirestoreStore
};
