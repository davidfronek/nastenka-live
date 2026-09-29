const fs = require("fs");
const path = require("path");
require("dotenv").config();
const storage = require("../postgres-storage");

const dataDir = path.join(__dirname, "..", "data");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${filePath}: ${error.message}`);
  }
}

function loadSnapshots() {
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  return fs
    .readdirSync(dataDir)
    .filter(
      (name) =>
        name === "board-snapshots.json" ||
        /^board-snapshots-\d{4}-\d{2}-\d{2}\.json$/.test(name),
    )
    .flatMap((name) => readJson(path.join(dataDir, name), []));
}

function loadActivityRuns() {
  const activityDir = path.join(dataDir, "activity");
  if (!fs.existsSync(activityDir)) {
    return [];
  }

  return fs
    .readdirSync(activityDir, { withFileTypes: true })
    .filter(
      (item) => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name),
    )
    .flatMap((item) => {
      const folder = path.join(activityDir, item.name);
      return fs
        .readdirSync(folder)
        .filter((name) => name.endsWith(".json"))
        .map((name) => {
          const filePath = path.join(folder, name);
          const entries = readJson(filePath, []);
          const startedAt =
            entries.at(-1)?.createdAt || `${item.name}T00:00:00.000Z`;
          const updatedAt = entries[0]?.createdAt || startedAt;
          return {
            id: path.basename(name, ".json"),
            startedAt,
            updatedAt,
            entries,
          };
        });
    });
}

async function main() {
  const users = readJson(path.join(dataDir, "users.json"), []);
  const snapshots = loadSnapshots();
  const activityRuns = loadActivityRuns();

  await storage.initializeStorage();
  await storage.saveUsers(users);
  for (const snapshot of snapshots) {
    await storage.saveSnapshot(snapshot);
  }
  for (const run of activityRuns) {
    await storage.saveActivityRun(run);
  }

  console.log(
    `Import dokončen: ${users.length} uživatelů, ${snapshots.length} snapshotů, ${activityRuns.length} běhů aktivit.`,
  );
}

main()
  .catch((error) => {
    console.error(`Import do PostgreSQL selhal: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => storage.close());
