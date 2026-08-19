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

  const [usersSnapshot, snapshotsSnapshot, activityRunsSnapshot] = await Promise.all([
    db.collection("nastenka/config/users").get(),
    db.collection("nastenka/snapshots/items").get(),
    db.collection("nastenka/activity/runs").orderBy("startedAt", "desc").get()
  ]);

  return {
    users: usersSnapshot.docs.map((item) => item.data()),
    snapshots: snapshotsSnapshot.docs.map((item) => item.data()).sort((a, b) => (
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )),
    activityRuns: activityRunsSnapshot.docs.map((item) => item.data())
  };
}

async function loadActivityRuns() {
  const db = assertEnabled();
  const snapshot = await db.collection("nastenka/activity/runs").orderBy("startedAt", "desc").get();
  return snapshot.docs.map((item) => item.data());
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

async function deleteSnapshots(ids) {
  const db = assertEnabled();
  const batch = db.batch();
  ids.forEach((id) => batch.delete(db.collection("nastenka/snapshots/items").doc(String(id))));
  if (ids.length > 0) {
    await batch.commit();
  }
}

async function clearBoardData() {
  const db = assertEnabled();
  const collections = [
    db.collection("nastenka/snapshots/items"),
    db.collection("nastenka/activity/runs")
  ];
  let deletedCount = 0;

  for (const collection of collections) {
    const snapshot = await collection.get();
    for (let index = 0; index < snapshot.docs.length; index += 500) {
      const batch = db.batch();
      snapshot.docs.slice(index, index + 500).forEach((item) => batch.delete(item.ref));
      await batch.commit();
      deletedCount += Math.min(500, snapshot.docs.length - index);
    }
  }

  return { deletedCount };
}

async function saveActivityRun(run) {
  const db = assertEnabled();
  await db.collection("nastenka/activity/runs").doc(String(run.id)).set(run);
}

module.exports = {
  isFirestoreEnabled,
  initializeFirestoreStorage,
  loadActivityRuns,
  loadUsers,
  saveUsers,
  saveSnapshot,
  deleteSnapshots,
  clearBoardData,
  saveActivityRun
};
