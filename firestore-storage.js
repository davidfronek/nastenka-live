const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore: getFirestoreClient } = require("firebase-admin/firestore");

let firestore = null;

function isFirestoreEnabled() {
  return String(process.env.STORAGE_PROVIDER || "local").trim().toLowerCase() === "firestore";
}

function parseServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON není platný JSON: ${error.message}`);
  }
}

function getFirestore() {
  if (firestore) {
    return firestore;
  }

  if (!isFirestoreEnabled()) {
    return null;
  }

  const serviceAccount = parseServiceAccount();
  if (getApps().length === 0) {
    initializeApp(serviceAccount
      ? { credential: cert(serviceAccount) }
      : { credential: applicationDefault() });
  }

  firestore = getFirestoreClient();
  return firestore;
}

function assertEnabled() {
  const db = getFirestore();
  if (!db) {
    throw new Error("Firestore storage není zapnuté. Nastav STORAGE_PROVIDER=firestore.");
  }
  return db;
}

async function initializeFirestoreStorage() {
  const db = getFirestore();
  if (!db) {
    return null;
  }

  const [usersSnapshot, snapshotsSnapshot, activitySnapshot] = await Promise.all([
    db.collection("nastenka/config/users").get(),
    db.collection("nastenka/snapshots/items").orderBy("createdAt", "desc").get(),
    db.collection("nastenka/activity/items").orderBy("createdAt", "desc").limit(30).get()
  ]);

  return {
    users: usersSnapshot.docs.map((item) => item.data()),
    snapshots: snapshotsSnapshot.docs.map((item) => item.data()),
    activity: activitySnapshot.docs.map((item) => item.data())
  };
}

async function loadUsers() {
  const db = assertEnabled();
  const snapshot = await db.collection("nastenka/config/users").get();
  return snapshot.docs.map((item) => item.data());
}

async function saveUsers(users) {
  const db = assertEnabled();
  const batch = db.batch();
  const usersCollection = db.collection("nastenka/config/users");
  const existing = await usersCollection.get();
  const nextIds = new Set(users.map((user) => String(user.id)));

  existing.docs.forEach((item) => {
    if (!nextIds.has(item.id)) {
      batch.delete(item.ref);
    }
  });

  users.forEach((user) => {
    batch.set(usersCollection.doc(String(user.id)), user);
  });
  await batch.commit();
}

async function saveSnapshot(snapshot) {
  const db = assertEnabled();
  await db.collection("nastenka/snapshots/items").doc(String(snapshot.id)).set(snapshot);
}

async function saveActivity(activity) {
  const db = assertEnabled();
  const activityCollection = db.collection("nastenka/activity/items");
  const batch = db.batch();
  const entries = activity.slice(0, 30);
  const current = await activityCollection.get();
  const nextIds = new Set(entries.map((entry) => String(entry.id)));

  current.docs.forEach((item) => {
    if (!nextIds.has(item.id)) {
      batch.delete(item.ref);
    }
  });

  entries.forEach((entry) => {
    batch.set(activityCollection.doc(String(entry.id)), entry);
  });
  await batch.commit();
}

module.exports = {
  isFirestoreEnabled,
  initializeFirestoreStorage,
  loadUsers,
  saveUsers,
  saveSnapshot,
  saveActivity
};
