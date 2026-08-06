const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const {
  isFirestoreEnabled,
  initializeFirestoreStorage,
  saveUsers: saveUsersToFirestore,
  saveSnapshot: saveSnapshotToFirestore,
  saveActivity: saveActivityToFirestore
} = require("./firestore-storage");

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
const noteConnections = [];
const textResizeActivityByUser = new Map();
const noteResizeActivityByUser = new Map();

const activity = [];
const dataDir = path.join(__dirname, "data");
const activityDir = path.join(dataDir, "activity");
const legacySnapshotFilePath = path.join(dataDir, "board-snapshots.json");
const usersFilePath = path.join(dataDir, "users.json");
let firestoreUsers = null;
let firestoreSnapshots = [];
let firestoreActivity = [];
const ACTIVITY_LIMIT = 30;
const DONE_STACK_X = 2400;
const DONE_STACK_Y = 430;
const DONE_STACK_COLUMNS = 4;
const DONE_STACK_GAP_X = 28;
const DONE_STACK_GAP_Y = 28;
const TEXT_RESIZE_ACTIVITY_THROTTLE_MS = 1500;
const NOTE_WIDTH = 206;
const NOTE_DEFAULT_WIDTH = 188;
const NOTE_DEFAULT_HEIGHT = 146;
const NOTE_MIN_WIDTH = 120;
const NOTE_MIN_HEIGHT = 90;
const NOTE_MAX_WIDTH = 600;
const NOTE_MAX_HEIGHT = 480;
const NOTE_RESIZE_ACTIVITY_THROTTLE_MS = 1500;
const BOARD_TEXT_WIDTH = 340;
const BOARD_TEXT_HEIGHT = 110;
const BOARD_TEXT_MIN_WIDTH = 120;
const BOARD_TEXT_MIN_HEIGHT = 90;
const SELF_REGISTRATION_ENABLED = false;
const GUEST_LOGIN_ENABLED = true;
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

function shouldLogTextResizeActivity(user, textItem) {
  const key = `${user?.id || user?.name || "unknown"}:${textItem?.id || "unknown"}`;
  const now = Date.now();
  const lastLoggedAt = textResizeActivityByUser.get(key) || 0;
  if (now - lastLoggedAt < TEXT_RESIZE_ACTIVITY_THROTTLE_MS) {
    return false;
  }

  textResizeActivityByUser.set(key, now);
  return true;
}

function shouldLogNoteResizeActivity(user, note) {
  const key = `${user?.id || user?.name || "unknown"}:${note?.id || "unknown"}`;
  const now = Date.now();
  const lastLoggedAt = noteResizeActivityByUser.get(key) || 0;
  if (now - lastLoggedAt < NOTE_RESIZE_ACTIVITY_THROTTLE_MS) {
    return false;
  }

  noteResizeActivityByUser.set(key, now);
  return true;
}

function sanitizeNoteDimension(value, fallback, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.round(Math.min(Math.max(numericValue, min), max));
}

function sanitizeUser(name) {
  return String(name || "").trim().slice(0, 30);
}

function sanitizeAssigneeNames(value, fallback = "") {
  const values = Array.isArray(value) ? value : String(value || fallback).split(",");
  return Array.from(new Set(values.map(sanitizeUser).filter(Boolean))).slice(0, 20);
}

function getAssigneeNames(note) {
  return sanitizeAssigneeNames(note?.toUsers, note?.to);
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

function sanitizeRichText(value) {
  let s = String(value || "");
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/?\s*(?:div|p)\b[^>]*>/gi, "\n");
  s = s.replace(/<\s*(?:b|strong)\s*>/gi, "\u0001OB\u0002");
  s = s.replace(/<\s*\/\s*(?:b|strong)\s*>/gi, "\u0001CB\u0002");
  s = s.replace(/<\s*(?:i|em)\s*>/gi, "\u0001OI\u0002");
  s = s.replace(/<\s*\/\s*(?:i|em)\s*>/gi, "\u0001CI\u0002");
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  s = s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\u0001OB\u0002/g, "<b>").replace(/\u0001CB\u0002/g, "</b>");
  s = s.replace(/\u0001OI\u0002/g, "<i>").replace(/\u0001CI\u0002/g, "</i>");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > 2000) {
    s = s.slice(0, 2000);
  }
  return s;
}

function sanitizeColor(value) {
  const clean = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    return clean.toLowerCase();
  }
  return null;
}

function sanitizeNoteFormat(value) {
  return {
    bold: Boolean(value?.bold),
    italic: Boolean(value?.italic),
    size: ["small", "normal", "large"].includes(value?.size) ? value.size : "normal",
    align: ["left", "center", "right"].includes(value?.align) ? value.align : "left"
  };
}

function sanitizeBoardTextSize(value) {
  const presets = {
    small: 1.25,
    normal: 1.8,
    large: 2.65
  };
  if (Object.hasOwn(presets, value)) {
    return presets[value];
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return presets.normal;
  }

  return Math.round(Math.max(numericValue, 0.25) * 100) / 100;
}

