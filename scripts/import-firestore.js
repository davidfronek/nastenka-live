const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const {
  isFirestoreEnabled,
  initializeFirestoreStorage,
  saveUsers,
  saveSnapshot,
  saveActivity
} = require("../firestore-storage");

const dataDir = path.join(__dirname, "..", "data");
const usersFilePath = path.join(dataDir, "users.json");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return parsed;
}

function getSnapshotFiles() {
  return fs.readdirSync(dataDir)
    .filter((name) => /^board-snapshots-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => path.join(dataDir, name));
}

async function main() {
  if (!isFirestoreEnabled()) {
    throw new Error("Nastav STORAGE_PROVIDER=firestore před spuštěním importu.");
  }

  const remote = await initializeFirestoreStorage();
  const users = readJson(usersFilePath, []);
  const snapshots = getSnapshotFiles().flatMap((filePath) => readJson(filePath, []));
  const activityFiles = [];
  const activityDir = path.join(dataDir, "activity");

  if (fs.existsSync(activityDir)) {
    fs.readdirSync(activityDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .forEach((item) => {
        const filePath = path.join(activityDir, item.name, "feed.json");
        if (fs.existsSync(filePath)) {
          activityFiles.push(filePath);
        }
      });
  }

  const activity = activityFiles.flatMap((filePath) => readJson(filePath, []));
  await saveUsers(users);
  await Promise.all(snapshots.map((snapshot) => saveSnapshot(snapshot)));
  await saveActivity(activity);

  console.log(`Import dokončen: ${users.length} uživatelů, ${snapshots.length} snapshotů, ${activity.length} aktivit.`);
  console.log(`Předchozí stav ve Firestore: ${remote.users.length} uživatelů, ${remote.snapshots.length} snapshotů, ${remote.activity.length} aktivit.`);
}

main().catch((error) => {
  console.error(`Import selhal: ${error.message}`);
  process.exitCode = 1;
});
