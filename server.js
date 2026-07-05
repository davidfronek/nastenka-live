const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const usersBySocket = new Map();
const sessionsByToken = new Map();
const notes = [];
const boardTexts = [];

const activity = [];
const dataDir = path.join(__dirname, "data");
const activityDir = path.join(dataDir, "activity");
const legacySnapshotFilePath = path.join(dataDir, "board-snapshots.json");
const usersFilePath = path.join(dataDir, "users.json");
const ACTIVITY_LIMIT = 30;
const DONE_OVAL_BASE_CENTER_X = 2400;
const DONE_OVAL_CENTER_Y = 430;
const DONE_OVAL_RADIUS_X = 320;
const DONE_OVAL_RADIUS_Y = 220;
const DONE_OVAL_POINTS_PER_RING = 14;
const DONE_OVAL_RING_STEP_X = 170;
const DONE_OVAL_RING_STEP_Y = 130;
const DONE_ACTIVE_GAP_PX = 500;
const NOTE_WIDTH = 206;
const SELF_REGISTRATION_ENABLED = false;
const SESSION_TOKEN_BYTES = 24;

function nowTime() {
  return new Date().toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function nowDate() {
  return new Date().toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function addActivity(message) {
  activity.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    date: nowDate(),
    time: nowTime(),
    createdAt: new Date().toISOString()
  });
  if (activity.length > ACTIVITY_LIMIT) {
    activity.pop();
  }
  saveActivityLog();
  io.emit("activity:list", activity);
}

