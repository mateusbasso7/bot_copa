const path = require("node:path");
const { FirestoreStore } = require("./firestore-store");
const { JsonStore } = require("./json-store");

function createStore() {
  if (shouldUseFirestore()) {
    return new FirestoreStore({
      serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    });
  }

  return new JsonStore(path.resolve(__dirname, "../../data/users.json"));
}

function shouldUseFirestore() {
  return process.env.STORAGE_DRIVER === "firestore" || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

module.exports = {
  createStore,
  shouldUseFirestore
};