function sanitizeBoardTextDimension(value, fallback, min) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.round(Math.max(numericValue, min));
}

function textSnippet(value, maxLength = 48) {
  const plain = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  const clean = plain.replace(/\s+/g, " ").trim();
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

function getRequestUser(req) {
  const authorization = String(req.headers.authorization || "");
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const token = sanitizeSessionToken(req.headers["x-session-token"] || bearerToken);
  return getSessionUser(token) ? { ...getSessionUser(token), sessionToken: token } : null;
}

function requireAdmin(req, res) {
  const user = getRequestUser(req);
  if (!user || !isAdmin(user)) {
    res.status(403).json({ ok: false, message: "Přístup je povolen pouze administrátorům." });
    return null;
  }
  return user;
}

function canManageNote(_user, _note) {
  return isAdmin(_user) || Boolean(_user?.name && _note?.from === _user.name);
}

function canDeleteNote(user, note) {
  return getNoteStatus(note) === "done" || canManageNote(user, note);
}

function canToggleNote(_user, _note) {
  return true;
}

function canManageText(_user, _textItem) {
  return true;
}

function normalizeNoteStatus(value, doneFallback = false) {
  if (value === "done" || value === "active") {
    return value;
  }
  return doneFallback ? "done" : "active";
}

function getNoteStatus(note) {
  return normalizeNoteStatus(note?.status, Boolean(note?.done));
}

function sanitizeLinkedSourceNoteId(value) {
  const clean = String(value || "").trim();
  return clean || null;
}

function getDoneStackPosition(currentNoteId = null) {
  const doneNotes = notes
    .filter((note) => getNoteStatus(note) === "done" && note.id !== currentNoteId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const index = doneNotes.length;
  const column = index % DONE_STACK_COLUMNS;
  const row = Math.floor(index / DONE_STACK_COLUMNS);

  return {
    x: DONE_STACK_X + column * (NOTE_DEFAULT_WIDTH + DONE_STACK_GAP_X),
    y: DONE_STACK_Y + row * (NOTE_DEFAULT_HEIGHT + DONE_STACK_GAP_Y)
  };
}

function removeConnectionsForNote(noteId) {
  const removed = noteConnections.filter((connection) => connection.fromId === noteId || connection.toId === noteId);
  if (removed.length > 0) {
    for (const connection of removed) {
      noteConnections.splice(noteConnections.indexOf(connection), 1);
      io.emit("connection:deleted", connection);
    }
  }
  return removed.length;
}

function applyNoteStatusToNote(note, nextStatus) {
  const currentStatus = getNoteStatus(note);
  const normalizedStatus = normalizeNoteStatus(nextStatus, currentStatus === "done");
  if (currentStatus === normalizedStatus) {
    return false;
  }

  note.status = normalizedStatus;
  note.done = normalizedStatus === "done";

  if (normalizedStatus === "done") {
    const stackPosition = getDoneStackPosition(note.id);
    note.x = stackPosition.x;
    note.y = stackPosition.y;
  }

  return true;
}

function resolveLinkedSourceNoteId(candidateId, linkedForUserName, currentNoteId = null) {
  const linkedSourceNoteId = sanitizeLinkedSourceNoteId(candidateId);
  const normalizedLinkedForUserName = sanitizeUser(linkedForUserName);
  if (!linkedSourceNoteId || !normalizedLinkedForUserName) {
    return null;
  }

  const sourceNote = notes.find((item) => item.id === linkedSourceNoteId);
  if (!sourceNote) {
    return null;
  }

  if (sourceNote.id === String(currentNoteId || "")) {
    return null;
  }

  if (getNoteStatus(sourceNote) !== "active") {
    return null;
  }

  return getAssigneeNames(sourceNote).some((name) => sanitizeUser(name) === normalizedLinkedForUserName) ? sourceNote.id : null;
}

function findAutoLinkedSourceNoteId(delegatorName, linkedForUserName, currentNoteId = null) {
  const normalizedDelegatorName = sanitizeUser(delegatorName);
  const normalizedLinkedForUserName = sanitizeUser(linkedForUserName);
  if (!normalizedDelegatorName || !normalizedLinkedForUserName || normalizedDelegatorName === normalizedLinkedForUserName) {
    return null;
  }

  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    if (!note || note.id === String(currentNoteId || "")) {
      continue;
    }

    if (getNoteStatus(note) !== "active") {
      continue;
    }

    if (sanitizeUser(note.from) !== normalizedDelegatorName) {
      continue;
    }

    if (!getAssigneeNames(note).some((name) => sanitizeUser(name) === normalizedLinkedForUserName)) {
      continue;
    }

    return note.id;
  }

  return null;
}

function findLatestIncomingAssignedNoteId(linkedForUserName, currentNoteId = null) {
  const normalizedLinkedForUserName = sanitizeUser(linkedForUserName);
  if (!normalizedLinkedForUserName) {
    return null;
  }

  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    if (!note || note.id === String(currentNoteId || "")) {
      continue;
    }

    if (getNoteStatus(note) !== "active") {
      continue;
    }

    if (!getAssigneeNames(note).some((name) => sanitizeUser(name) === normalizedLinkedForUserName)) {
      continue;
    }

    if (sanitizeUser(note.from) === normalizedLinkedForUserName) {
      continue;
    }

    return note.id;
  }

  return null;
}

