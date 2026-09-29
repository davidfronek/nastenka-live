const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let pool = null;
let schemaReady = null;

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("Pro PostgreSQL nastav DATABASE_URL.");
  }

  const sslMode = String(process.env.PGSSLMODE || "")
    .trim()
    .toLowerCase();
  pool = new Pool({
    connectionString,
    ssl: sslMode === "require" ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", (error) => {
    console.error(`PostgreSQL pool selhal: ${error.message}`);
  });
  return pool;
}

async function ensureSchema() {
  if (!schemaReady) {
    const schema = fs.readFileSync(
      path.join(__dirname, "database", "schema.sql"),
      "utf8",
    );
    schemaReady = getPool()
      .query(schema)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    defaultColor: row.default_color,
    createdAt: toIsoTimestamp(row.created_at, "created_at"),
  };
}

function toIsoTimestamp(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${fieldName} není platné datum.`);
  }
  return date.toISOString();
}

async function loadUsers() {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT * FROM app_users ORDER BY created_at, id",
  );
  return result.rows.map(mapUser);
}

async function loadSnapshots() {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT payload FROM board_snapshots ORDER BY created_at DESC",
  );
  return result.rows.map((row) => row.payload);
}

async function loadActivityRuns() {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT id, started_at, updated_at, entries FROM activity_runs ORDER BY started_at DESC",
  );
  return result.rows.map((row) => ({
    id: row.id,
    startedAt: toIsoTimestamp(row.started_at, "started_at"),
    updatedAt: toIsoTimestamp(row.updated_at, "updated_at"),
    entries: row.entries,
  }));
}

async function initializeStorage() {
  await ensureSchema();
  const [users, snapshots, activityRuns] = await Promise.all([
    loadUsers(),
    loadSnapshots(),
    loadActivityRuns(),
  ]);
  return { users, snapshots, activityRuns };
}

async function saveUsers(users) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const ids = users.map((user) => String(user.id));
    if (ids.length === 0) {
      await client.query("DELETE FROM app_users");
    } else {
      await client.query(
        "DELETE FROM app_users WHERE NOT (id = ANY($1::text[]))",
        [ids],
      );
    }
    for (const user of users) {
      await client.query(
        `INSERT INTO app_users (id, username, email, password_hash, role, default_color, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           default_color = EXCLUDED.default_color`,
        [
          String(user.id),
          String(user.username),
          String(user.email).toLowerCase(),
          String(user.passwordHash),
          String(user.role || "user"),
          String(user.defaultColor || "#ff5d43"),
          user.createdAt || new Date().toISOString(),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveSnapshot(snapshot) {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO board_snapshots (id, created_at, saved_by, kind, schema_version, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       created_at = EXCLUDED.created_at,
       saved_by = EXCLUDED.saved_by,
       kind = EXCLUDED.kind,
       schema_version = EXCLUDED.schema_version,
       payload = EXCLUDED.payload`,
    [
      String(snapshot.id),
      toIsoTimestamp(snapshot.createdAt, "snapshot.createdAt"),
      String(snapshot.savedBy || "Neznámý uživatel"),
      String(snapshot.kind || "manual"),
      Number(snapshot.schemaVersion || 1),
      JSON.stringify(snapshot),
    ],
  );
}

async function deleteSnapshots(ids) {
  await ensureSchema();
  if (ids.length > 0) {
    await getPool().query(
      "DELETE FROM board_snapshots WHERE id = ANY($1::text[])",
      [ids.map(String)],
    );
  }
}

async function saveActivityRun(run) {
  await ensureSchema();
  if (!Array.isArray(run.entries)) {
    throw new Error("activity run entries musí být pole.");
  }
  await getPool().query(
    `INSERT INTO activity_runs (id, started_at, updated_at, entries)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       started_at = EXCLUDED.started_at,
       updated_at = EXCLUDED.updated_at,
       entries = EXCLUDED.entries`,
    [
      String(run.id),
      toIsoTimestamp(run.startedAt, "activityRun.startedAt"),
      toIsoTimestamp(run.updatedAt, "activityRun.updatedAt"),
      JSON.stringify(run.entries),
    ],
  );
}

async function clearBoardData() {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT (SELECT count(*) FROM board_snapshots) + (SELECT count(*) FROM activity_runs) AS count",
    );
    await client.query("TRUNCATE board_snapshots, activity_runs");
    await client.query("COMMIT");
    return { deletedCount: Number(result.rows[0]?.count || 0) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}

module.exports = {
  label: "PostgreSQL",
  initializeStorage,
  loadActivityRuns,
  loadUsers,
  saveUsers,
  saveSnapshot,
  deleteSnapshots,
  clearBoardData,
  saveActivityRun,
  close,
};