function sanitizeUser(name) {
  return String(name || "").trim().slice(0, 30);
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function sanitizePassword(value) {
  return String(value || "").trim().slice(0, 120);
}

function sanitizeRole(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

function sanitizeSessionToken(value) {
  const token = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{48}$/.test(token) ? token : "";
}

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText(value) {
  return String(value || "").trim().slice(0, 300);
}

function sanitizeColor(value) {
  const clean = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toLowerCase();
  }
  return null;
}

function textSnippet(value, maxLength = 48) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "(bez textu)";
  }
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1)}...`;
}

function formatPriorityLabel(value) {
  if (value === "Nizka") {
    return "nízká";
  }
  if (value === "Stredni") {
    return "střední";
  }
  if (value === "Vysoka") {
    return "vysoká";
  }
  return value;
}

function isAdmin(user) {
  return sanitizeRole(user?.role) === "admin";
}

function canManageNote(user, note) {
  if (!user || !note) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  const ownerIdentity = note.ownerId || note.ownerEmail || note.owner || note.from;
  const userIdentity = sanitizeEmail(user.email) || user.name;
  return ownerIdentity === userIdentity;
}

function canToggleNote(user, note) {
  if (!user || !note) {
    return false;
  }

  if (canManageNote(user, note)) {
    return true;
  }

  return sanitizeUser(note.to).toLowerCase() === sanitizeUser(user.name).toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, digest] = String(passwordHash || "").split(":");
  if (!salt || !digest) {
    return false;
  }

  try {
    const digestBuffer = Buffer.from(digest, "hex");
    if (!digestBuffer.length) {
      return false;
    }
    const testDigestBuffer = crypto.scryptSync(password, salt, digestBuffer.length);
    return crypto.timingSafeEqual(digestBuffer, testDigestBuffer);
  } catch {
    return false;
  }
}

function createSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

function createSessionForUser(userProfile) {
  const sessionToken = createSessionToken();
  sessionsByToken.set(sessionToken, {
    name: sanitizeUser(userProfile?.name),
    email: sanitizeEmail(userProfile?.email),
    role: sanitizeRole(userProfile?.role),
    color: String(userProfile?.color || "#ff5d43")
  });
  return sessionToken;
}

function getSessionUser(sessionToken) {
  return sessionsByToken.get(sanitizeSessionToken(sessionToken)) || null;
}

function bindSessionToSocket(socket, sessionToken) {
  const token = sanitizeSessionToken(sessionToken);
  const sessionUser = getSessionUser(token);
  if (!token || !sessionUser) {
    return null;
  }

  const user = {
    id: socket.id,
    ...sessionUser,
    sessionToken: token
  };

  usersBySocket.set(socket.id, user);
  return user;
}

function getDoneLanePosition(currentNoteId) {
  const doneWithoutCurrent = notes
    .filter((note) => note.done && note.id !== currentNoteId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const activeNotes = notes.filter((note) => !note.done);

  const index = doneWithoutCurrent.length;
  const ring = Math.floor(index / DONE_OVAL_POINTS_PER_RING);
  const slot = index % DONE_OVAL_POINTS_PER_RING;
  const angle = -Math.PI / 2 + (slot / DONE_OVAL_POINTS_PER_RING) * Math.PI * 2;
  const radiusX = DONE_OVAL_RADIUS_X + ring * DONE_OVAL_RING_STEP_X;
  const radiusY = DONE_OVAL_RADIUS_Y + ring * DONE_OVAL_RING_STEP_Y;
  const activeRightEdge =
    activeNotes.length > 0 ? Math.max(...activeNotes.map((note) => note.x + NOTE_WIDTH)) : 0;
  const minLeftEdgeForDone = activeRightEdge + DONE_ACTIVE_GAP_PX;
  const doneCenterX = Math.max(DONE_OVAL_BASE_CENTER_X, minLeftEdgeForDone + radiusX);

  return {
    x: Math.round(doneCenterX + Math.cos(angle) * radiusX),
    y: Math.round(DONE_OVAL_CENTER_Y + Math.sin(angle) * radiusY)
  };
}

function formatSnapshotDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSnapshotFilePath(date = new Date()) {
  return path.join(dataDir, `board-snapshots-${formatSnapshotDate(date)}.json`);
}

function getActivityFolderPath(date = new Date()) {
  return path.join(activityDir, formatSnapshotDate(date));
}

function getActivityFilePath(date = new Date()) {
  return path.join(getActivityFolderPath(date), "feed.json");
}

function ensureSnapshotFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf-8");
  }
}

function ensureActivityStorage(date = new Date()) {
  const dailyActivityDir = getActivityFolderPath(date);
  if (!fs.existsSync(dailyActivityDir)) {
    fs.mkdirSync(dailyActivityDir, { recursive: true });
  }

  const activityFilePath = getActivityFilePath(date);
  if (!fs.existsSync(activityFilePath)) {
    fs.writeFileSync(activityFilePath, "[]\n", "utf-8");
  }

  return activityFilePath;
}

function listActivityFilePaths() {
  if (!fs.existsSync(activityDir)) {
    return [];
  }

  return fs
    .readdirSync(activityDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name))
    .map((item) => item.name)
    .sort((a, b) => b.localeCompare(a))
    .map((dateFolder) => path.join(activityDir, dateFolder, "feed.json"))
    .filter((filePath) => fs.existsSync(filePath));
}

function listSnapshotFilePaths() {
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  const dailyFiles = fs
    .readdirSync(dataDir)
    .filter((name) => /^board-snapshots-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort((a, b) => b.localeCompare(a))
    .map((name) => path.join(dataDir, name));

  if (dailyFiles.length > 0) {
    return dailyFiles;
  }

  return fs.existsSync(legacySnapshotFilePath) ? [legacySnapshotFilePath] : [];
}

function ensureSnapshotStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  ensureSnapshotFile(getSnapshotFilePath());
  ensureActivityStorage();

  if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, "[]\n", "utf-8");
  }
}

function readSnapshots(filePath = getSnapshotFilePath()) {
  ensureSnapshotStorage();
  ensureSnapshotFile(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLatestSnapshot() {
  const files = listSnapshotFilePaths();
  for (const filePath of files) {
    const snapshots = readSnapshots(filePath);
    if (snapshots.length > 0) {
      return snapshots[0];
    }
  }
  return null;
}

function listSnapshotSummaries() {
  return listSnapshotFilePaths().flatMap((filePath) => {
    const fileName = path.basename(filePath);
    return readSnapshots(filePath).map((snapshot) => ({
      id: String(snapshot?.id || ""),
      createdAt: snapshot?.createdAt || null,
      savedBy: sanitizeUser(snapshot?.savedBy) || "Neznámý uživatel",
      noteCount: Array.isArray(snapshot?.notes) ? snapshot.notes.length : Number(snapshot?.noteCount || 0),
      textCount: Array.isArray(snapshot?.texts) ? snapshot.texts.length : Number(snapshot?.textCount || 0),
      fileName
    }));
  }).filter((snapshot) => snapshot.id);
}

function findSnapshotById(snapshotId) {
  const cleanId = String(snapshotId || "").trim();
  if (!cleanId) {
    return null;
  }

  for (const filePath of listSnapshotFilePaths()) {
    const snapshot = readSnapshots(filePath).find((item) => String(item?.id || "") === cleanId);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function restoreBoardFromSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  const snapshotNotes = Array.isArray(snapshot.notes) ? snapshot.notes : [];
  const snapshotTexts = Array.isArray(snapshot.texts) ? snapshot.texts : [];

  notes.length = 0;
  boardTexts.length = 0;

  snapshotNotes.forEach((item, index) => {
    const owner = sanitizeUser(item?.owner || item?.from);
    const from = sanitizeUser(item?.from || owner);
    const ownerEmail = sanitizeEmail(item?.ownerEmail);
    const ownerId = sanitizeEmail(item?.ownerId || ownerEmail) || owner || from;

    notes.push({
      id: String(item?.id || `${Date.now()}-restored-note-${index}`),
      text: sanitizeText(item?.text),
      owner,
      ownerEmail: ownerEmail || undefined,
      ownerId,
      from,
      to: sanitizeUser(item?.to) || owner || from,
      priority: ["Nizka", "Stredni", "Vysoka"].includes(item?.priority) ? item.priority : "Stredni",
      deadline: String(item?.deadline || "").slice(0, 10),
      done: Boolean(item?.done),
      color: sanitizeColor(item?.color) || "#ffe66e",
      x: Number.isFinite(item?.position?.x) ? item.position.x : 140,
      y: Number.isFinite(item?.position?.y) ? item.position.y : 120,
      returnX: Number.isFinite(item?.returnX) ? item.returnX : null,
      returnY: Number.isFinite(item?.returnY) ? item.returnY : null
    });
  });

  snapshotTexts.forEach((item, index) => {
    boardTexts.push({
      id: String(item?.id || `${Date.now()}-restored-text-${index}`),
      text: sanitizeText(item?.text),
      author: sanitizeUser(item?.author || item?.owner),
      owner: sanitizeUser(item?.owner || item?.author),
      x: Number.isFinite(item?.position?.x) ? item.position.x : 180,
      y: Number.isFinite(item?.position?.y) ? item.position.y : 120
    });
  });

  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    noteCount: notes.length,
    textCount: boardTexts.length
  };
}

function readActivityEntries(filePath = getActivityFilePath()) {
  ensureSnapshotStorage();
  ensureActivityStorage();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLatestActivityEntries() {
  const files = listActivityFilePaths();
  for (const filePath of files) {
    const entries = readActivityEntries(filePath);
    if (entries.length > 0) {
      return entries.slice(0, ACTIVITY_LIMIT);
    }
  }
  return [];
}

function saveActivityLog() {
  const activityFilePath = ensureActivityStorage();
  fs.writeFileSync(activityFilePath, `${JSON.stringify(activity, null, 2)}\n`, "utf-8");
}

function readRegisteredUsers() {
  ensureSnapshotStorage();
  try {
    const raw = fs.readFileSync(usersFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRegisteredUsers(users) {
  ensureSnapshotStorage();
  fs.writeFileSync(usersFilePath, `${JSON.stringify(users, null, 2)}\n`, "utf-8");
}

function saveBoardSnapshot(savedBy) {
  const snapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    savedBy,
    noteCount: notes.length,
    textCount: boardTexts.length,
    notes: notes.map((note) => ({
      id: note.id,
      text: note.text,
      owner: note.owner,
      ownerEmail: note.ownerEmail || null,
      ownerId: note.ownerId || null,
      from: note.from,
      to: note.to,
      priority: note.priority,
      deadline: note.deadline,
      done: note.done,
      color: note.color,
      returnX: Number.isFinite(note.returnX) ? note.returnX : null,
      returnY: Number.isFinite(note.returnY) ? note.returnY : null,
      position: {
        x: note.x,
        y: note.y
      }
    })),
    texts: boardTexts.map((item) => ({
      id: item.id,
      text: item.text,
      author: item.author,
      owner: item.owner,
      position: {
        x: item.x,
        y: item.y
      }
    }))
  };

  const dailySnapshotFilePath = getSnapshotFilePath();
  const allSnapshots = readSnapshots(dailySnapshotFilePath);
  allSnapshots.unshift(snapshot);

  fs.writeFileSync(dailySnapshotFilePath, `${JSON.stringify(allSnapshots, null, 2)}\n`, "utf-8");
  return snapshot;
}

function restoreBoardFromLatestSnapshot() {
  const latestSnapshot = readLatestSnapshot();
  if (!latestSnapshot) {
    return null;
  }
  return restoreBoardFromSnapshot(latestSnapshot);
}

app.use(express.json());

function emitUsers() {
  const onlineUsers = Array.from(usersBySocket.values()).map((user) => ({
    id: user.id,
    name: user.name,
    color: user.color,
    role: sanitizeRole(user.role)
  }));
  io.emit("users:list", onlineUsers);
}

io.on("connection", (socket) => {
  socket.emit("board:init", {
    notes,
    texts: boardTexts,
    activity
  });

  socket.on("auth:register", ({ username, email, password }) => {
    if (!SELF_REGISTRATION_ENABLED) {
      socket.emit("auth:error", "Registrace je vypnutá. Požádej administrátora o vytvoření účtu.");
      return;
    }

    const cleanUsername = sanitizeUser(username);
    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = sanitizePassword(password);

    if (!cleanUsername) {
      socket.emit("auth:error", "Zadej uživatelské jméno.");
      return;
    }

    if (!cleanEmail || !isEmailValid(cleanEmail)) {
      socket.emit("auth:error", "Zadej platný e-mail.");
      return;
    }

    if (cleanPassword.length < 6) {
      socket.emit("auth:error", "Heslo musí mít alespoň 6 znaků.");
      return;
    }

    const users = readRegisteredUsers();
    const usernameTaken = users.some(
      (item) => sanitizeUser(item.username).toLowerCase() === cleanUsername.toLowerCase()
    );
    if (usernameTaken) {
      socket.emit("auth:error", "Toto uživatelské jméno už existuje.");
      return;
    }

    const emailTaken = users.some((item) => sanitizeEmail(item.email) === cleanEmail);
    if (emailTaken) {
      socket.emit("auth:error", "Tento e-mail už je registrovaný.");
      return;
    }

    const registeredUser = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: cleanUsername,
      email: cleanEmail,
      role: "user",
      passwordHash: hashPassword(cleanPassword),
      defaultColor: "#ff5d43",
      createdAt: new Date().toISOString()
    };

    users.push(registeredUser);
    saveRegisteredUsers(users);

    const baseUser = {
      name: registeredUser.username,
      email: registeredUser.email,
      role: sanitizeRole(registeredUser.role),
      color: String(registeredUser.defaultColor || "#ff5d43")
    };

    const sessionToken = createSessionForUser(baseUser);
    const user = bindSessionToSocket(socket, sessionToken);
    if (!user) {
      socket.emit("auth:error", "Obnovení relace se nepodařilo. Zkus to znovu.");
      return;
    }

    socket.emit("auth:ok", user);

    emitUsers();
    addActivity(`${user.name} dokončil/a registraci a připojil/a se do nástěnky (online: ${usersBySocket.size})`);
  });

  socket.on("auth:login", ({ email, password }) => {
    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = sanitizePassword(password);

    if (!cleanEmail || !cleanPassword) {
      socket.emit("auth:error", "Vyplň e-mail a heslo.");
      return;
    }

    const users = readRegisteredUsers();
    const registeredUser = users.find((item) => sanitizeEmail(item.email) === cleanEmail);

    if (!registeredUser || !verifyPassword(cleanPassword, registeredUser.passwordHash)) {
      socket.emit("auth:error", "Neplatné přihlašovací údaje.");
      return;
    }

    const baseUser = {
      name: registeredUser.username,
      email: sanitizeEmail(registeredUser.email),
      role: sanitizeRole(registeredUser.role),
      color: String(registeredUser.defaultColor || "#ff5d43")
    };

    const sessionToken = createSessionForUser(baseUser);
    const user = bindSessionToSocket(socket, sessionToken);
    if (!user) {
      socket.emit("auth:error", "Obnovení relace se nepodařilo. Zkus to znovu.");
      return;
    }

    socket.emit("auth:ok", user);

    emitUsers();
    addActivity(`${user.name} se připojil/a do nástěnky (online: ${usersBySocket.size})`);
  });

  socket.on("auth:resume", ({ sessionToken }) => {
    const user = bindSessionToSocket(socket, sessionToken);
    if (!user) {
      socket.emit("auth:required");
      return;
    }

    socket.emit("auth:ok", user);
    emitUsers();
  });

  socket.on("auth:logout", () => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      return;
    }

    const token = sanitizeSessionToken(user.sessionToken);
    if (token) {
      sessionsByToken.delete(token);
    }

    usersBySocket.delete(socket.id);
    emitUsers();
    addActivity(`${user.name} se odhlásil/a (online: ${usersBySocket.size})`);
  });

  socket.on("note:create", (payload) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      return;
    }

    const note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: sanitizeText(payload?.text),
      owner: user.name,
      ownerEmail: sanitizeEmail(user.email),
      ownerId: sanitizeEmail(user.email),
      from: user.name,
      to: sanitizeUser(payload?.to) || user.name,
      priority: ["Nizka", "Stredni", "Vysoka"].includes(payload?.priority)
        ? payload.priority
        : "Stredni",
      deadline: String(payload?.deadline || "").slice(0, 10),
      color: sanitizeColor(payload?.color) || "#ffe66e",
      x: Number.isFinite(payload?.x) ? payload.x : 140,
      y: Number.isFinite(payload?.y) ? payload.y : 120,
      returnX: null,
      returnY: null,
      done: false
    };

    if (!note.text) {
      return;
    }

    notes.push(note);
    io.emit("note:created", note);
    addActivity(
      `${note.from} vytvořil/a lístek pro ${note.to}: "${textSnippet(note.text)}" | priorita ${formatPriorityLabel(note.priority)}${
        note.deadline ? ` | termín ${note.deadline}` : ""
      }`
    );
  });

  socket.on("text:create", (payload) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      return;
    }

    const textItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: sanitizeText(payload?.text),
      author: user.name,
      owner: user.name,
      ownerEmail: sanitizeEmail(user.email),
      ownerId: sanitizeEmail(user.email),
      x: Number.isFinite(payload?.x) ? payload.x : 180,
      y: Number.isFinite(payload?.y) ? payload.y : 120
    };

    if (!textItem.text) {
      return;
    }

    boardTexts.push(textItem);
    io.emit("text:created", textItem);
    addActivity(`${user.name} přidal/a text na plochu: "${textSnippet(textItem.text)}"`);
  });

  socket.on("note:move", ({ id, x, y }) => {
    const user = usersBySocket.get(socket.id);
    const note = notes.find((item) => item.id === id);
    if (!note || !user) {
      return;
    }

    if (note.done) {
      return;
    }

    note.x = Number.isFinite(x) ? x : note.x;
    note.y = Number.isFinite(y) ? y : note.y;

    socket.broadcast.emit("note:moved", { id: note.id, x: note.x, y: note.y });
  });

  socket.on("text:move", ({ id, x, y }) => {
    const textItem = boardTexts.find((item) => item.id === id);
    if (!textItem) {
      return;
    }

    textItem.x = Number.isFinite(x) ? x : textItem.x;
    textItem.y = Number.isFinite(y) ? y : textItem.y;

    socket.broadcast.emit("text:moved", { id: textItem.id, x: textItem.x, y: textItem.y });
  });

  socket.on("text:delete", ({ id }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const textIndex = boardTexts.findIndex((item) => item.id === String(id || ""));
    if (textIndex === -1) {
      ack?.({ ok: false, message: "Text už neexistuje." });
      return;
    }

    const textItem = boardTexts[textIndex];
    const textOwner = textItem.ownerId || textItem.ownerEmail || textItem.owner || textItem.author;
    const canDeleteText = isAdmin(user) || textOwner === (sanitizeEmail(user.email) || user.name);
    if (!canDeleteText) {
      ack?.({ ok: false, message: "Tento text může smazat jen jeho autor nebo admin." });
      return;
    }

    const [removedText] = boardTexts.splice(textIndex, 1);
    io.emit("text:deleted", { id: removedText.id });
    addActivity(`${user.name} smazal/a text z plochy: "${textSnippet(removedText.text)}"`);
    ack?.({ ok: true, id: removedText.id });
  });

  socket.on("note:toggle", ({ id }, ack) => {
    const note = notes.find((item) => item.id === id);
    const user = usersBySocket.get(socket.id);
    if (!note || !user) {
      ack?.({ ok: false, message: "Lístek nebyl nalezen nebo nejsi přihlášen." });
      return;
    }

    if (!canToggleNote(user, note)) {
      ack?.({ ok: false, message: "Tento lístek může měnit jen autor, admin nebo přiřazený uživatel." });
      return;
    }

    note.done = !note.done;
    let moved = false;

    if (note.done) {
      note.returnX = note.x;
      note.returnY = note.y;
      const lanePosition = getDoneLanePosition(note.id);
      note.x = lanePosition.x;
      note.y = lanePosition.y;
      moved = true;
    } else if (Number.isFinite(note.returnX) && Number.isFinite(note.returnY)) {
      note.x = note.returnX;
      note.y = note.returnY;
      moved = true;
      note.returnX = null;
      note.returnY = null;
    }

    io.emit("note:toggled", { id: note.id, done: note.done, x: note.x, y: note.y, moved });
    addActivity(
      `${user.name} nastavil/a stav lístku "${textSnippet(note.text, 36)}" pro ${note.to}: ${note.done ? "Hotovo" : "Aktivní"}${
        moved ? " | přesun do hotových" : ""
      }`
    );
    ack?.({ ok: true, id: note.id, done: note.done });
  });

  socket.on("note:update", (payload, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const note = notes.find((item) => item.id === String(payload?.id || ""));
    if (!note) {
      ack?.({ ok: false, message: "Lístek už neexistuje." });
      return;
    }

    if (!canManageNote(user, note)) {
      ack?.({ ok: false, message: "Tento lístek může upravit jen autor nebo admin." });
      return;
    }

    const text = sanitizeText(payload?.text);
    if (!text) {
      ack?.({ ok: false, message: "Doplň text lístku." });
      return;
    }

    note.text = text;
    note.to = sanitizeUser(payload?.to) || note.to;
    note.priority = ["Nizka", "Stredni", "Vysoka"].includes(payload?.priority)
      ? payload.priority
      : note.priority;
    note.deadline = String(payload?.deadline || "").slice(0, 10);
    note.color = sanitizeColor(payload?.color) || note.color;

    io.emit("note:updated", note);
    addActivity(
      `${user.name} upravil/a lístek pro ${note.to}: "${textSnippet(note.text)}" | priorita ${formatPriorityLabel(note.priority)}${
        note.deadline ? ` | termín ${note.deadline}` : ""
      }`
    );
    ack?.({ ok: true, note });
  });

  socket.on("note:delete", ({ id }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const noteIndex = notes.findIndex((item) => item.id === String(id || ""));
    if (noteIndex === -1) {
      ack?.({ ok: false, message: "Lístek už neexistuje." });
      return;
    }

    const note = notes[noteIndex];
    if (!canManageNote(user, note)) {
      ack?.({ ok: false, message: "Tento lístek může smazat jen jeho autor nebo admin." });
      return;
    }

    const [removed] = notes.splice(noteIndex, 1);
    io.emit("note:deleted", { id: removed.id });
    addActivity(`${user.name} smazal/a lístek pro ${removed.to}: "${textSnippet(removed.text)}"`);
    ack?.({ ok: true, id: removed.id });
  });

  socket.on("note:deleteMany", ({ ids }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const uniqueIds = Array.isArray(ids)
      ? Array.from(new Set(ids.map((id) => String(id || "")).filter(Boolean)))
      : [];

    if (uniqueIds.length === 0) {
      ack?.({ ok: false, message: "Nejsou vybrané žádné lístky." });
      return;
    }

    let removedCount = 0;
    let deniedCount = 0;

    uniqueIds.forEach((id) => {
      const noteIndex = notes.findIndex((item) => item.id === id);
      if (noteIndex === -1) {
        return;
      }

      const note = notes[noteIndex];
      if (!canManageNote(user, note)) {
        deniedCount += 1;
        return;
      }

      const [removed] = notes.splice(noteIndex, 1);
      removedCount += 1;
      io.emit("note:deleted", { id: removed.id });
    });

    if (removedCount > 0) {
      addActivity(`${user.name} hromadně smazal/a vybrané lístky (${removedCount})`);
    }

    ack?.({ ok: true, removedCount, deniedCount });
  });

  socket.on("note:markManyDone", ({ ids }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const uniqueIds = Array.isArray(ids)
      ? Array.from(new Set(ids.map((id) => String(id || "")).filter(Boolean)))
      : [];

    if (uniqueIds.length === 0) {
      ack?.({ ok: false, message: "Nejsou vybrané žádné lístky." });
      return;
    }

    let updatedCount = 0;
    let deniedCount = 0;
    let alreadyDoneCount = 0;

    uniqueIds.forEach((id) => {
      const note = notes.find((item) => item.id === id);
      if (!note) {
        return;
      }

      if (!canToggleNote(user, note)) {
        deniedCount += 1;
        return;
      }

      if (note.done) {
        alreadyDoneCount += 1;
        return;
      }

      note.done = true;
      note.returnX = note.x;
      note.returnY = note.y;
      const lanePosition = getDoneLanePosition(note.id);
      note.x = lanePosition.x;
      note.y = lanePosition.y;
      updatedCount += 1;

      io.emit("note:toggled", { id: note.id, done: true, x: note.x, y: note.y, moved: true });
    });

    if (updatedCount > 0) {
      addActivity(`${user.name} hromadně označil/a lístky jako hotové (${updatedCount})`);
    }

    ack?.({ ok: true, updatedCount, deniedCount, alreadyDoneCount });
  });

  socket.on("note:deleteAll", (_payload, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const removable = isAdmin(user)
      ? notes
      : notes.filter((item) => canManageNote(user, item));
    const removedCount = removable.length;
    if (removedCount === 0) {
      ack?.({ ok: true, removedCount: 0 });
      return;
    }

    for (let index = notes.length - 1; index >= 0; index -= 1) {
      const note = notes[index];
      if (isAdmin(user) || canManageNote(user, note)) {
        notes.splice(index, 1);
      }
    }
    io.emit("notes:cleared", { removedCount });
    addActivity(
      isAdmin(user)
        ? `${user.name} (admin) smazal/a lístky na nástěnce (${removedCount})`
        : `${user.name} smazal/a své lístky (${removedCount})`
    );
    ack?.({ ok: true, removedCount });
  });

  socket.on("session:saveSnapshot", () => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      socket.emit("session:error", "Nejdříve se přihlas.");
      return;
    }

    const snapshot = saveBoardSnapshot(user.name);
    socket.emit("session:saved", {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      noteCount: snapshot.noteCount
    });
    addActivity(`${user.name} uložil/a snapshot (${snapshot.noteCount} lístků, ${snapshot.textCount} textů)`);
  });

  socket.on("snapshot:restore", ({ id }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const snapshot = findSnapshotById(id);
    if (!snapshot) {
      ack?.({ ok: false, message: "Vybraný snapshot se nepodařilo najít." });
      return;
    }

    const restored = restoreBoardFromSnapshot(snapshot);
    if (!restored) {
      ack?.({ ok: false, message: "Snapshot se nepodařilo obnovit." });
      return;
    }

    io.emit("board:init", {
      notes,
      texts: boardTexts,
      activity
    });
    addActivity(`${user.name} obnovil/a snapshot z ${snapshot.createdAt || "neznámého data"} (${restored.noteCount} lístků, ${restored.textCount} textů)`);
    ack?.({ ok: true, ...restored });
  });

  socket.on("disconnect", () => {
    const user = usersBySocket.get(socket.id);
    if (user) {
      usersBySocket.delete(socket.id);
      emitUsers();
      addActivity(`${user.name} se odpojil/a (online: ${usersBySocket.size})`);
    }
  });
});

app.use(express.static(path.join(__dirname)));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/snapshots/save", (req, res) => {
  const savedBy = sanitizeUser(req.body?.savedBy) || "Neznámý uživatel";
  const snapshot = saveBoardSnapshot(savedBy);
  addActivity(`${savedBy} uložil/a snapshot (${snapshot.noteCount} lístků, ${snapshot.textCount} textů)`);
  res.json({
    ok: true,
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    noteCount: snapshot.noteCount
  });
});

app.get("/api/users", (_req, res) => {
  const users = readRegisteredUsers().map((item) => ({
    id: item.id,
    username: sanitizeUser(item.username),
    email: sanitizeEmail(item.email),
    role: sanitizeRole(item.role),
    createdAt: item.createdAt || null
  }));
  res.json({ users });
});

app.post("/api/users/template-entry", (req, res) => {
  const username = sanitizeUser(req.body?.username);
  const email = sanitizeEmail(req.body?.email);
  const password = sanitizePassword(req.body?.password);
  const role = sanitizeRole(req.body?.role);
  const defaultColor = String(req.body?.defaultColor || "#ff5d43").slice(0, 20);

  if (!username) {
    res.status(400).json({ ok: false, message: "Zadej uživatelské jméno." });
    return;
  }

  if (!email || !isEmailValid(email)) {
    res.status(400).json({ ok: false, message: "Zadej platný e-mail." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ ok: false, message: "Heslo musí mít alespoň 6 znaků." });
    return;
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username,
    email,
    role,
    passwordHash: hashPassword(password),
    defaultColor,
    createdAt: new Date().toISOString()
  };

  res.json({ ok: true, entry });
});

app.get("/api/snapshots/latest", (_req, res) => {
  res.json({ latest: readLatestSnapshot() });
});

app.get("/api/snapshots", (_req, res) => {
  res.json({ snapshots: listSnapshotSummaries() });
});

// 1. Načtení historie a snapshotů při startu serveru
const restoredActivity = readLatestActivityEntries();
if (restoredActivity.length > 0) {
  activity.push(...restoredActivity);
  console.log(`Obnoven živý feed (${restoredActivity.length} položek).`);
}

const restoredSnapshot = restoreBoardFromLatestSnapshot();
if (restoredSnapshot) {
  console.log(
    `Obnoven snapshot ${restoredSnapshot.id} (${restoredSnapshot.noteCount} listku, ${restoredSnapshot.textCount} textu) z ${restoredSnapshot.createdAt}.`
  );
}

// 1. Správné servírování statických souborů z kořene projektu
app.use(express.static(path.resolve(__dirname)));

// 2. OPRAVENO: Použití path.resolve pro přesné zacílení na index.html
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "index.html"));
});

// 3. OPRAVENO: Správné spuštění serveru pro Render (vytáhnuto ven z podmínky)
const PORT = process.env.PORT || 3099;
server.listen(PORT, () => {
  console.log(`Nástěnka Live běží na portu ${PORT}`);
});
