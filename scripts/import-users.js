const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const usersFilePath = path.join(__dirname, "..", "data", "users.json");

function sanitizeUser(name) {
  return String(name || "").trim().slice(0, 30);
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function sanitizeRole(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function readUsers() {
  if (!fs.existsSync(usersFilePath)) {
    return [];
  }

  const raw = fs.readFileSync(usersFilePath, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeUsers(users) {
  fs.writeFileSync(usersFilePath, `${JSON.stringify(users, null, 2)}\n`, "utf-8");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const item = {};
    headers.forEach((header, idx) => {
      item[header] = values[idx] || "";
    });
    return item;
  });
}

function loadImportRecords(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");

  if (filePath.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON import must be an array of user records.");
    }
    return parsed;
  }

  if (filePath.toLowerCase().endsWith(".csv")) {
    return parseCsv(raw);
  }

  throw new Error("Unsupported file format. Use .json or .csv");
}

function normalizeImportRecord(item, existingByEmail) {
  const username = sanitizeUser(item.username);
  const email = sanitizeEmail(item.email);
  const role = sanitizeRole(item.role);
  const defaultColor = String(item.defaultColor || "#ff5d43").trim().slice(0, 20) || "#ff5d43";
  const password = String(item.password || "").trim();
  const passwordHashRaw = String(item.passwordHash || "").trim();

  if (!username) {
    throw new Error("Missing username.");
  }

  if (!email || !isEmailValid(email)) {
    throw new Error(`Invalid email: ${item.email || ""}`);
  }

  const existing = existingByEmail.get(email);
  let passwordHash = "";

  if (passwordHashRaw) {
    if (!passwordHashRaw.includes(":")) {
      throw new Error(`Invalid passwordHash format for ${email}`);
    }
    passwordHash = passwordHashRaw;
  } else if (password) {
    if (password.length < 6) {
      throw new Error(`Password is too short for ${email}`);
    }
    passwordHash = hashPassword(password);
  } else if (existing?.passwordHash) {
    passwordHash = existing.passwordHash;
  } else {
    throw new Error(`Missing password or passwordHash for ${email}`);
  }

  return {
    id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username,
    email,
    role,
    passwordHash,
    defaultColor,
    createdAt: existing?.createdAt || new Date().toISOString()
  };
}

function assertUniqueUsernames(users) {
  const usernameToEmail = new Map();

  users.forEach((user) => {
    const username = sanitizeUser(user.username);
    const email = sanitizeEmail(user.email);
    const key = username.toLowerCase();

    if (!username) {
      throw new Error(`Missing username for ${email || "unknown email"}`);
    }

    if (usernameToEmail.has(key) && usernameToEmail.get(key) !== email) {
      const existingEmail = usernameToEmail.get(key);
      throw new Error(`Duplicate username detected: ${username} (${existingEmail} and ${email})`);
    }

    usernameToEmail.set(key, email);
  });
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npm run users:import -- <path-to-users.json|csv>");
    process.exit(1);
  }

  const absoluteInputPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(absoluteInputPath)) {
    console.error(`Input file not found: ${absoluteInputPath}`);
    process.exit(1);
  }

  const importRecords = loadImportRecords(absoluteInputPath);
  const currentUsers = readUsers();
  const existingByEmail = new Map(currentUsers.map((user) => [sanitizeEmail(user.email), user]));
  const seenImportEmails = new Set();

  const normalized = importRecords.map((item) => {
    const email = sanitizeEmail(item.email);
    if (seenImportEmails.has(email)) {
      throw new Error(`Duplicate email in import file: ${email}`);
    }
    seenImportEmails.add(email);

    return normalizeImportRecord(item, existingByEmail);
  });

  const mergedByEmail = new Map(currentUsers.map((user) => [sanitizeEmail(user.email), user]));
  normalized.forEach((user) => {
    mergedByEmail.set(user.email, user);
  });

  const mergedUsers = Array.from(mergedByEmail.values());
  assertUniqueUsernames(mergedUsers);
  writeUsers(mergedUsers);

  console.log(`Imported ${normalized.length} users from ${absoluteInputPath}`);
  console.log(`Total users in data/users.json: ${mergedUsers.length}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