function findLatestPendingDelegatedNoteForUser(userName, currentNoteId = null) {
  const normalizedUserName = sanitizeUser(userName);
  if (!normalizedUserName) {
    return null;
  }

  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    if (!note || note.id === String(currentNoteId || "")) {
      continue;
    }

    if (getNoteStatus(note) !== "active") {
      continue;
    }

    if (!note.isDelegated) {
      continue;
    }

    if (sanitizeLinkedSourceNoteId(note.linkedSourceNoteId)) {
      continue;
    }

    if (sanitizeUser(note.from) !== normalizedUserName || !getAssigneeNames(note).includes(normalizedUserName)) {
      continue;
    }

    return note;
  }

  return null;
}

function linkPendingDelegatedNoteToSourceNote(sourceNote, currentPendingNoteId = null) {
  if (!sourceNote || getNoteStatus(sourceNote) !== "active") {
    return null;
  }

  const authorName = sanitizeUser(sourceNote.from);
  const assigneeName = getAssigneeNames(sourceNote).find((name) => sanitizeUser(name) !== authorName);
  if (!assigneeName || !authorName) {
    return null;
  }

  const pendingDelegatedNote = findLatestPendingDelegatedNoteForUser(assigneeName, currentPendingNoteId);
  if (!pendingDelegatedNote) {
    return null;
  }

  pendingDelegatedNote.linkedSourceNoteId = sourceNote.id;
  return pendingDelegatedNote;
}

function resolveRequestedOrAutoLinkedSourceNoteId(candidateId, delegatorName, linkedForUserName, currentNoteId = null) {
  return (
    resolveLinkedSourceNoteId(candidateId, linkedForUserName, currentNoteId)
    || findAutoLinkedSourceNoteId(delegatorName, linkedForUserName, currentNoteId)
  );
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
  if (isFirestoreEnabled()) {
    return Array.from(new Set(firestoreSnapshots.map((snapshot) => (
      `board-snapshots-${String(snapshot.createdAt || "").slice(0, 10)}.json`
    )))).map((fileName) => path.join(dataDir, fileName));
  }

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
  if (isFirestoreEnabled()) {
    const fileName = path.basename(filePath);
    return firestoreSnapshots.filter((snapshot) => (
      `board-snapshots-${String(snapshot.createdAt || "").slice(0, 10)}.json` === fileName
    ));
  }

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
  if (isFirestoreEnabled()) {
    return firestoreSnapshots[0] || null;
  }

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
  const snapshotConnections = Array.isArray(snapshot.connections) ? snapshot.connections : [];

  notes.length = 0;
  boardTexts.length = 0;
  noteConnections.length = 0;

  snapshotNotes.forEach((item, index) => {
    const owner = sanitizeUser(item?.owner || item?.from);
    const from = sanitizeUser(item?.from || owner);
    const ownerEmail = sanitizeEmail(item?.ownerEmail);
    const ownerId = sanitizeEmail(item?.ownerId || ownerEmail) || owner || from;
    const toUsers = sanitizeAssigneeNames(item?.toUsers ?? item?.to, owner || from);

    notes.push({
      id: String(item?.id || `${Date.now()}-restored-note-${index}`),
      text: sanitizeRichText(item?.text),
      owner,
      ownerEmail: ownerEmail || undefined,
      ownerId,
      from,
      isDelegated: Boolean(item?.isDelegated || sanitizeLinkedSourceNoteId(item?.linkedSourceNoteId)),
      linkedSourceNoteId: sanitizeLinkedSourceNoteId(item?.linkedSourceNoteId),
      toUsers,
      to: toUsers.join(", "),
      priority: ["Nizka", "Stredni", "Vysoka"].includes(item?.priority) ? item.priority : "Stredni",
      deadline: String(item?.deadline || "").slice(0, 10),
      status: normalizeNoteStatus(item?.status, Boolean(item?.done)),
      done: normalizeNoteStatus(item?.status, Boolean(item?.done)) === "done",
      color: sanitizeColor(item?.color) || "#ffe66e",
      format: sanitizeNoteFormat(item?.format),
      x: Number.isFinite(item?.position?.x) ? item.position.x : 140,
      y: Number.isFinite(item?.position?.y) ? item.position.y : 120,
      width: sanitizeNoteDimension(item?.width, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH),
      height: sanitizeNoteDimension(item?.height, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT)
    });
  });

  notes
    .filter((note) => getNoteStatus(note) === "done")
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((note, index) => {
      const column = index % DONE_STACK_COLUMNS;
      const row = Math.floor(index / DONE_STACK_COLUMNS);
      note.x = DONE_STACK_X + column * (NOTE_DEFAULT_WIDTH + DONE_STACK_GAP_X);
      note.y = DONE_STACK_Y + row * (NOTE_DEFAULT_HEIGHT + DONE_STACK_GAP_Y);
    });

  snapshotTexts.forEach((item, index) => {
    boardTexts.push({
      id: String(item?.id || `${Date.now()}-restored-text-${index}`),
      text: sanitizeText(item?.text),
      author: sanitizeUser(item?.author || item?.owner),
      owner: sanitizeUser(item?.owner || item?.author),
      ownerEmail: sanitizeEmail(item?.ownerEmail) || undefined,
      ownerId: sanitizeEmail(item?.ownerId || item?.ownerEmail) || sanitizeUser(item?.owner || item?.author),
      size: sanitizeBoardTextSize(item?.size),
      width: sanitizeBoardTextDimension(item?.width, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH),
      height: sanitizeBoardTextDimension(item?.height, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT),
      x: Number.isFinite(item?.position?.x) ? item.position.x : 180,
      y: Number.isFinite(item?.position?.y) ? item.position.y : 120
    });
  });

  const noteIds = new Set(notes.map((note) => note.id));
  snapshotConnections.forEach((connection) => {
    const fromId = String(connection?.fromId || "");
    const toId = String(connection?.toId || "");
    if (fromId && toId && fromId !== toId && noteIds.has(fromId) && noteIds.has(toId)) {
      noteConnections.push({ fromId, toId });
    }
  });

  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    noteCount: notes.length,
    textCount: boardTexts.length,
    connectionCount: noteConnections.length
  };
}

