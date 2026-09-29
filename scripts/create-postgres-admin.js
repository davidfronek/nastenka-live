const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config();
const storage = require("../postgres-storage");

function fail(message) {
  throw new Error(message);
}

async function main() {
  const username = String(process.argv[2] || "")
    .trim()
    .slice(0, 30);
  const email = String(process.argv[3] || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const password = fs.readFileSync(0, "utf8").trim().slice(0, 120);

  if (!username) {
    fail("Zadej uživatelské jméno jako první argument.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("Zadej platný e-mail jako druhý argument.");
  }
  if (password.length < 6) {
    fail("Heslo načtené ze stdin musí mít alespoň 6 znaků.");
  }

  const users = await storage.loadUsers();
  const existing = users.find(
    (user) => String(user.email).toLowerCase() === email,
  );
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  const admin = {
    id: existing?.id || crypto.randomUUID(),
    username,
    email,
    role: "admin",
    passwordHash: `${salt}:${digest}`,
    defaultColor: existing?.defaultColor || "#ff5d43",
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  const nextUsers = existing
    ? users.map((user) => (user.id === existing.id ? admin : user))
    : [...users, admin];
  await storage.saveUsers(nextUsers);
  console.log(
    existing ? "Administrátor byl obnoven." : "Administrátor byl vytvořen.",
  );
}

main()
  .catch((error) => {
    console.error(`Vytvoření administrátora selhalo: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => storage.close());