function readActivityEntries(filePath = getActivityFilePath()) {
  if (isFirestoreEnabled()) {
    return firestoreActivity;
  }

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
  if (isFirestoreEnabled()) {
    return firestoreActivity.slice(0, ACTIVITY_LIMIT);
  }

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
  if (isFirestoreEnabled()) {
    firestoreActivity = activity.slice(0, ACTIVITY_LIMIT);
    saveActivityToFirestore(firestoreActivity).catch((error) => {
      console.error(`Uložení aktivity do Firestore selhalo: ${error.message}`);
    });
    return;
  }

  const activityFilePath = ensureActivityStorage();
  fs.writeFileSync(activityFilePath, `${JSON.stringify(activity, null, 2)}\n`, "utf-8");
}

function readRegisteredUsers() {
  if (isFirestoreEnabled()) {
    return firestoreUsers || [];
  }

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
  if (isFirestoreEnabled()) {
    firestoreUsers = users;
    return saveUsersToFirestore(users).catch((error) => {
      console.error(`Uložení uživatelů do Firestore selhalo: ${error.message}`);
      throw error;
    });
  }

  ensureSnapshotStorage();
  fs.writeFileSync(usersFilePath, `${JSON.stringify(users, null, 2)}\n`, "utf-8");
  return Promise.resolve();
}

function saveBoardSnapshot(savedBy) {
  const snapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    savedBy,
    noteCount: notes.length,
    textCount: boardTexts.length,
    connections: noteConnections,
    notes: notes.map((note) => ({
      id: note.id,
      text: note.text,
      owner: note.owner,
      ownerEmail: note.ownerEmail || null,
      ownerId: note.ownerId || null,
      from: note.from,
      isDelegated: Boolean(note.isDelegated),
      linkedSourceNoteId: sanitizeLinkedSourceNoteId(note.linkedSourceNoteId),
      toUsers: getAssigneeNames(note),
      to: note.to,
      priority: note.priority,
      deadline: note.deadline,
      status: getNoteStatus(note),
      done: note.done,
      color: note.color,
      format: sanitizeNoteFormat(note.format),
      width: Number.isFinite(note.width) ? note.width : NOTE_DEFAULT_WIDTH,
      height: Number.isFinite(note.height) ? note.height : NOTE_DEFAULT_HEIGHT,
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
      ownerEmail: item.ownerEmail || null,
      ownerId: item.ownerId || null,
      size: sanitizeBoardTextSize(item.size),
      width: sanitizeBoardTextDimension(item.width, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH),
      height: sanitizeBoardTextDimension(item.height, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT),
      position: {
        x: item.x,
        y: item.y
      }
    }))
  };

  const dailySnapshotFilePath = getSnapshotFilePath();
  if (isFirestoreEnabled()) {
    firestoreSnapshots.unshift(snapshot);
    saveSnapshotToFirestore(snapshot).catch((error) => {
      console.error(`Uložení snapshotu do Firestore selhalo: ${error.message}`);
    });
    return snapshot;
  }

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

function refreshActiveUserProfile(updatedUser) {
  const updatedEmail = sanitizeEmail(updatedUser?.email);
  sessionsByToken.forEach((sessionUser, token) => {
    if (sanitizeEmail(sessionUser.email) !== updatedEmail) {
      return;
    }

    sessionUser.name = sanitizeUser(updatedUser.username);
    sessionUser.email = updatedEmail;
    sessionUser.role = sanitizeRole(updatedUser.role);
    sessionUser.color = String(updatedUser.defaultColor || "#ff5d43");

    for (const [socketId, connectedUser] of usersBySocket.entries()) {
      if (connectedUser.sessionToken === token) {
        usersBySocket.set(socketId, {
          ...connectedUser,
          name: sessionUser.name,
          email: sessionUser.email,
          role: sessionUser.role,
          color: sessionUser.color
        });
      }
    }
  });
}

io.on("connection", (socket) => {
  socket.emit("board:init", {
    notes,
    texts: boardTexts,
    connections: noteConnections,
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

  socket.on("auth:guest", () => {
    if (!GUEST_LOGIN_ENABLED) {
      socket.emit("auth:error", "Přihlášení v režimu hosta je vypnuté.");
      return;
    }

    const guestCode = crypto.randomBytes(2).toString("hex").toUpperCase();
    const baseUser = {
      name: `Host ${guestCode}`,
      email: `guest-${Date.now()}-${guestCode.toLowerCase()}@guest.local`,
      role: "user",
      color: "#ffb703"
    };

    const sessionToken = createSessionForUser(baseUser);
    const user = bindSessionToSocket(socket, sessionToken);
    if (!user) {
      socket.emit("auth:error", "Přihlášení hosta se nepodařilo. Zkus to znovu.");
      return;
    }

    socket.emit("auth:ok", user);

    emitUsers();
    addActivity(`${user.name} vstoupil/a do nástěnky jako host (online: ${usersBySocket.size})`);
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

    const assigneeNames = sanitizeAssigneeNames(payload?.toUsers ?? payload?.to, user.name);
    const isDelegated = false;

    const note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: sanitizeRichText(payload?.text),
      owner: user.name,
      ownerEmail: sanitizeEmail(user.email),
      ownerId: sanitizeEmail(user.email),
      from: user.name,
      isDelegated,
      linkedSourceNoteId: isDelegated && assigneeNames.includes(user.name) ? findLatestIncomingAssignedNoteId(user.name) : null,
      toUsers: assigneeNames,
      to: assigneeNames.join(", "),
      priority: ["Nizka", "Stredni", "Vysoka"].includes(payload?.priority)
        ? payload.priority
        : "Stredni",
      deadline: String(payload?.deadline || "").slice(0, 10),
      color: sanitizeColor(payload?.color) || "#ffe66e",
      format: sanitizeNoteFormat(payload?.format),
      x: Number.isFinite(payload?.x) ? payload.x : 140,
      y: Number.isFinite(payload?.y) ? payload.y : 120,
      width: sanitizeNoteDimension(payload?.width, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH),
      height: sanitizeNoteDimension(payload?.height, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT),
      status: "active",
      done: false
    };

    if (!note.text) {
      return;
    }

    notes.push(note);
    const relinkedNote = linkPendingDelegatedNoteToSourceNote(note, note.id);
    io.emit("note:created", note);
    if (relinkedNote) {
      io.emit("note:updated", relinkedNote);
    }
    addActivity(
      `${note.from} vytvořil/a ticket: "${textSnippet(note.text)}" pro ${note.to} | priorita ${formatPriorityLabel(note.priority)}${
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
      size: sanitizeBoardTextSize(payload?.size),
      x: Number.isFinite(payload?.x) ? payload.x : 180,
      y: Number.isFinite(payload?.y) ? payload.y : 120
    };

    if (!textItem.text) {
      return;
    }

    boardTexts.push(textItem);
    io.emit("text:created", textItem);
    addActivity(`${user.name} přidal/a text: "${textSnippet(textItem.text)}" na plochu`);
  });

  socket.on("connection:create", ({ fromId, toId }, ack) => {
    const user = usersBySocket.get(socket.id);
    const cleanFromId = String(fromId || "");
    const cleanToId = String(toId || "");
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }
    if (!cleanFromId || !cleanToId || cleanFromId === cleanToId) {
      ack?.({ ok: false, message: "Vyber dva různé tickety." });
      return;
    }
    if (!notes.some((note) => note.id === cleanFromId) || !notes.some((note) => note.id === cleanToId)) {
      ack?.({ ok: false, message: "Jeden z vybraných ticketů už neexistuje." });
      return;
    }
    if (noteConnections.some((connection) => (
      (connection.fromId === cleanFromId && connection.toId === cleanToId)
      || (connection.fromId === cleanToId && connection.toId === cleanFromId)
    ))) {
      ack?.({ ok: true, connection: { fromId: cleanFromId, toId: cleanToId }, existing: true });
      return;
    }

    const connection = { fromId: cleanFromId, toId: cleanToId };
    noteConnections.push(connection);
    io.emit("connection:created", connection);
    addActivity(`${user.name} propojil/a dva tickety`);
    ack?.({ ok: true, connection });
  });

  socket.on("note:move", ({ id, x, y }) => {
    const user = usersBySocket.get(socket.id);
    const note = notes.find((item) => item.id === id);
    if (!note || !user) {
      return;
    }

    if (getNoteStatus(note) !== "active") {
      return;
    }

    note.x = Number.isFinite(x) ? x : note.x;
    note.y = Number.isFinite(y) ? y : note.y;

    socket.broadcast.emit("note:moved", { id: note.id, x: note.x, y: note.y });
  });

  socket.on("note:resize", ({ id, width, height }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const note = notes.find((item) => item.id === String(id || ""));
    if (!note) {
      ack?.({ ok: false, message: "ticket už neexistuje." });
      return;
    }

    if (getNoteStatus(note) !== "active") {
      ack?.({ ok: false, message: "Velikost můžeš měnit jen u aktivního lístku na ploše." });
      return;
    }

    if (!canManageNote(user, note)) {
      ack?.({ ok: false, message: "Velikost tohoto lístku může změnit jen jeho autor nebo admin." });
      return;
    }

    const previousWidth = note.width;
    const previousHeight = note.height;
    note.width = sanitizeNoteDimension(width, note.width || NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
    note.height = sanitizeNoteDimension(height, note.height || NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);
    const sizeChanged = note.width !== previousWidth || note.height !== previousHeight;

    io.emit("note:resized", { id: note.id, width: note.width, height: note.height });
    if (sizeChanged && shouldLogNoteResizeActivity(user, note)) {
      addActivity(`${user.name} změnil/a velikost lístku: "${textSnippet(note.text)}" pro ${note.to}`);
    }
    ack?.({ ok: true, note });
  });

  socket.on("text:move", ({ id, x, y }) => {
    const user = usersBySocket.get(socket.id);
    const textItem = boardTexts.find((item) => item.id === id);
    if (!textItem || !user) {
      return;
    }

    textItem.x = Number.isFinite(x) ? x : textItem.x;
    textItem.y = Number.isFinite(y) ? y : textItem.y;

    socket.broadcast.emit("text:moved", { id: textItem.id, x: textItem.x, y: textItem.y });
  });

  socket.on("text:update", ({ id, text, size }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const textItem = boardTexts.find((item) => item.id === String(id || ""));
    if (!textItem) {
      ack?.({ ok: false, message: "Text už neexistuje." });
      return;
    }

    const nextText = sanitizeText(text);
    if (!nextText) {
      ack?.({ ok: false, message: "Text nemůže být prázdný." });
      return;
    }

    textItem.text = nextText;
    textItem.size = sanitizeBoardTextSize(size || textItem.size);
    io.emit("text:updated", textItem);
    addActivity(`${user.name} upravil/a text: "${textSnippet(textItem.text)}" na ploše`);
    ack?.({ ok: true, item: textItem });
  });

  socket.on("text:resize", ({ id, width, height, size }, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const textItem = boardTexts.find((item) => item.id === String(id || ""));
    if (!textItem) {
      ack?.({ ok: false, message: "Text už neexistuje." });
      return;
    }

    const previousWidth = textItem.width;
    const previousHeight = textItem.height;
    textItem.width = sanitizeBoardTextDimension(width, textItem.width || BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH);
    textItem.height = sanitizeBoardTextDimension(height, textItem.height || BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT);
    textItem.size = sanitizeBoardTextSize(size ?? textItem.size);
    const sizeChanged = textItem.width !== previousWidth || textItem.height !== previousHeight;

    io.emit("text:resized", { id: textItem.id, width: textItem.width, height: textItem.height, size: textItem.size });
    if (sizeChanged && shouldLogTextResizeActivity(user, textItem)) {
      addActivity(`${user.name} změnil/a velikost textu: "${textSnippet(textItem.text)}" na ploše`);
    }
    ack?.({ ok: true, item: textItem });
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

    const [removedText] = boardTexts.splice(textIndex, 1);
    io.emit("text:deleted", { id: removedText.id });
    addActivity(`${user.name} smazal/a text: "${textSnippet(removedText.text)}" z plochy`);
    ack?.({ ok: true, id: removedText.id });
  });

  socket.on("note:toggle", ({ id }, ack) => {
    const note = notes.find((item) => item.id === id);
    const user = usersBySocket.get(socket.id);
    if (!note || !user) {
      ack?.({ ok: false, message: "ticket nebyl nalezen nebo nejsi přihlášen." });
      return;
    }

    if (!canToggleNote(user, note)) {
      ack?.({ ok: false, message: "Tento ticket může měnit jen autor, admin nebo přiřazený uživatel." });
      return;
    }

    const currentStatus = getNoteStatus(note);
    const nextStatus = currentStatus === "done" ? "active" : "done";
    applyNoteStatusToNote(note, nextStatus);
    if (nextStatus === "done") {
      removeConnectionsForNote(note.id);
    }

    io.emit("note:updated", note);
    addActivity(
      nextStatus === "done"
        ? `${user.name} přesunul/a ticket: "${textSnippet(note.text, 36)}" pro ${note.to} do vyřešených`
        : `${user.name} obnovil/a ticket: "${textSnippet(note.text, 36)}" pro ${note.to} zpět na plochu`
    );
    ack?.({ ok: true, id: note.id, status: nextStatus });
  });

  socket.on("note:update", (payload, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const note = notes.find((item) => item.id === String(payload?.id || ""));
    if (!note) {
      ack?.({ ok: false, message: "ticket už neexistuje." });
      return;
    }

    if (getNoteStatus(note) !== "active") {
      ack?.({ ok: false, message: "Upravovat můžeš jen aktivní ticket na ploše." });
      return;
    }

    if (!canManageNote(user, note)) {
      ack?.({ ok: false, message: "Tento ticket může upravit jen jeho autor nebo admin." });
      return;
    }

    const text = sanitizeRichText(payload?.text);
    if (!text) {
      ack?.({ ok: false, message: "Doplň text lístku." });
      return;
    }

    note.text = text;
    const assigneeNames = sanitizeAssigneeNames(payload?.toUsers ?? payload?.to, note.to);
    note.toUsers = assigneeNames;
    note.to = assigneeNames.join(", ");
    const isDelegated = payload?.isDelegated === undefined ? Boolean(note.isDelegated) : Boolean(payload.isDelegated);
    note.isDelegated = isDelegated;
    note.linkedSourceNoteId = isDelegated && assigneeNames.includes(user.name)
      ? findLatestIncomingAssignedNoteId(user.name, note.id)
      : null;
    note.priority = ["Nizka", "Stredni", "Vysoka"].includes(payload?.priority)
      ? payload.priority
      : note.priority;
    note.deadline = String(payload?.deadline || "").slice(0, 10);
    note.color = sanitizeColor(payload?.color) || note.color;
    note.format = sanitizeNoteFormat(payload?.format);

    const relinkedNote = linkPendingDelegatedNoteToSourceNote(note, note.id);
    io.emit("note:updated", note);
    if (relinkedNote) {
      io.emit("note:updated", relinkedNote);
    }
    addActivity(
      `${user.name} upravil/a ticket: "${textSnippet(note.text)}" pro ${note.to} | priorita ${formatPriorityLabel(note.priority)}${
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

    const note = notes.find((item) => item.id === String(id || ""));
    if (!note) {
      ack?.({ ok: false, message: "ticket už neexistuje." });
      return;
    }

    if (!canDeleteNote(user, note)) {
      ack?.({ ok: false, message: "Tento aktivní ticket může smazat jen jeho autor nebo admin." });
      return;
    }

    const noteIndex = notes.findIndex((item) => item.id === note.id);
    const [removed] = notes.splice(noteIndex, 1);
    io.emit("note:deleted", { id: removed.id });
    addActivity(`${user.name} smazal/a ticket: "${textSnippet(removed.text)}" pro ${removed.to}`);
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

      if (!canDeleteNote(user, notes[noteIndex])) {
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
    let alreadyDoneCount = 0;
    let deniedCount = 0;

    uniqueIds.forEach((id) => {
      const note = notes.find((item) => item.id === id);
      if (!note) {
        return;
      }

      if (!canManageNote(user, note)) {
        deniedCount += 1;
        return;
      }

      if (getNoteStatus(note) === "done") {
        alreadyDoneCount += 1;
        return;
      }

      if (getNoteStatus(note) !== "active") {
        return;
      }

      applyNoteStatusToNote(note, "done");
      removeConnectionsForNote(note.id);
      updatedCount += 1;

      io.emit("note:updated", note);
    });

    if (updatedCount > 0) {
      addActivity(`${user.name} hromadně přesunul/a lístky do vyřešených (${updatedCount})`);
    }

    ack?.({ ok: true, updatedCount, deniedCount, alreadyDoneCount });
  });

  socket.on("note:deleteAll", (_payload, ack) => {
    const user = usersBySocket.get(socket.id);
    if (!user) {
      ack?.({ ok: false, message: "Nejdříve se přihlas." });
      return;
    }

    const activeIds = notes.filter((note) => getNoteStatus(note) === "active").map((note) => note.id);
    const removedCount = activeIds.length;
    if (removedCount === 0) {
      ack?.({ ok: true, removedCount: 0 });
      return;
    }

    activeIds.forEach((id) => {
      const noteIndex = notes.findIndex((item) => item.id === id);
      if (noteIndex === -1) {
        return;
      }

      const [removed] = notes.splice(noteIndex, 1);
      io.emit("note:deleted", { id: removed.id });
    });

    addActivity(`${user.name} smazal/a všechny aktivní lístky (${removedCount})`);
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

app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const users = readRegisteredUsers().map((item) => ({
    id: String(item.id || ""),
    username: sanitizeUser(item.username),
    email: sanitizeEmail(item.email),
    role: sanitizeRole(item.role),
    defaultColor: String(item.defaultColor || "#ff5d43"),
    createdAt: item.createdAt || null
  }));
  res.json({ ok: true, users });
});

app.post("/api/admin/users", async (req, res) => {
  const adminUser = requireAdmin(req, res);
  if (!adminUser) {
    return;
  }

  const username = sanitizeUser(req.body?.username);
  const email = sanitizeEmail(req.body?.email);
  const password = sanitizePassword(req.body?.password);
  const role = sanitizeRole(req.body?.role);
  const defaultColor = sanitizeColor(req.body?.defaultColor) || "#ff5d43";
  const users = readRegisteredUsers();

  if (!username || !email || !isEmailValid(email) || password.length < 6) {
    res.status(400).json({ ok: false, message: "Vyplň platné jméno, e-mail a heslo dlouhé alespoň 6 znaků." });
    return;
  }
  if (users.some((item) => sanitizeEmail(item.email) === email)) {
    res.status(409).json({ ok: false, message: "Tento e-mail už je registrovaný." });
    return;
  }
  if (users.some((item) => sanitizeUser(item.username).toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ ok: false, message: "Toto uživatelské jméno už existuje." });
    return;
  }

  users.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username,
    email,
    role,
    passwordHash: hashPassword(password),
    defaultColor,
    createdAt: new Date().toISOString()
  });

  try {
    await saveRegisteredUsers(users);
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Uložení uživatele se nepodařilo." });
  }
});

app.patch("/api/admin/users/:id", async (req, res) => {
  const adminUser = requireAdmin(req, res);
  if (!adminUser) {
    return;
  }

  const users = readRegisteredUsers();
  const user = users.find((item) => String(item.id) === String(req.params.id));
  if (!user) {
    res.status(404).json({ ok: false, message: "Uživatel nebyl nalezen." });
    return;
  }

  const username = sanitizeUser(req.body?.username);
  const email = sanitizeEmail(req.body?.email);
  const password = sanitizePassword(req.body?.password);
  const role = sanitizeRole(req.body?.role);
  const defaultColor = sanitizeColor(req.body?.defaultColor) || "#ff5d43";

  if (!username || !email || !isEmailValid(email)) {
    res.status(400).json({ ok: false, message: "Vyplň platné jméno a e-mail." });
    return;
  }
  if (password && password.length < 6) {
    res.status(400).json({ ok: false, message: "Nové heslo musí mít alespoň 6 znaků." });
    return;
  }
  if (users.some((item) => String(item.id) !== String(user.id) && sanitizeEmail(item.email) === email)) {
    res.status(409).json({ ok: false, message: "Tento e-mail už používá jiný uživatel." });
    return;
  }
  if (users.some((item) => String(item.id) !== String(user.id) && sanitizeUser(item.username).toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ ok: false, message: "Toto uživatelské jméno už používá jiný uživatel." });
    return;
  }

  user.username = username;
  user.email = email;
  user.role = role;
  user.defaultColor = defaultColor;
  if (password) {
    user.passwordHash = hashPassword(password);
  }

  try {
    await saveRegisteredUsers(users);
    refreshActiveUserProfile(user);
    emitUsers();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Uložení změn se nepodařilo." });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  const adminUser = requireAdmin(req, res);
  if (!adminUser) {
    return;
  }

  const users = readRegisteredUsers();
  const userIndex = users.findIndex((item) => String(item.id) === String(req.params.id));
  if (userIndex === -1) {
    res.status(404).json({ ok: false, message: "Uživatel nebyl nalezen." });
    return;
  }

  const target = users[userIndex];
  const adminCount = users.filter((item) => isAdmin(item)).length;
  if (isAdmin(target) && adminCount <= 1) {
    res.status(400).json({ ok: false, message: "Nelze odstranit posledního administrátora." });
    return;
  }
  if (sanitizeEmail(target.email) === sanitizeEmail(adminUser.email)) {
    res.status(400).json({ ok: false, message: "Svůj vlastní účet zde nelze odstranit." });
    return;
  }

  users.splice(userIndex, 1);
  try {
    await saveRegisteredUsers(users);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Odstranění uživatele se nepodařilo." });
  }
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

async function startServer() {
  ensureSnapshotStorage();

  if (isFirestoreEnabled()) {
    const remoteStorage = await initializeFirestoreStorage();
    firestoreUsers = remoteStorage.users;
    firestoreSnapshots = remoteStorage.snapshots.sort((a, b) => (
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    ));
    firestoreActivity = remoteStorage.activity.sort((a, b) => (
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    ));
    console.log(`Používá se Firestore (${firestoreSnapshots.length} snapshotů, ${firestoreUsers.length} uživatelů).`);
  }

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

  const PORT = process.env.PORT || 3099;
  server.listen(PORT, () => {
    console.log(`Nástěnka Live běží na portu ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error(`Spuštění serveru selhalo: ${error.message}`);
  process.exitCode = 1;
});
