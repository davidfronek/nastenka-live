const socket = io();

const noteColors = ["#ffe66e", "#89f0a0", "#89e8ff", "#ffb3d9", "#ffd08b"];

const CANVAS_GROW_STEP = 800;
const CANVAS_PADDING = 320;
const SCALE_MIN = 50;
const SCALE_MAX = 120;
const SCALE_STEP = 5;
const PREVIEW_ANIMATION_MS = 220;
const NOTE_HOVER_PREVIEW_DELAY_MS = 3000;
const ALIGN_THRESHOLD_PX = 6;
const EMOJI_OPTIONS = [
  "🙂", "😀", "😄", "😁", "😆", "😂", "🤣", "😊", "😉", "😍", "🤩", "😎",
  "🤔", "🙄", "😬", "😅", "😇", "😴", "😡", "😢", "😭", "😱", "🤯", "🥳",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👀", "💡", "✅", "☑️", "❌",
  "⚠️", "❗", "❓", "⭐", "🔥", "🚀", "🎯", "🏆", "📌", "📎", "📝", "📅",
  "⏰", "🔔", "💬", "📣", "❤️", "💙", "💚", "💛", "💜", "☕", "🍀", "🎉"
];

let selectedNoteColor = noteColors[0];
let boardInlineSelectedColor = noteColors[0];
let me = null;
let onlineUsers = [];
let registeredUsers = [];
let notes = [];
let boardTexts = [];
let selectedNoteIds = new Set();

let dragged = null;
let draggedElement = null;
let draggedSelection = null;
let activePointerId = null;
let dragOffset = { x: 0, y: 0 };
let lastMoveEmitAt = 0;

let pendingDeleteId = null;
let pendingDeleteTimer = null;
let pendingDeleteAll = false;
let pendingDeleteAllTimer = null;
let draggedBoardText = null;
let draggedBoardTextElement = null;
let activeTextPointerId = null;
let lastTextMoveEmitAt = 0;
let textDragOffset = { x: 0, y: 0 };
let selectionPointerId = null;
let selectionStart = null;
let selectionCurrent = null;
let selectionRectEl = null;

let gridSizePx = 2;
let noteScalePercent = 70;
let canvasWidth = 2400;
let canvasHeight = 1600;
let snapEnabled = true;
let notePreviewClosingTimer = null;
let activePreviewNoteId = null;
let isPreviewEditing = false;
let verticalGuideEl = null;
let horizontalGuideEl = null;

const GRID_MIN = 2;
const GRID_MAX = 40;
const GRID_STEP = 2;
const CLIENT_DONE_OVAL_BASE_CENTER_X = 2400;
const CLIENT_DONE_OVAL_CENTER_Y = 430;
const CLIENT_DONE_OVAL_RADIUS_X = 320;
const CLIENT_DONE_OVAL_RADIUS_Y = 220;
const CLIENT_DONE_OVAL_POINTS_PER_RING = 14;
const CLIENT_DONE_OVAL_RING_STEP_X = 170;
const CLIENT_DONE_OVAL_RING_STEP_Y = 130;
const CLIENT_DONE_ACTIVE_GAP_PX = 500;
const NOTE_BASE_WIDTH = 206;
const BOARD_TEXT_WIDTH = 340;
const BOARD_TEXT_HEIGHT = 110;

const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const loginEmailWrap = document.querySelector("#login-email-wrap");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginError = document.querySelector("#login-error");
const appShell = document.querySelector("#app-shell");
const meBadge = document.querySelector("#me-badge");
const logoutBtn = document.querySelector("#logout-btn");

const board = document.querySelector("#board");
const boardCanvas = document.querySelector("#board-canvas") || board;
const noteTemplate = document.querySelector("#note-template");
const noteForm = document.querySelector("#note-form");
const noteText = document.querySelector("#note-text");
const pasteNoteTextBtn = document.querySelector("#paste-note-text");
const fromUser = document.querySelector("#from-user");
const toUser = document.querySelector("#to-user");
const priority = document.querySelector("#priority");
const deadline = document.querySelector("#deadline");
const presence = document.querySelector("#presence");
const palette = document.querySelector("#palette");
const noteScaleMinus = document.querySelector("#note-scale-minus");
const noteScalePlus = document.querySelector("#note-scale-plus");
const snapToggle = document.querySelector("#snap-toggle");
const noteScaleValue = document.querySelector("#note-scale-value");
const assigneeFilter = document.querySelector("#assignee-filter");
const activityList = document.querySelector("#activity-list");
const deleteAllBtn = document.querySelector("#delete-all-btn");
const deleteSelectedBtn = document.querySelector("#delete-selected-btn");
const markSelectedDoneBtn = document.querySelector("#mark-selected-done-btn");
const saveSessionBtn = document.querySelector("#save-session-btn");
const restoreSnapshotSelect = document.querySelector("#restore-snapshot-select");
const restoreSnapshotBtn = document.querySelector("#restore-snapshot-btn");
const boardActionStatus = document.querySelector("#board-action-status");
const sessionSaveStatus = document.querySelector("#session-save-status");
const notePreview = document.querySelector("#note-preview");
const notePreviewClose = document.querySelector("#note-preview-close");
const notePreviewText = document.querySelector("#note-preview-text");
const notePreviewDelegation = document.querySelector("#note-preview-delegation");
const notePreviewDetails = document.querySelector("#note-preview-details");
const notePreviewView = document.querySelector("#note-preview-view");
const notePreviewEditBtn = document.querySelector("#note-preview-edit-btn");
const notePreviewEditForm = document.querySelector("#note-preview-edit-form");
const notePreviewEditText = document.querySelector("#note-preview-edit-text");
const notePreviewEditFrom = document.querySelector("#note-preview-edit-from");
const notePreviewEditTo = document.querySelector("#note-preview-edit-to");
const notePreviewEditPriority = document.querySelector("#note-preview-edit-priority");
const notePreviewEditDeadline = document.querySelector("#note-preview-edit-deadline");
const notePreviewEditColorPalette = document.querySelector("#note-preview-edit-color-palette");
const notePreviewCancelBtn = document.querySelector("#note-preview-cancel-btn");
const notePreviewEditStatus = document.querySelector("#note-preview-edit-status");
const toolDock = document.querySelector(".tool-dock");
const toolDockPanel = document.querySelector("#tool-dock-panel");
const dockToggleNote = document.querySelector("#dock-toggle-note");
const dockToggleFilter = document.querySelector("#dock-toggle-filter");
const dockToggleBoard = document.querySelector("#dock-toggle-board");
const dockToggleActions = document.querySelector("#dock-toggle-actions");
const dockSectionNote = document.querySelector("#dock-section-note");
const dockSectionFilter = document.querySelector("#dock-section-filter");
const dockSectionBoard = document.querySelector("#dock-section-board");
const dockSectionActions = document.querySelector("#dock-section-actions");
const boardInlineComposer = document.querySelector("#board-inline-composer");
const boardInlineTitle = document.querySelector("#board-inline-title");
const boardInlineControlTitle = document.querySelector("#board-inline-control-title");
const boardInlineText = document.querySelector("#board-inline-text");
const boardInlineNoteFields = document.querySelector("#board-inline-note-fields");
const boardInlinePasteNoteTextBtn = document.querySelector("#board-inline-paste-note-text");
const boardInlineFromUser = document.querySelector("#board-inline-from-user");
const boardInlineToUser = document.querySelector("#board-inline-to-user");
const boardInlinePriority = document.querySelector("#board-inline-priority");
const boardInlineDeadline = document.querySelector("#board-inline-deadline");
const boardInlinePalette = document.querySelector("#board-inline-palette");
const boardInlineSubmit = document.querySelector("#board-inline-submit");
const boardInlineCancel = document.querySelector("#board-inline-cancel");
const boardQuickCreate = document.querySelector("#board-quick-create");
const boardQuickCreateNote = document.querySelector("#board-quick-create-note");
const boardQuickCreateText = document.querySelector("#board-quick-create-text");
const boardArrowLeft = document.querySelector("#board-arrow-left");
const boardArrowRight = document.querySelector("#board-arrow-right");
const boardArrowUp = document.querySelector("#board-arrow-up");
const boardArrowDown = document.querySelector("#board-arrow-down");
const donePositionText = document.querySelector("#done-position-text");
const DONE_MOVE_ANIMATION_MS = 940;
let boardInlineDraftPosition = null;
let boardInlineCreateMode = "text";
let boardQuickCreateDraftPosition = null;
let previewEditSelectedColor = noteColors[0];
let pendingPreviewUpdateTimer = null;
let pendingHoverPreviewTimer = null;
let pendingHoverPreviewNoteId = null;

const NOTE_FORM_TITLE = "Nový lístek";
const NOTE_FORM_CONTROL_TITLE = "Obsah a delegace";
const NOTE_FORM_TEXT_PLACEHOLDER = "Například: Finální kontrola textu a předání klientovi";
const BOARD_TEXT_TITLE = "Čistý text";
const BOARD_TEXT_CONTROL_TITLE = "Obsah textu";
const BOARD_TEXT_PLACEHOLDER = "Napiš čistý text na plochu";
const AUTH_SESSION_STORAGE_KEY = "nastenka.live.sessionToken";

function getStoredSessionToken() {
  try {
    return window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function storeSessionToken(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors.
  }
}

function clearStoredSessionToken() {
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatPriorityLabel(value) {
  if (value === "Nizka") {
    return "Nízká";
  }
  if (value === "Stredni") {
    return "Střední";
  }
  if (value === "Vysoka") {
    return "Vysoká";
  }
  return value;
}

function formatAssigneeFilterLabel(value) {
  if (value === "Vsechny") {
    return "Všechny";
  }
  return value;
}

function snapToGrid(value) {
  if (!snapEnabled) {
    return value;
  }
  return Math.round(value / gridSizePx) * gridSizePx;
}

function getNoteScale() {
  return noteScalePercent / 100;
}

function getScaledNoteBounds() {
  const scale = getNoteScale();
  return {
    width: 206 * scale,
    height: 168 * scale
  };
}

function applyCanvasSize() {
  document.documentElement.style.setProperty("--canvas-width", `${canvasWidth}px`);
  document.documentElement.style.setProperty("--canvas-height", `${canvasHeight}px`);
}

function ensureCanvasForPosition(x, y, noteWidth, noteHeight) {
  const neededWidth = x + noteWidth + CANVAS_PADDING;
  const neededHeight = y + noteHeight + CANVAS_PADDING;
  let changed = false;

  while (neededWidth > canvasWidth) {
    canvasWidth += CANVAS_GROW_STEP;
    changed = true;
  }

  while (neededHeight > canvasHeight) {
    canvasHeight += CANVAS_GROW_STEP;
    changed = true;
  }

  if (changed) {
    applyCanvasSize();
  }
}

function applyGridSize() {
  document.documentElement.style.setProperty("--grid-size", `${gridSizePx}px`);
}

function applyNoteScale() {
  document.documentElement.style.setProperty("--note-scale", String(noteScalePercent / 100));
  if (noteScaleValue) {
    noteScaleValue.textContent = `${noteScalePercent}%`;
  }
}

function adjustNoteScale(direction) {
  noteScalePercent = clamp(noteScalePercent + direction * SCALE_STEP, SCALE_MIN, SCALE_MAX);

  applyNoteScale();
  renderBoard();
}

function openNotePreview(note) {
  if (!notePreview) {
    return;
  }

  if (notePreviewClosingTimer) {
    clearTimeout(notePreviewClosingTimer);
    notePreviewClosingTimer = null;
  }

  notePreview.classList.remove("hidden");
  requestAnimationFrame(() => {
    notePreview.classList.add("open");
  });
  notePreview.setAttribute("aria-hidden", "false");

  const previewSheet = notePreview.querySelector(".note-preview-sheet");
  if (previewSheet) {
    previewSheet.style.background = note.color;
  }

  activePreviewNoteId = note.id;
  isPreviewEditing = false;
  clearPendingPreviewUpdateTimer();

  notePreviewText.textContent = note.text;
  notePreviewDelegation.textContent = `Delegace: ${note.from} -> ${note.to}`;
  notePreviewDetails.textContent = `Priorita: ${formatPriorityLabel(note.priority)}${note.deadline ? ` | Termín: ${note.deadline}` : ""}${note.done ? " | Stav: Hotovo" : " | Stav: Aktivní"}`;
  notePreviewEditBtn?.classList.toggle("hidden", !canEditNote(note));
  notePreviewView?.classList.remove("hidden");
  notePreviewEditForm?.classList.add("hidden");
  if (notePreviewEditStatus) {
    notePreviewEditStatus.textContent = "";
    notePreviewEditStatus.classList.remove("is-error");
  }
}

function closeNotePreview() {
  if (!notePreview) {
    return;
  }

  activePreviewNoteId = null;
  isPreviewEditing = false;
  clearPendingPreviewUpdateTimer();
  if (notePreviewEditStatus) {
    notePreviewEditStatus.textContent = "";
    notePreviewEditStatus.classList.remove("is-error");
  }

  notePreview.classList.remove("open");
  notePreview.setAttribute("aria-hidden", "true");

  if (notePreviewClosingTimer) {
    clearTimeout(notePreviewClosingTimer);
  }

  notePreviewClosingTimer = window.setTimeout(() => {
    notePreview.classList.add("hidden");
    notePreviewClosingTimer = null;
  }, PREVIEW_ANIMATION_MS);
}

function getActivePreviewNote() {
  if (!activePreviewNoteId) {
    return null;
  }

  return notes.find((note) => note.id === activePreviewNoteId) || null;
}

function setPreviewEditStatus(message, isError = false) {
  if (!notePreviewEditStatus) {
    return;
  }

  notePreviewEditStatus.textContent = message;
  notePreviewEditStatus.classList.toggle("is-error", isError);
}

function clearPendingPreviewUpdateTimer() {
  if (pendingPreviewUpdateTimer) {
    clearTimeout(pendingPreviewUpdateTimer);
    pendingPreviewUpdateTimer = null;
  }
}

function clearPendingHoverPreviewTimer() {
  if (pendingHoverPreviewTimer) {
    clearTimeout(pendingHoverPreviewTimer);
    pendingHoverPreviewTimer = null;
  }
  pendingHoverPreviewNoteId = null;
}

function scheduleHoverPreview(noteId) {
  clearPendingHoverPreviewTimer();
  pendingHoverPreviewNoteId = noteId;
  pendingHoverPreviewTimer = window.setTimeout(() => {
    pendingHoverPreviewTimer = null;
    if (pendingHoverPreviewNoteId !== noteId) {
      return;
    }

    const currentNote = notes.find((item) => item.id === noteId);
    if (!currentNote) {
      clearPendingHoverPreviewTimer();
      return;
    }

    openNotePreview(currentNote);
    clearPendingHoverPreviewTimer();
  }, NOTE_HOVER_PREVIEW_DELAY_MS);
}

function renderPreviewEditPalette() {
  if (!notePreviewEditColorPalette) {
    return;
  }

  renderColorPalette(notePreviewEditColorPalette, noteColors, previewEditSelectedColor, (color) => {
    previewEditSelectedColor = color;
    renderPreviewEditPalette();
  });
}

function populatePreviewAssigneeSelect(selectedName) {
  if (!notePreviewEditTo) {
    return;
  }

  const names = getAssignableNames();
  const cleanSelected = String(selectedName || "").trim();
  if (cleanSelected && !names.some((name) => name.toLowerCase() === cleanSelected.toLowerCase())) {
    names.push(cleanSelected);
  }

  notePreviewEditTo.innerHTML = "";
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    notePreviewEditTo.append(option);
  });

  if (cleanSelected && names.includes(cleanSelected)) {
    notePreviewEditTo.value = cleanSelected;
  }
}

function refreshOpenPreview() {
  if (!notePreview || notePreview.classList.contains("hidden")) {
    return;
  }

  const note = getActivePreviewNote();
  if (!note) {
    closeNotePreview();
    return;
  }

  const previewSheet = notePreview.querySelector(".note-preview-sheet");
  if (previewSheet) {
    previewSheet.style.background = note.color;
  }

  notePreviewText.textContent = note.text;
  notePreviewDelegation.textContent = `Delegace: ${note.from} -> ${note.to}`;
  notePreviewDetails.textContent = `Priorita: ${formatPriorityLabel(note.priority)}${note.deadline ? ` | Termín: ${note.deadline}` : ""}${note.done ? " | Stav: Hotovo" : " | Stav: Aktivní"}`;
  notePreviewEditBtn?.classList.toggle("hidden", !canEditNote(note));

  if (isPreviewEditing) {
    notePreviewEditText.value = note.text;
    notePreviewEditFrom.value = note.from;
    populatePreviewAssigneeSelect(note.to);
    notePreviewEditPriority.value = ["Nizka", "Stredni", "Vysoka"].includes(note.priority)
      ? note.priority
      : "Stredni";
    notePreviewEditDeadline.value = note.deadline || "";
    previewEditSelectedColor = note.color || noteColors[0];
    renderPreviewEditPalette();
  }
}

function enterPreviewEditMode() {
  const note = getActivePreviewNote();
  if (!note || !canEditNote(note)) {
    return;
  }

  isPreviewEditing = true;
  notePreviewEditText.value = note.text;
  notePreviewEditFrom.value = note.from;
  populatePreviewAssigneeSelect(note.to);
  notePreviewEditPriority.value = ["Nizka", "Stredni", "Vysoka"].includes(note.priority)
    ? note.priority
    : "Stredni";
  notePreviewEditDeadline.value = note.deadline || "";
  previewEditSelectedColor = note.color || noteColors[0];
  renderPreviewEditPalette();
  setPreviewEditStatus("");
  notePreviewView?.classList.add("hidden");
  notePreviewEditForm?.classList.remove("hidden");
  notePreviewEditText.focus();
}

function exitPreviewEditMode() {
  clearPendingPreviewUpdateTimer();
  isPreviewEditing = false;
  setPreviewEditStatus("");
  notePreviewEditForm?.classList.add("hidden");
  notePreviewView?.classList.remove("hidden");
}

function setCreationControlsVisibility(isActive) {
  appShell?.classList.toggle("creating-item", isActive);
}

function applySnapState() {
  if (!snapToggle) {
    return;
  }

  snapToggle.textContent = snapEnabled ? "ON" : "OFF";
  snapToggle.classList.toggle("off", !snapEnabled);
}

function toggleSnap() {
  snapEnabled = !snapEnabled;
  applySnapState();
}

function closeDockPanel() {
  toolDockPanel?.classList.add("hidden");
  setCreationControlsVisibility(false);
  dockToggleNote?.classList.remove("active");
  dockToggleFilter?.classList.remove("active");
  dockToggleBoard?.classList.remove("active");
  dockToggleActions?.classList.remove("active");
}

function openDockSection(section) {
  if (!toolDockPanel) {
    return;
  }

  const isAlreadyOpen = !toolDockPanel.classList.contains("hidden");
  const activeBtn =
    (dockToggleNote?.classList.contains("active") && "note") ||
    (dockToggleFilter?.classList.contains("active") && "filter") ||
    (dockToggleBoard?.classList.contains("active") && "board") ||
    (dockToggleActions?.classList.contains("active") && "actions");

  if (isAlreadyOpen && activeBtn === section) {
    closeDockPanel();
    return;
  }

  toolDockPanel.classList.remove("hidden");
  dockSectionNote?.classList.toggle("hidden", section !== "note");
  dockSectionFilter?.classList.toggle("hidden", section !== "filter");
  dockSectionBoard?.classList.toggle("hidden", section !== "board");
  dockSectionActions?.classList.toggle("hidden", section !== "actions");

  dockToggleNote?.classList.toggle("active", section === "note");
  dockToggleFilter?.classList.toggle("active", section === "filter");
  dockToggleBoard?.classList.toggle("active", section === "board");
  dockToggleActions?.classList.toggle("active", section === "actions");
  setCreationControlsVisibility(section === "note");
}

function logoutLocally() {
  me = null;
  dragged = null;
  draggedElement = null;
  activePointerId = null;
  draggedBoardText = null;
  draggedBoardTextElement = null;
  activeTextPointerId = null;

  meBadge.textContent = "";
  logoutBtn?.classList.add("hidden");
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = "";
  loginPassword.value = "";
  loginEmail.value = "";
  loginEmailWrap?.classList.remove("hidden");
  noteText.value = "";
  sessionSaveStatus.textContent = "";
  setBoardActionStatus("");
  clearStoredSessionToken();
}

function applyAuthLandingMessage() {
  const params = new URLSearchParams(window.location.search);
  const registered = params.get("registered") === "1";
  const email = params.get("email");

  if (registered) {
    loginError.textContent = "Účet byl úspěšně vytvořen. Přihlas se.";
    loginError.classList.add("is-success");
  } else {
    loginError.classList.remove("is-success");
  }

  if (email && loginEmail) {
    loginEmail.value = email;
  }

  if (registered || email) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function upsertNote(next) {
  const index = notes.findIndex((note) => note.id === next.id);
  if (index === -1) {
    notes.push(next);
    return;
  }
  notes[index] = { ...notes[index], ...next };
}

function upsertBoardText(next) {
  const index = boardTexts.findIndex((item) => item.id === next.id);
  if (index === -1) {
    boardTexts.push(next);
    return;
  }
  boardTexts[index] = { ...boardTexts[index], ...next };
}

function renderColorPalette(target, colors, selected, onPick) {
  target.innerHTML = "";
  colors.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.style.background = color;
    if (color === selected) {
      swatch.classList.add("active");
    }
    swatch.addEventListener("click", () => onPick(color));
    target.append(swatch);
  });
}

function renderNotePalette() {
  renderColorPalette(palette, noteColors, selectedNoteColor, (color) => {
    selectedNoteColor = color;
    renderNotePalette();
  });
}

function renderBoardInlinePalette() {
  if (!boardInlinePalette) {
    return;
  }

  renderColorPalette(boardInlinePalette, noteColors, boardInlineSelectedColor, (color) => {
    boardInlineSelectedColor = color;
    renderBoardInlinePalette();
  });
}

function renderPresence() {
  presence.innerHTML = "";
  onlineUsers.forEach((user) => {
    const chip = document.createElement("span");
    chip.className = "user-chip";
    chip.style.borderColor = user.color;
    chip.textContent = `${user.name} online`;
    presence.append(chip);
  });
}

function getAssignableNames() {
  const mergedNames = [];
  const seen = new Set();

  const pushName = (value) => {
    const normalized = String(value || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      return;
    }
    seen.add(key);
    mergedNames.push(normalized);
  };

  registeredUsers.forEach((user) => {
    pushName(user?.name);
  });

  onlineUsers.forEach((user) => {
    pushName(user?.name);
  });

  pushName(me?.name);

  return mergedNames;
}

async function loadRegisteredUsers() {
  try {
    const response = await fetch("/api/users", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const users = Array.isArray(payload?.users) ? payload.users : [];
    registeredUsers = users.map((user) => ({
      name: String(user?.username || "").trim()
    }));
    renderUserSelects();
  } catch {
    // Keep working with online users when endpoint is unavailable.
  }
}

async function loadSnapshotOptions() {
  if (!restoreSnapshotSelect) {
    return;
  }

  restoreSnapshotSelect.innerHTML = "";

  try {
    const response = await fetch("/api/snapshots", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Snapshot list failed");
    }

    const payload = await response.json();
    const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];

    if (snapshots.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Žádná záloha není k dispozici";
      restoreSnapshotSelect.append(option);
      restoreSnapshotBtn?.setAttribute("disabled", "disabled");
      return;
    }

    snapshots.forEach((snapshot) => {
      const option = document.createElement("option");
      option.value = snapshot.id;
      const date = snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString("cs-CZ") : "bez data";
      option.textContent = `${date} - ${snapshot.noteCount || 0} lístků, ${snapshot.textCount || 0} textů`;
      restoreSnapshotSelect.append(option);
    });
    restoreSnapshotBtn?.removeAttribute("disabled");
  } catch {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Zálohy se nepodařilo načíst";
    restoreSnapshotSelect.append(option);
    restoreSnapshotBtn?.setAttribute("disabled", "disabled");
  }
}

function renderUserSelects() {
  const previousTo = toUser.value;
  const previousBoardInlineTo = boardInlineToUser?.value || "";
  const previousFilter = assigneeFilter.value;
  const assignableNames = getAssignableNames();

  toUser.innerHTML = "";
  assignableNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    toUser.append(option);
  });

  if (previousTo && assignableNames.includes(previousTo)) {
    toUser.value = previousTo;
  } else if (me) {
    toUser.value = me.name;
  } else if (assignableNames.length > 0) {
    toUser.value = assignableNames[0];
  }

  if (boardInlineToUser) {
    boardInlineToUser.innerHTML = "";
    assignableNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      boardInlineToUser.append(option);
    });

    if (previousBoardInlineTo && assignableNames.includes(previousBoardInlineTo)) {
      boardInlineToUser.value = previousBoardInlineTo;
    } else if (toUser.value && assignableNames.includes(toUser.value)) {
      boardInlineToUser.value = toUser.value;
    } else if (me) {
      boardInlineToUser.value = me.name;
    } else if (assignableNames.length > 0) {
      boardInlineToUser.value = assignableNames[0];
    }
  }

  assigneeFilter.innerHTML = "";
  ["Vsechny", ...assignableNames].forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = formatAssigneeFilterLabel(name);
    assigneeFilter.append(option);
  });

  if (previousFilter && ["Vsechny", ...assignableNames].includes(previousFilter)) {
    assigneeFilter.value = previousFilter;
  }

  if (activePreviewNoteId && isPreviewEditing) {
    const note = getActivePreviewNote();
    if (note) {
      populatePreviewAssigneeSelect(note.to);
    }
  }
}

function renderActivity(items) {
  activityList.innerHTML = "";
  items.slice(0, 12).forEach((entry) => {
    const row = document.createElement("li");
    const timestamp = [entry.date, entry.time].filter(Boolean).join(" ");
    row.textContent = `${timestamp} - ${entry.message}`;
    activityList.append(row);
  });
}

function setBoardActionStatus(message, isError = false) {
  boardActionStatus.textContent = message;
  boardActionStatus.classList.toggle("is-error", isError);
}

function isMyNote(note) {
  if (!me) {
    return false;
  }
  if (me.role === "admin") {
    return true;
  }
  return (note.ownerId || note.ownerEmail || note.owner || note.from) === (me.email || me.name);
}

function canEditNote(note) {
  return isMyNote(note);
}

function canToggleNote(note) {
  if (!me) {
    return false;
  }

  if (me.role === "admin") {
    return true;
  }

  if (isMyNote(note)) {
    return true;
  }

  return String(note.to || "").trim().toLowerCase() === String(me.name || "").trim().toLowerCase();
}

function canMoveNote(_note) {
  return Boolean(me);
}

function getSelectedMovableNotes() {
  return notes.filter((note) => selectedNoteIds.has(note.id) && !note.done && canMoveNote(note));
}

function clearSelection() {
  selectedNoteIds = new Set();
  boardCanvas.querySelectorAll(".sticky.selected").forEach((stickyEl) => {
    stickyEl.classList.remove("selected");
  });
}

function deleteSelectedNotes() {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  const ids = Array.from(selectedNoteIds);
  if (ids.length === 0) {
    setBoardActionStatus("Nejdřív označ lístky pro hromadné smazání.");
    return;
  }

  const ok = window.confirm(`Opravdu smazat vybrané lístky (${ids.length})?`);
  if (!ok) {
    return;
  }

  socket.emit("note:deleteMany", { ids }, (response) => {
    if (!response?.ok) {
      setBoardActionStatus(response?.message || "Hromadné smazání vybraných lístků se nepodařilo.", true);
      return;
    }

    const removedCount = Number(response?.removedCount || 0);
    const deniedCount = Number(response?.deniedCount || 0);
    if (removedCount === 0) {
      setBoardActionStatus(
        deniedCount > 0
          ? "Vybrané lístky nemůžeš smazat (nejsi autor nebo admin)."
          : "Vybrané lístky už neexistují.",
        deniedCount > 0
      );
      return;
    }

    setBoardActionStatus(
      deniedCount > 0
        ? `Smazáno vybraných lístků: ${removedCount}. Přeskočeno bez oprávnění: ${deniedCount}.`
        : `Smazáno vybraných lístků: ${removedCount}.`
    );
  });
}

function markSelectedNotesDone() {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  const ids = Array.from(selectedNoteIds);
  if (ids.length === 0) {
    setBoardActionStatus("Nejdřív označ lístky.");
    return;
  }

  socket.emit("note:markManyDone", { ids }, (response) => {
    if (!response?.ok) {
      setBoardActionStatus(response?.message || "Hromadné označení jako hotové se nepodařilo.", true);
      return;
    }

    const updatedCount = Number(response?.updatedCount || 0);
    const deniedCount = Number(response?.deniedCount || 0);
    const alreadyDoneCount = Number(response?.alreadyDoneCount || 0);

    if (updatedCount === 0) {
      if (deniedCount > 0) {
        setBoardActionStatus("Vybrané lístky nemůžeš označit jako hotové.", true);
        return;
      }

      if (alreadyDoneCount > 0) {
        setBoardActionStatus("Vybrané lístky už jsou hotové.");
        return;
      }

      setBoardActionStatus("Vybrané lístky už neexistují.");
      return;
    }

    const details = [];
    if (alreadyDoneCount > 0) {
      details.push(`už hotové: ${alreadyDoneCount}`);
    }
    if (deniedCount > 0) {
      details.push(`bez oprávnění: ${deniedCount}`);
    }

    setBoardActionStatus(
      details.length > 0
        ? `Označeno jako hotové: ${updatedCount} (${details.join(", ")}).`
        : `Označeno jako hotové: ${updatedCount}.`
    );
  });
}

function isMyBoardText(item) {
  if (!me) {
    return false;
  }
  if (me.role === "admin") {
    return true;
  }
  return (item.ownerId || item.ownerEmail || item.owner || item.author) === (me.email || me.name);
}

async function pasteTextToTextarea(targetTextarea, successMessage) {
  if (!targetTextarea) {
    return;
  }

  if (!navigator.clipboard?.readText) {
    setBoardActionStatus("Vkládání ze schránky není v tomto prohlížeči podporováno.", true);
    return;
  }

  try {
    const clipboardText = (await navigator.clipboard.readText()).trim();
    if (!clipboardText) {
      setBoardActionStatus("Schránka je prázdná.", true);
      return;
    }

    targetTextarea.value = clipboardText;
    targetTextarea.focus();
    setBoardActionStatus(successMessage || "Text byl vložen do lístku.");
  } catch {
    setBoardActionStatus("Nepodařilo se načíst text ze schránky.", true);
  }
}

async function pasteTextToNoteInput() {
  await pasteTextToTextarea(noteText, "Text byl vložen do lístku.");
}

function insertTextAtCursor(targetTextarea, text) {
  if (!targetTextarea || !text) {
    return;
  }

  const start = Number.isFinite(targetTextarea.selectionStart) ? targetTextarea.selectionStart : targetTextarea.value.length;
  const end = Number.isFinite(targetTextarea.selectionEnd) ? targetTextarea.selectionEnd : start;
  const before = targetTextarea.value.slice(0, start);
  const after = targetTextarea.value.slice(end);
  targetTextarea.value = `${before}${text}${after}`;
  const nextCursor = start + text.length;
  targetTextarea.focus();
  targetTextarea.setSelectionRange(nextCursor, nextCursor);
}

function renderEmojiPalettes() {
  document.querySelectorAll(".emoji-palette").forEach((paletteEl) => {
    paletteEl.innerHTML = "";
    EMOJI_OPTIONS.forEach((emoji) => {
      const button = document.createElement("button");
      button.className = "emoji-btn";
      button.type = "button";
      button.dataset.emoji = emoji;
      button.textContent = emoji;
      button.setAttribute("aria-label", `Vložit ${emoji}`);
      paletteEl.append(button);
    });
  });
}

function getEmojiTargetTextarea(button) {
  if (!button) {
    return null;
  }

  if (button.closest("#note-form")) {
    return noteText;
  }

  if (button.closest("#board-inline-composer")) {
    return boardInlineText;
  }

  if (button.closest("#note-preview-edit-form")) {
    return notePreviewEditText;
  }

  return null;
}

function getVisibleNotes() {
  const filter = assigneeFilter.value || "Vsechny";
  return notes.filter((note) => filter === "Vsechny" || note.to === filter);
}

function openBoardQuickCreateAt(clientX, clientY) {
  if (!boardQuickCreate) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const chooserBounds = { width: 250, height: 92 };
  const rawX = clientX - boardRect.left + board.scrollLeft;
  const rawY = clientY - boardRect.top + board.scrollTop;
  const maxX = Math.max(0, canvasWidth - chooserBounds.width);
  const maxY = Math.max(0, canvasHeight - chooserBounds.height);

  const x = clamp(rawX, 0, maxX);
  const y = clamp(rawY, 0, maxY);

  boardQuickCreateDraftPosition = { x, y };
  boardQuickCreate.style.left = `${x}px`;
  boardQuickCreate.style.top = `${y}px`;
  boardQuickCreate.classList.remove("hidden");
}

function closeBoardQuickCreate() {
  if (!boardQuickCreate) {
    return;
  }

  boardQuickCreate.classList.add("hidden");
  boardQuickCreateDraftPosition = null;
}

function openBoardInlineComposerAtPosition(x, y, mode = "text") {
  if (!boardInlineComposer || !boardInlineText) {
    return;
  }

  const isNoteMode = mode === "note";
  const composerBounds = isNoteMode ? { width: 328, height: 430 } : { width: 300, height: 190 };
  const maxX = Math.max(0, canvasWidth - composerBounds.width);
  const maxY = Math.max(0, canvasHeight - composerBounds.height);

  boardInlineCreateMode = isNoteMode ? "note" : "text";
  boardInlineDraftPosition = {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY)
  };

  boardInlineComposer.style.left = `${boardInlineDraftPosition.x}px`;
  boardInlineComposer.style.top = `${boardInlineDraftPosition.y}px`;
  boardInlineComposer.classList.remove("hidden");
  boardInlineComposer.dataset.mode = boardInlineCreateMode;
  setCreationControlsVisibility(true);
  boardInlineText.value = "";
  if (boardInlineTitle) {
    boardInlineTitle.textContent = boardInlineCreateMode === "note" ? NOTE_FORM_TITLE : BOARD_TEXT_TITLE;
  }
  if (boardInlineControlTitle) {
    boardInlineControlTitle.textContent =
      boardInlineCreateMode === "note" ? NOTE_FORM_CONTROL_TITLE : BOARD_TEXT_CONTROL_TITLE;
  }
  boardInlineText.placeholder =
    boardInlineCreateMode === "note" ? NOTE_FORM_TEXT_PLACEHOLDER : BOARD_TEXT_PLACEHOLDER;
  if (boardInlineNoteFields) {
    boardInlineNoteFields.classList.toggle("hidden", boardInlineCreateMode !== "note");
  }
  if (boardInlineFromUser) {
    boardInlineFromUser.value = me?.name || "";
  }
  if (boardInlineToUser && boardInlineCreateMode === "note") {
    const fallbackTo = toUser.value || me?.name || boardInlineToUser.value;
    if (fallbackTo) {
      boardInlineToUser.value = fallbackTo;
    }
  }
  if (boardInlinePriority && boardInlineCreateMode === "note") {
    boardInlinePriority.value = priority.value || "Stredni";
  }
  if (boardInlineDeadline && boardInlineCreateMode === "note") {
    boardInlineDeadline.value = deadline.value || "";
  }
  boardInlineSelectedColor = selectedNoteColor;
  renderBoardInlinePalette();
  if (boardInlineSubmit) {
    boardInlineSubmit.textContent = boardInlineCreateMode === "note" ? "Přidat lístek" : "Přidat text";
  }
  boardInlineText.focus();
}

function closeBoardInlineComposer() {
  if (!boardInlineComposer || !boardInlineText) {
    return;
  }

  boardInlineComposer.classList.add("hidden");
  boardInlineComposer.dataset.mode = "";
  boardInlineText.value = "";
  if (boardInlineDeadline) {
    boardInlineDeadline.value = "";
  }
  boardInlineDraftPosition = null;
  boardInlineCreateMode = "text";
  setCreationControlsVisibility(false);
}

function updateDonePositionHints() {
  if (!board || !donePositionText) {
    return;
  }

  const thresholdPx = 1;
  const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
  const maxScrollTop = Math.max(0, board.scrollHeight - board.clientHeight);
  const canScrollHorizontally = maxScrollLeft > thresholdPx;
  const canScrollVertically = maxScrollTop > thresholdPx;
  const showLeftNav = canScrollHorizontally && board.scrollLeft > thresholdPx;
  const showRightNav = canScrollHorizontally && board.scrollLeft < maxScrollLeft - thresholdPx;
  const showUpNav = canScrollVertically && board.scrollTop > thresholdPx;
  const showDownNav = canScrollVertically && board.scrollTop < maxScrollTop - thresholdPx;

  boardArrowLeft?.classList.toggle("hidden", !showLeftNav);
  boardArrowRight?.classList.toggle("hidden", !showRightNav);
  boardArrowUp?.classList.toggle("hidden", !showUpNav);
  boardArrowDown?.classList.toggle("hidden", !showDownNav);

  const doneNotes = notes.filter((note) => note.done);
  if (doneNotes.length === 0) {
    donePositionText.classList.add("hidden");
    return;
  }

  donePositionText.classList.remove("hidden");

  const bounds = getScaledNoteBounds();
  const doneMinX = Math.min(...doneNotes.map((note) => note.x));
  const doneMaxX = Math.max(...doneNotes.map((note) => note.x + bounds.width));
  const doneMinY = Math.min(...doneNotes.map((note) => note.y));
  const doneMaxY = Math.max(...doneNotes.map((note) => note.y + bounds.height));
  const viewLeft = board.scrollLeft;
  const viewRight = board.scrollLeft + board.clientWidth;
  const viewTop = board.scrollTop;
  const viewBottom = board.scrollTop + board.clientHeight;

  const hints = [];

  if (doneMinX > viewRight) {
    hints.push("vpravo");
  }

  if (doneMaxX < viewLeft) {
    hints.push("vlevo");
  }

  if (doneMinY > viewBottom) {
    hints.push("dole");
  }

  if (doneMaxY < viewTop) {
    hints.push("nahoře");
  }

  if (hints.length === 0) {
    donePositionText.textContent = "Hotové lístky jsou právě v aktuálním pohledu. Klikni pro přesun.";
    return;
  }

  donePositionText.textContent = `Hotové lístky jsou mimo aktuální výřez: ${hints.join(", ")}. Klikni pro přesun.`;
}

function navigateToDoneNotes() {
  if (!board) {
    return;
  }

  const doneNotes = notes.filter((note) => note.done);
  if (doneNotes.length === 0) {
    return;
  }

  const bounds = getScaledNoteBounds();
  const doneMinX = Math.min(...doneNotes.map((note) => note.x));
  const doneMaxX = Math.max(...doneNotes.map((note) => note.x + bounds.width));
  const doneMinY = Math.min(...doneNotes.map((note) => note.y));
  const doneMaxY = Math.max(...doneNotes.map((note) => note.y + bounds.height));

  const targetLeft = Math.max(0, doneMinX - Math.max(40, Math.round((board.clientWidth - (doneMaxX - doneMinX)) / 2)));
  const targetTop = Math.max(0, doneMinY - Math.max(40, Math.round((board.clientHeight - (doneMaxY - doneMinY)) / 2)));

  board.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
}

function submitBoardInlineComposer() {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  if (!boardInlineText || !boardInlineDraftPosition) {
    return;
  }

  const text = boardInlineText.value.trim();
  if (!text) {
    setBoardActionStatus("Doplň text na plochu.", true);
    return;
  }

  const nextX = boardInlineDraftPosition.x;
  const nextY = boardInlineDraftPosition.y;

  if (boardInlineCreateMode === "note") {
    const toValue = boardInlineToUser?.value || toUser.value || me.name;
    const priorityValue = boardInlinePriority?.value || priority.value || "Stredni";
    const deadlineValue = boardInlineDeadline?.value || "";
    socket.emit("note:create", {
      text,
      from: me.name,
      to: toValue,
      priority: priorityValue,
      deadline: deadlineValue,
      color: boardInlineSelectedColor,
      x: snapToGrid(nextX),
      y: snapToGrid(nextY)
    });

    // Keep menu form state aligned with values used from board inline composer.
    if (toUser) {
      toUser.value = toValue;
    }
    if (priority) {
      priority.value = priorityValue;
    }
    if (deadline) {
      deadline.value = deadlineValue;
    }
    selectedNoteColor = boardInlineSelectedColor;
    renderNotePalette();
  } else {
    socket.emit("text:create", {
      text,
      author: me.name,
      x: nextX,
      y: nextY
    });
  }

  closeBoardInlineComposer();
}

function createBoardTextElement(item) {
  const textEl = document.createElement("div");
  textEl.className = "board-text-node";
  textEl.dataset.id = item.id;
  textEl.style.left = `${item.x}px`;
  textEl.style.top = `${item.y}px`;
  textEl.title = `${item.author || "Uživatel"}: ${item.text}`;

  const textBody = document.createElement("span");
  textBody.className = "board-text-body";
  textBody.textContent = item.text;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "board-text-delete";
  deleteBtn.textContent = "x";
  deleteBtn.setAttribute("aria-label", "Smazat text");
  deleteBtn.title = "Smazat text";

  const canDelete = isMyBoardText(item);
  if (!canDelete) {
    deleteBtn.classList.add("hidden");
  }

  deleteBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const ok = window.confirm("Opravdu smazat tento text z plochy?");
    if (!ok) {
      return;
    }

    socket.emit("text:delete", { id: item.id }, (response) => {
      if (!response?.ok && response?.message) {
        setBoardActionStatus(response.message, true);
      }
    });
  });

  textEl.append(textBody, deleteBtn);

  textEl.addEventListener("pointerdown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".board-text-delete")) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    draggedBoardText = item;
    draggedBoardTextElement = textEl;
    activeTextPointerId = event.pointerId;

    const boardRect = board.getBoundingClientRect();
    textDragOffset.x = event.clientX - boardRect.left - item.x + board.scrollLeft;
    textDragOffset.y = event.clientY - boardRect.top - item.y + board.scrollTop;

    textEl.style.zIndex = "18";
    textEl.setPointerCapture(event.pointerId);
  });

  return textEl;
}

function getClientDoneLanePosition(currentNoteId) {
  const doneWithoutCurrent = notes
    .filter((note) => note.done && note.id !== currentNoteId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const activeNotes = notes.filter((note) => !note.done);

  const index = doneWithoutCurrent.length;
  const ring = Math.floor(index / CLIENT_DONE_OVAL_POINTS_PER_RING);
  const slot = index % CLIENT_DONE_OVAL_POINTS_PER_RING;
  const angle = -Math.PI / 2 + (slot / CLIENT_DONE_OVAL_POINTS_PER_RING) * Math.PI * 2;
  const radiusX = CLIENT_DONE_OVAL_RADIUS_X + ring * CLIENT_DONE_OVAL_RING_STEP_X;
  const radiusY = CLIENT_DONE_OVAL_RADIUS_Y + ring * CLIENT_DONE_OVAL_RING_STEP_Y;
  const activeRightEdge =
    activeNotes.length > 0 ? Math.max(...activeNotes.map((note) => note.x + NOTE_BASE_WIDTH * getNoteScale())) : 0;
  const minLeftEdgeForDone = activeRightEdge + CLIENT_DONE_ACTIVE_GAP_PX;
  const doneCenterX = Math.max(CLIENT_DONE_OVAL_BASE_CENTER_X, minLeftEdgeForDone + radiusX);

  return {
    x: Math.round(doneCenterX + Math.cos(angle) * radiusX),
    y: Math.round(CLIENT_DONE_OVAL_CENTER_Y + Math.sin(angle) * radiusY)
  };
}

function getAlignmentItems(kind, currentId) {
  const noteBounds = getScaledNoteBounds();
  const visibleNotes = getVisibleNotes().map((note) => ({
    id: note.id,
    kind: "note",
    x: note.x,
    y: note.y,
    width: noteBounds.width,
    height: noteBounds.height
  }));

  const textItems = boardTexts.map((item) => ({
    id: item.id,
    kind: "text",
    x: item.x,
    y: item.y,
    width: BOARD_TEXT_WIDTH,
    height: BOARD_TEXT_HEIGHT
  }));

  return [...visibleNotes, ...textItems].filter((item) => !(item.kind === kind && item.id === currentId));
}

function ensureSelectionRect() {
  if (!boardCanvas) {
    return;
  }

  if (!selectionRectEl || !boardCanvas.contains(selectionRectEl)) {
    selectionRectEl = document.createElement("div");
    selectionRectEl.className = "selection-rect hidden";
    boardCanvas.append(selectionRectEl);
  }
}

function clearSelectionVisual() {
  if (selectionRectEl) {
    selectionRectEl.classList.add("hidden");
  }
}

function updateSelectionRectVisual() {
  if (!selectionStart || !selectionCurrent) {
    return;
  }

  ensureSelectionRect();
  if (!selectionRectEl) {
    return;
  }

  const left = Math.min(selectionStart.x, selectionCurrent.x);
  const top = Math.min(selectionStart.y, selectionCurrent.y);
  const width = Math.abs(selectionCurrent.x - selectionStart.x);
  const height = Math.abs(selectionCurrent.y - selectionStart.y);

  selectionRectEl.style.left = `${left}px`;
  selectionRectEl.style.top = `${top}px`;
  selectionRectEl.style.width = `${width}px`;
  selectionRectEl.style.height = `${height}px`;
  selectionRectEl.classList.remove("hidden");
}

function updateSelectedNotesByArea() {
  if (!selectionStart || !selectionCurrent) {
    return;
  }

  const left = Math.min(selectionStart.x, selectionCurrent.x);
  const top = Math.min(selectionStart.y, selectionCurrent.y);
  const right = Math.max(selectionStart.x, selectionCurrent.x);
  const bottom = Math.max(selectionStart.y, selectionCurrent.y);
  const bounds = getScaledNoteBounds();
  const selected = new Set();

  getVisibleNotes().forEach((note) => {
    const noteLeft = note.x;
    const noteTop = note.y;
    const noteRight = note.x + bounds.width;
    const noteBottom = note.y + bounds.height;
    const intersects = noteLeft < right && noteRight > left && noteTop < bottom && noteBottom > top;

    if (intersects) {
      selected.add(note.id);
    }
  });

  selectedNoteIds = selected;
  boardCanvas.querySelectorAll(".sticky").forEach((stickyEl) => {
    const isSelected = selectedNoteIds.has(stickyEl.dataset.id || "");
    stickyEl.classList.toggle("selected", isSelected);
  });
}

function ensureGuideElements() {
  if (!boardCanvas) {
    return;
  }

  if (!verticalGuideEl || !boardCanvas.contains(verticalGuideEl)) {
    verticalGuideEl = document.createElement("div");
    verticalGuideEl.className = "alignment-guide vertical";
    boardCanvas.append(verticalGuideEl);
  }

  if (!horizontalGuideEl || !boardCanvas.contains(horizontalGuideEl)) {
    horizontalGuideEl = document.createElement("div");
    horizontalGuideEl.className = "alignment-guide horizontal";
    boardCanvas.append(horizontalGuideEl);
  }
}

function hideAlignmentGuides() {
  verticalGuideEl?.classList.remove("active");
  horizontalGuideEl?.classList.remove("active");
}

function updateAlignmentGuides(dragX, dragY, bounds, kind, currentId) {
  ensureGuideElements();

  const alignedItems = getAlignmentItems(kind, currentId);
  if (alignedItems.length === 0) {
    hideAlignmentGuides();
    return { x: dragX, y: dragY };
  }

  const dragLeft = dragX;
  const dragRight = dragX + bounds.width;
  const dragTop = dragY;
  const dragBottom = dragY + bounds.height;
  let snappedX = dragX;
  let snappedY = dragY;

  let bestVertical = null;
  let bestHorizontal = null;

  alignedItems.forEach((item) => {
    const otherLeft = item.x;
    const otherRight = item.x + item.width;
    const otherTop = item.y;
    const otherBottom = item.y + item.height;

    [otherLeft, otherRight].forEach((xEdge) => {
      [
        { edge: dragLeft, side: "left" },
        { edge: dragRight, side: "right" }
      ].forEach(({ edge, side }) => {
        const diff = Math.abs(edge - xEdge);
        if (diff <= ALIGN_THRESHOLD_PX && (!bestVertical || diff < bestVertical.diff)) {
          bestVertical = {
            diff,
            x: xEdge,
            targetX: side === "left" ? xEdge : xEdge - bounds.width,
            otherTop,
            otherBottom
          };
        }
      });
    });

    [otherTop, otherBottom].forEach((yEdge) => {
      [
        { edge: dragTop, side: "top" },
        { edge: dragBottom, side: "bottom" }
      ].forEach(({ edge, side }) => {
        const diff = Math.abs(edge - yEdge);
        if (diff <= ALIGN_THRESHOLD_PX && (!bestHorizontal || diff < bestHorizontal.diff)) {
          bestHorizontal = {
            diff,
            y: yEdge,
            targetY: side === "top" ? yEdge : yEdge - bounds.height,
            otherLeft,
            otherRight
          };
        }
      });
    });
  });

  if (bestVertical) {
    snappedX = bestVertical.targetX;
    const guideTop = Math.min(snappedY, bestVertical.otherTop);
    const guideBottom = Math.max(snappedY + bounds.height, bestVertical.otherBottom);
    verticalGuideEl.style.left = `${bestVertical.x}px`;
    verticalGuideEl.style.top = `${guideTop}px`;
    verticalGuideEl.style.height = `${Math.max(10, guideBottom - guideTop)}px`;
    verticalGuideEl.classList.add("active");
  } else {
    verticalGuideEl.classList.remove("active");
  }

  if (bestHorizontal) {
    snappedY = bestHorizontal.targetY;
    const guideLeft = Math.min(snappedX, bestHorizontal.otherLeft);
    const guideRight = Math.max(snappedX + bounds.width, bestHorizontal.otherRight);
    horizontalGuideEl.style.left = `${guideLeft}px`;
    horizontalGuideEl.style.top = `${bestHorizontal.y}px`;
    horizontalGuideEl.style.width = `${Math.max(10, guideRight - guideLeft)}px`;
    horizontalGuideEl.classList.add("active");
  } else {
    horizontalGuideEl.classList.remove("active");
  }

  return { x: snappedX, y: snappedY };
}

function createStickyElement(note) {
  const fragment = noteTemplate.content.cloneNode(true);
  const sticky = fragment.querySelector(".sticky");
  const text = fragment.querySelector(".sticky-text");
  const delegation = fragment.querySelector(".delegation");
  const details = fragment.querySelector(".details");
  const doneToggle = fragment.querySelector(".done-toggle");
  const deleteToggle = fragment.querySelector(".delete-toggle");

  sticky.dataset.id = note.id;
  sticky.style.background = note.color;
  sticky.style.left = `${note.x}px`;
  sticky.style.top = `${note.y}px`;
  sticky.style.setProperty("--tilt", `${Math.random() * 6 - 3}deg`);

  text.textContent = note.text;
  delegation.textContent = `${note.from} -> ${note.to}`;
  details.textContent = `P:${formatPriorityLabel(note.priority)}${note.deadline ? ` | T:${note.deadline}` : ""}`;
  text.title = note.text;
  delegation.title = `Delegace: ${note.from} -> ${note.to}`;
  details.title = `Priorita: ${formatPriorityLabel(note.priority)}${note.deadline ? ` | Termín: ${note.deadline}` : ""}`;
  doneToggle.textContent = note.done ? "Obnovit" : "Hotovo";
  sticky.classList.toggle("done", note.done);
  sticky.classList.toggle("selected", selectedNoteIds.has(note.id));

  const canDelete = isMyNote(note);
  if (!canDelete) {
    deleteToggle.classList.add("hidden");
  }

  if (!canToggleNote(note)) {
    doneToggle.classList.add("hidden");
  }

  if (canToggleNote(note)) {
    doneToggle.addEventListener("click", () => {
      socket.emit("note:toggle", { id: note.id }, (response) => {
        if (!response?.ok && response?.message) {
          setBoardActionStatus(response.message, true);
        }
      });
    });
  }

  deleteToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const ok = window.confirm("Opravdu smazat tento lístek?");
    if (!ok) {
      return;
    }

    if (pendingDeleteTimer) {
      clearTimeout(pendingDeleteTimer);
    }

    pendingDeleteId = note.id;
    setBoardActionStatus("Mazání lístku...", false);

    pendingDeleteTimer = window.setTimeout(() => {
      const stillExists = notes.some((item) => item.id === pendingDeleteId);
      if (stillExists) {
        setBoardActionStatus("Smazání se nepodařilo. Zkus to znovu.", true);
      }
      pendingDeleteId = null;
      pendingDeleteTimer = null;
    }, 3500);

    socket.emit("note:delete", { id: note.id }, (response) => {
      if (!response?.ok && response?.message) {
        setBoardActionStatus(response.message, true);
      }
    });
  });

  sticky.addEventListener("pointerdown", (event) => {
    if (note.done || !canMoveNote(note)) {
      return;
    }

    if (event.target.closest(".done-toggle") || event.target.closest(".delete-toggle") || event.button !== 0) {
      return;
    }

    dragged = note;
    draggedElement = sticky;
    activePointerId = event.pointerId;

    const boardRect = board.getBoundingClientRect();
    dragOffset.x = event.clientX - boardRect.left - note.x + board.scrollLeft;
    dragOffset.y = event.clientY - boardRect.top - note.y + board.scrollTop;

    const selectedMovable = getSelectedMovableNotes();
    if (selectedNoteIds.has(note.id) && selectedMovable.length > 1) {
      draggedSelection = selectedMovable.map((item) => ({
        note: item,
        startX: item.x,
        startY: item.y,
        element: boardCanvas.querySelector(`.sticky[data-id="${item.id}"]`)
      }));

      draggedSelection.forEach((entry) => {
        if (entry.element) {
          entry.element.style.zIndex = "10";
        }
      });
    } else {
      draggedSelection = null;
    }

    sticky.style.zIndex = "10";
    sticky.setPointerCapture(event.pointerId);
  });

  sticky.addEventListener("dblclick", (event) => {
    if (event.target.closest(".done-toggle") || event.target.closest(".delete-toggle") || event.target.closest(".pin")) {
      return;
    }
    openNotePreview(note);
  });

  sticky.addEventListener("pointerenter", (event) => {
    if (!me) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".done-toggle") || target.closest(".delete-toggle")) {
      return;
    }

    scheduleHoverPreview(note.id);
  });

  sticky.addEventListener("pointermove", () => {
    if (pendingHoverPreviewNoteId !== note.id) {
      return;
    }

    scheduleHoverPreview(note.id);
  });

  sticky.addEventListener("pointerleave", () => {
    if (pendingHoverPreviewNoteId === note.id) {
      clearPendingHoverPreviewTimer();
    }
  });

  return sticky;
}

function renderBoard() {
  boardCanvas.querySelectorAll(".sticky, .board-text-node").forEach((item) => {
    item.remove();
  });

  boardTexts.forEach((item) => {
    boardCanvas.append(createBoardTextElement(item));
  });

  getVisibleNotes().forEach((note) => {
    boardCanvas.append(createStickyElement(note));
  });

  ensureGuideElements();
  hideAlignmentGuides();
  ensureSelectionRect();
  clearSelectionVisual();
  updateDonePositionHints();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.textContent = "";
  loginError.classList.remove("is-success");

  const password = loginPassword.value.trim();
  const email = loginEmail.value.trim();

  if (!email || !password) {
    loginError.textContent = "Vyplň e-mail a heslo.";
    return;
  }

  socket.emit("auth:login", {
    email,
    password
  });
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!me) {
    return;
  }

  const text = noteText.value.trim();
  if (!text) {
    return;
  }

  socket.emit("note:create", {
    text,
    from: me.name,
    to: toUser.value,
    priority: priority.value,
    deadline: deadline.value,
    color: selectedNoteColor,
    x: snapToGrid(80 + Math.random() * 460),
    y: snapToGrid(70 + Math.random() * 240)
  });

  noteForm.reset();
  fromUser.value = me.name;
  selectedNoteColor = noteColors[0];
  renderNotePalette();
  closeDockPanel();
});

boardCanvas?.addEventListener("dblclick", (event) => {
  if (!me) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (
    target.closest(".sticky") ||
    target.closest(".board-inline-composer") ||
    target.closest(".board-text-node") ||
    target.closest(".board-quick-create")
  ) {
    return;
  }

  event.preventDefault();
  closeNotePreview();
  closeBoardInlineComposer();
  openBoardQuickCreateAt(event.clientX, event.clientY);
});

boardCanvas?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (
    target.closest(".sticky") ||
    target.closest(".board-text-node") ||
    target.closest(".board-inline-composer") ||
    target.closest(".board-quick-create") ||
    target.closest(".done-position-text")
  ) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  selectionPointerId = event.pointerId;
  selectionStart = {
    x: event.clientX - boardRect.left + board.scrollLeft,
    y: event.clientY - boardRect.top + board.scrollTop
  };
  selectionCurrent = { ...selectionStart };
  updateSelectionRectVisual();
  updateSelectedNotesByArea();
  event.preventDefault();
});

assigneeFilter.addEventListener("change", renderBoard);

dockToggleNote?.addEventListener("click", () => {
  openDockSection("note");
});

dockToggleFilter?.addEventListener("click", () => {
  openDockSection("filter");
});

dockToggleBoard?.addEventListener("click", () => {
  openDockSection("board");
});

dockToggleActions?.addEventListener("click", () => {
  openDockSection("actions");
});

noteScaleMinus?.addEventListener("click", () => {
  adjustNoteScale(-1);
});

noteScalePlus?.addEventListener("click", () => {
  adjustNoteScale(1);
});

snapToggle?.addEventListener("click", () => {
  toggleSnap();
});

logoutBtn?.addEventListener("click", () => {
  if (me) {
    socket.emit("auth:logout");
  }
  logoutLocally();
});

notePreview?.addEventListener("click", (event) => {
  const shouldClose = event.target instanceof HTMLElement && event.target.dataset.closePreview === "true";
  if (shouldClose) {
    closeNotePreview();
  }
});

notePreviewClose?.addEventListener("click", () => {
  closeNotePreview();
});

notePreviewEditBtn?.addEventListener("click", () => {
  enterPreviewEditMode();
});

notePreviewCancelBtn?.addEventListener("click", () => {
  exitPreviewEditMode();
  refreshOpenPreview();
});

notePreviewEditForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const note = getActivePreviewNote();
  if (!note) {
    setPreviewEditStatus("Lístek už neexistuje.", true);
    return;
  }

  if (!canEditNote(note)) {
    setPreviewEditStatus("Tento lístek může upravit jen autor nebo admin.", true);
    return;
  }

  if (!socket.connected) {
    setPreviewEditStatus("Spojení se serverem není aktivní. Obnov stránku nebo restartuj server.", true);
    return;
  }

  const text = notePreviewEditText.value.trim();
  if (!text) {
    setPreviewEditStatus("Doplň text lístku.", true);
    return;
  }

  setPreviewEditStatus("Ukládám změny...");
  clearPendingPreviewUpdateTimer();
  pendingPreviewUpdateTimer = window.setTimeout(() => {
    pendingPreviewUpdateTimer = null;
    setPreviewEditStatus("Server neodpověděl na uložení. Zkus to znovu nebo restartuj backend.", true);
  }, 4500);

  socket.emit(
    "note:update",
    {
      id: note.id,
      text,
      to: notePreviewEditTo.value,
      priority: notePreviewEditPriority.value,
      deadline: notePreviewEditDeadline.value,
      color: previewEditSelectedColor
    },
    (response) => {
      clearPendingPreviewUpdateTimer();
      if (!response?.ok) {
        setPreviewEditStatus(response?.message || "Úprava lístku se nepodařila.", true);
        return;
      }

      setPreviewEditStatus("Lístek byl upraven.");
      closeNotePreview();
    }
  );
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTypingTarget =
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

  if (event.key === "Escape") {
    closeNotePreview();
    closeDockPanel();
    closeBoardQuickCreate();
    closeBoardInlineComposer();
    clearSelection();
    return;
  }

  if (!isTypingTarget && (event.key === "Delete" || event.key === "Backspace") && selectedNoteIds.size > 0) {
    event.preventDefault();
    deleteSelectedNotes();
  }
});

boardQuickCreateText?.addEventListener("click", () => {
  if (!boardQuickCreateDraftPosition) {
    return;
  }

  const { x, y } = boardQuickCreateDraftPosition;
  closeBoardQuickCreate();
  openBoardInlineComposerAtPosition(x, y, "text");
});

boardQuickCreateNote?.addEventListener("click", () => {
  if (!boardQuickCreateDraftPosition) {
    return;
  }

  const { x, y } = boardQuickCreateDraftPosition;
  closeBoardQuickCreate();
  openBoardInlineComposerAtPosition(x, y, "note");
});

boardInlineComposer?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitBoardInlineComposer();
});

boardInlineCancel?.addEventListener("click", () => {
  closeBoardInlineComposer();
});

donePositionText?.addEventListener("click", () => {
  navigateToDoneNotes();
});

boardArrowLeft?.addEventListener("click", () => {
  board.scrollBy({ left: -Math.max(280, Math.round(board.clientWidth * 0.62)), behavior: "smooth" });
});

boardArrowRight?.addEventListener("click", () => {
  board.scrollBy({ left: Math.max(280, Math.round(board.clientWidth * 0.62)), behavior: "smooth" });
});

boardArrowUp?.addEventListener("click", () => {
  board.scrollBy({ top: -Math.max(220, Math.round(board.clientHeight * 0.62)), behavior: "smooth" });
});

boardArrowDown?.addEventListener("click", () => {
  board.scrollBy({ top: Math.max(220, Math.round(board.clientHeight * 0.62)), behavior: "smooth" });
});

board?.addEventListener("scroll", () => {
  updateDonePositionHints();
});

board?.addEventListener("wheel", () => {
  requestAnimationFrame(() => {
    updateDonePositionHints();
  });
});

window.addEventListener("resize", () => {
  updateDonePositionHints();
});

document.addEventListener("pointerdown", (event) => {
  if (!toolDock || toolDockPanel?.classList.contains("hidden")) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!toolDock.contains(target)) {
    closeDockPanel();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!boardInlineComposer || boardInlineComposer.classList.contains("hidden")) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!boardInlineComposer.contains(target)) {
    closeBoardInlineComposer();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!boardQuickCreate || boardQuickCreate.classList.contains("hidden")) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!boardQuickCreate.contains(target)) {
    closeBoardQuickCreate();
  }
});

saveSessionBtn.addEventListener("click", () => {
  if (!me) {
    sessionSaveStatus.textContent = "Nejdříve se přihlas.";
    sessionSaveStatus.classList.add("is-error");
    return;
  }

  sessionSaveStatus.textContent = "Ukládám aktuální rozvržení...";
  sessionSaveStatus.classList.remove("is-error");
  socket.emit("session:saveSnapshot");
});

restoreSnapshotBtn?.addEventListener("click", () => {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  const snapshotId = restoreSnapshotSelect?.value || "";
  if (!snapshotId) {
    setBoardActionStatus("Vyber snapshot k obnovení.", true);
    return;
  }

  const selectedLabel = restoreSnapshotSelect?.selectedOptions?.[0]?.textContent || "vybranou zálohu";
  const ok = window.confirm(`Obnovit snapshot ${selectedLabel}? Aktuální plocha se nahradí obsahem zálohy.`);
  if (!ok) {
    return;
  }

  setBoardActionStatus("Obnovuji snapshot...", false);
  socket.emit("snapshot:restore", { id: snapshotId }, (response) => {
    if (!response?.ok) {
      setBoardActionStatus(response?.message || "Obnovení snapshotu se nepodařilo.", true);
      return;
    }

    setBoardActionStatus(`Snapshot obnoven (${response.noteCount || 0} lístků, ${response.textCount || 0} textů).`);
    closeDockPanel();
  });
});

pasteNoteTextBtn?.addEventListener("click", () => {
  pasteTextToNoteInput();
});

boardInlinePasteNoteTextBtn?.addEventListener("click", () => {
  pasteTextToTextarea(boardInlineText, "Text byl vložen do lístku na ploše.");
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const emojiButton = target.closest(".emoji-btn");
  if (!(emojiButton instanceof HTMLElement)) {
    return;
  }

  const emoji = emojiButton.dataset.emoji || "";
  insertTextAtCursor(getEmojiTargetTextarea(emojiButton), emoji);
});

deleteAllBtn.addEventListener("click", () => {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  if (notes.length === 0) {
    setBoardActionStatus("Na ploše není žádný lístek.");
    return;
  }

  const ok = window.confirm("Opravdu smazat všechny lístky na nástěnce?");
  if (!ok) {
    return;
  }

  if (pendingDeleteAllTimer) {
    clearTimeout(pendingDeleteAllTimer);
  }

  pendingDeleteAll = true;
  setBoardActionStatus("Mazání všech lístků...", false);

  pendingDeleteAllTimer = window.setTimeout(() => {
    if (pendingDeleteAll) {
      setBoardActionStatus("Hromadné smazání se nepodařilo. Zkus to znovu.", true);
    }
    pendingDeleteAll = false;
    pendingDeleteAllTimer = null;
  }, 3500);

  socket.emit("note:deleteAll", {}, (response) => {
    if (!response?.ok && response?.message) {
      setBoardActionStatus(response.message, true);
      pendingDeleteAll = false;
      if (pendingDeleteAllTimer) {
        clearTimeout(pendingDeleteAllTimer);
        pendingDeleteAllTimer = null;
      }
      return;
    }

    if (response?.removedCount === 0) {
      setBoardActionStatus("Na ploše není žádný lístek.");
      pendingDeleteAll = false;
      if (pendingDeleteAllTimer) {
        clearTimeout(pendingDeleteAllTimer);
        pendingDeleteAllTimer = null;
      }
    }
  });
});

deleteSelectedBtn?.addEventListener("click", () => {
  deleteSelectedNotes();
});

markSelectedDoneBtn?.addEventListener("click", () => {
  markSelectedNotesDone();
});

document.addEventListener("pointermove", (event) => {
  if (selectionStart && selectionCurrent) {
    if (selectionPointerId !== null && event.pointerId !== selectionPointerId) {
      return;
    }

    const boardRect = board.getBoundingClientRect();
    selectionCurrent = {
      x: event.clientX - boardRect.left + board.scrollLeft,
      y: event.clientY - boardRect.top + board.scrollTop
    };
    updateSelectionRectVisual();
    updateSelectedNotesByArea();
    return;
  }

  if (draggedBoardText && draggedBoardTextElement) {
    if (activeTextPointerId !== null && event.pointerId !== activeTextPointerId) {
      return;
    }

    const boardRect = board.getBoundingClientRect();
    const nextX = event.clientX - boardRect.left - textDragOffset.x + board.scrollLeft;
    const nextY = event.clientY - boardRect.top - textDragOffset.y + board.scrollTop;
    const maxX = Math.max(0, canvasWidth - BOARD_TEXT_WIDTH);
    const maxY = Math.max(0, canvasHeight - BOARD_TEXT_HEIGHT);
    const draftX = clamp(nextX, 0, maxX);
    const draftY = clamp(nextY, 0, maxY);
    const aligned = updateAlignmentGuides(draftX, draftY, { width: BOARD_TEXT_WIDTH, height: BOARD_TEXT_HEIGHT }, "text", draggedBoardText.id);

    draggedBoardText.x = clamp(aligned.x, 0, maxX);
    draggedBoardText.y = clamp(aligned.y, 0, maxY);

    ensureCanvasForPosition(draggedBoardText.x, draggedBoardText.y, BOARD_TEXT_WIDTH, BOARD_TEXT_HEIGHT);

    draggedBoardTextElement.style.left = `${draggedBoardText.x}px`;
    draggedBoardTextElement.style.top = `${draggedBoardText.y}px`;

    const now = performance.now();
    if (now - lastTextMoveEmitAt > 45) {
      lastTextMoveEmitAt = now;
      socket.emit("text:move", { id: draggedBoardText.id, x: draggedBoardText.x, y: draggedBoardText.y });
    }
    return;
  }

  if (!dragged || !draggedElement) {
    return;
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return;
  }

  const boardRect = board.getBoundingClientRect();
  const nextX = event.clientX - boardRect.left - dragOffset.x + board.scrollLeft;
  const nextY = event.clientY - boardRect.top - dragOffset.y + board.scrollTop;
  const bounds = getScaledNoteBounds();
  const maxX = Math.max(0, canvasWidth - bounds.width);
  const maxY = Math.max(0, canvasHeight - bounds.height);

  const draftX = clamp(snapToGrid(clamp(nextX, 0, maxX)), 0, maxX);
  const draftY = clamp(snapToGrid(clamp(nextY, 0, maxY)), 0, maxY);
  const aligned = updateAlignmentGuides(draftX, draftY, bounds, "note", dragged.id);

  if (draggedSelection && draggedSelection.length > 1) {
    const anchor = draggedSelection.find((entry) => entry.note.id === dragged.id);
    if (!anchor) {
      return;
    }

    let deltaX = aligned.x - anchor.startX;
    let deltaY = aligned.y - anchor.startY;
    let minDeltaX = -Infinity;
    let maxDeltaX = Infinity;
    let minDeltaY = -Infinity;
    let maxDeltaY = Infinity;

    draggedSelection.forEach((entry) => {
      minDeltaX = Math.max(minDeltaX, -entry.startX);
      maxDeltaX = Math.min(maxDeltaX, maxX - entry.startX);
      minDeltaY = Math.max(minDeltaY, -entry.startY);
      maxDeltaY = Math.min(maxDeltaY, maxY - entry.startY);
    });

    deltaX = clamp(deltaX, minDeltaX, maxDeltaX);
    deltaY = clamp(deltaY, minDeltaY, maxDeltaY);

    draggedSelection.forEach((entry) => {
      entry.note.x = clamp(entry.startX + deltaX, 0, maxX);
      entry.note.y = clamp(entry.startY + deltaY, 0, maxY);
      ensureCanvasForPosition(entry.note.x, entry.note.y, bounds.width, bounds.height);

      if (entry.element) {
        entry.element.style.left = `${entry.note.x}px`;
        entry.element.style.top = `${entry.note.y}px`;
      }
    });

    const now = performance.now();
    if (now - lastMoveEmitAt > 45) {
      lastMoveEmitAt = now;
      draggedSelection.forEach((entry) => {
        socket.emit("note:move", { id: entry.note.id, x: entry.note.x, y: entry.note.y });
      });
    }
    return;
  }

  dragged.x = clamp(aligned.x, 0, maxX);
  dragged.y = clamp(aligned.y, 0, maxY);
  ensureCanvasForPosition(dragged.x, dragged.y, bounds.width, bounds.height);

  draggedElement.style.left = `${dragged.x}px`;
  draggedElement.style.top = `${dragged.y}px`;

  const now = performance.now();
  if (now - lastMoveEmitAt > 45) {
    lastMoveEmitAt = now;
    socket.emit("note:move", { id: dragged.id, x: dragged.x, y: dragged.y });
  }
});

document.addEventListener("pointerup", (event) => {
  if (selectionStart && selectionCurrent) {
    if (selectionPointerId !== null && event.pointerId !== selectionPointerId) {
      return;
    }

    selectionPointerId = null;
    selectionStart = null;
    selectionCurrent = null;
    clearSelectionVisual();
    return;
  }

  if (draggedBoardText && draggedBoardTextElement) {
    if (activeTextPointerId !== null && event.pointerId !== activeTextPointerId) {
      return;
    }

    socket.emit("text:move", { id: draggedBoardText.id, x: draggedBoardText.x, y: draggedBoardText.y });
    draggedBoardTextElement.style.zIndex = "";

    if (activeTextPointerId !== null && draggedBoardTextElement.hasPointerCapture(activeTextPointerId)) {
      draggedBoardTextElement.releasePointerCapture(activeTextPointerId);
    }

    draggedBoardText = null;
    draggedBoardTextElement = null;
    activeTextPointerId = null;
    hideAlignmentGuides();
    return;
  }

  if (!dragged || !draggedElement) {
    return;
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return;
  }

  if (draggedSelection && draggedSelection.length > 1) {
    draggedSelection.forEach((entry) => {
      socket.emit("note:move", { id: entry.note.id, x: entry.note.x, y: entry.note.y });
      if (entry.element) {
        entry.element.style.zIndex = "";
      }
    });

    if (activePointerId !== null && draggedElement.hasPointerCapture(activePointerId)) {
      draggedElement.releasePointerCapture(activePointerId);
    }

    draggedSelection = null;
    dragged = null;
    draggedElement = null;
    activePointerId = null;
    hideAlignmentGuides();
    return;
  }

  socket.emit("note:move", { id: dragged.id, x: dragged.x, y: dragged.y });
  draggedElement.style.zIndex = "";

  if (activePointerId !== null && draggedElement.hasPointerCapture(activePointerId)) {
    draggedElement.releasePointerCapture(activePointerId);
  }

  dragged = null;
  draggedElement = null;
  activePointerId = null;
  hideAlignmentGuides();
});

socket.on("auth:error", (message) => {
  loginError.textContent = message || "Přihlášení selhalo";
});

socket.on("auth:required", () => {
  if (!me) {
    clearStoredSessionToken();
  }
});

socket.on("auth:ok", (user) => {
  me = user;
  storeSessionToken(user?.sessionToken);
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  meBadge.textContent = `Přihlášen: ${me.name}`;
  logoutBtn?.classList.remove("hidden");
  fromUser.value = me.name;
  loginPassword.value = "";
  loadRegisteredUsers();
  loadSnapshotOptions();
});

socket.on("connect", () => {
  if (me) {
    return;
  }

  const sessionToken = getStoredSessionToken();
  if (!sessionToken) {
    return;
  }

  socket.emit("auth:resume", { sessionToken });
});

socket.on("board:init", ({ notes: initialNotes, texts: initialTexts, activity }) => {
  notes = initialNotes || [];
  boardTexts = initialTexts || [];
  selectedNoteIds = new Set();
  const bounds = getScaledNoteBounds();
  notes.forEach((note) => {
    ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);
  });
  boardTexts.forEach((item) => {
    ensureCanvasForPosition(item.x, item.y, 280, 80);
  });
  renderBoard();
  renderActivity(activity || []);
});

socket.on("users:list", (users) => {
  onlineUsers = users || [];
  renderPresence();
  renderUserSelects();
  renderBoard();
});

socket.on("activity:list", (items) => {
  renderActivity(items || []);
});

socket.on("note:created", (note) => {
  upsertNote(note);
  const bounds = getScaledNoteBounds();
  ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);
  renderBoard();
});

socket.on("text:created", (item) => {
  upsertBoardText(item);
  ensureCanvasForPosition(item.x, item.y, 280, 80);
  renderBoard();
});

socket.on("text:moved", ({ id, x, y }) => {
  const textItem = boardTexts.find((item) => item.id === id);
  if (!textItem) {
    return;
  }

  textItem.x = Number.isFinite(x) ? x : textItem.x;
  textItem.y = Number.isFinite(y) ? y : textItem.y;

  ensureCanvasForPosition(textItem.x, textItem.y, BOARD_TEXT_WIDTH, BOARD_TEXT_HEIGHT);

  const element = boardCanvas.querySelector(`.board-text-node[data-id="${id}"]`);
  if (element) {
    element.style.left = `${textItem.x}px`;
    element.style.top = `${textItem.y}px`;
  }
});

socket.on("text:deleted", ({ id }) => {
  boardTexts = boardTexts.filter((item) => item.id !== id);

  if (draggedBoardText && draggedBoardText.id === id) {
    draggedBoardText = null;
    draggedBoardTextElement = null;
    activeTextPointerId = null;
    hideAlignmentGuides();
  }

  renderBoard();
  setBoardActionStatus("Text byl smazán.");
});

socket.on("note:moved", ({ id, x, y }) => {
  const note = notes.find((item) => item.id === id);
  if (!note) {
    return;
  }

  note.x = snapToGrid(x);
  note.y = snapToGrid(y);

  const bounds = getScaledNoteBounds();
  ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);

  const element = boardCanvas.querySelector(`.sticky[data-id="${id}"]`);
  if (element) {
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
  }

  if (id === activePreviewNoteId) {
    refreshOpenPreview();
  }
});

socket.on("note:updated", (nextNote) => {
  if (!nextNote?.id) {
    return;
  }

  upsertNote(nextNote);
  const bounds = getScaledNoteBounds();
  ensureCanvasForPosition(nextNote.x, nextNote.y, bounds.width, bounds.height);
  renderBoard();

  if (nextNote.id === activePreviewNoteId) {
    refreshOpenPreview();
  }
});

socket.on("note:toggled", ({ id, done, x, y, moved }) => {
  const note = notes.find((item) => item.id === id);
  if (!note) {
    return;
  }

  const previousX = note.x;
  const previousY = note.y;
  note.done = done;

  if (done && (!Number.isFinite(x) || !Number.isFinite(y))) {
    const fallbackPosition = getClientDoneLanePosition(id);
    x = fallbackPosition.x;
    y = fallbackPosition.y;
    moved = true;
    socket.emit("note:move", { id, x, y });
  }

  if (Number.isFinite(x) && Number.isFinite(y)) {
    note.x = x;
    note.y = y;
    const bounds = getScaledNoteBounds();
    ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);
  }

  const element = boardCanvas.querySelector(`.sticky[data-id="${id}"]`);

  if (element && moved && Number.isFinite(x) && Number.isFinite(y) && (x !== previousX || y !== previousY)) {
    element.classList.toggle("done", done);
    const doneButton = element.querySelector(".done-toggle");
    if (doneButton) {
      doneButton.textContent = done ? "Obnovit" : "Hotovo";
    }

    element.classList.add("done-moving");
    requestAnimationFrame(() => {
      element.style.left = `${note.x}px`;
      element.style.top = `${note.y}px`;
    });

    window.setTimeout(() => {
      element.classList.remove("done-moving");
    }, DONE_MOVE_ANIMATION_MS);

    if (id === activePreviewNoteId) {
      refreshOpenPreview();
    }
    return;
  }

  renderBoard();

  if (id === activePreviewNoteId) {
    refreshOpenPreview();
  }
});

socket.on("note:deleted", ({ id }) => {
  if (pendingDeleteId === id && pendingDeleteTimer) {
    clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = null;
    pendingDeleteId = null;
  }

  notes = notes.filter((note) => note.id !== id);
  selectedNoteIds.delete(id);
  if (id === activePreviewNoteId) {
    closeNotePreview();
  }
  if (dragged && dragged.id === id) {
    dragged = null;
    draggedElement = null;
    activePointerId = null;
  }
  renderBoard();
  setBoardActionStatus("Lístek byl smazán.");
});

socket.on("notes:cleared", ({ removedCount }) => {
  pendingDeleteAll = false;
  if (pendingDeleteAllTimer) {
    clearTimeout(pendingDeleteAllTimer);
    pendingDeleteAllTimer = null;
  }

  notes = [];
  selectedNoteIds = new Set();
  dragged = null;
  draggedElement = null;
  activePointerId = null;
  closeNotePreview();
  renderBoard();
  setBoardActionStatus(`Smazáno lístků: ${removedCount}.`);
});

window.addEventListener("pagehide", () => {
  if (!me) {
    return;
  }

  fetch("/api/snapshots/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ savedBy: me.name }),
    keepalive: true
  }).catch(() => {
    // Ignore network errors on page close.
  });
});

socket.on("session:saved", ({ createdAt, noteCount }) => {
  const date = new Date(createdAt).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  sessionSaveStatus.textContent = `Snapshot uložen ${date}. Počet lístků: ${noteCount}.`;
  sessionSaveStatus.classList.remove("is-error");
  loadSnapshotOptions();
});

socket.on("session:error", (message) => {
  sessionSaveStatus.textContent = message || "Uložení snapshotu se nepodařilo.";
  sessionSaveStatus.classList.add("is-error");
});

renderNotePalette();
renderEmojiPalettes();
applyCanvasSize();
applyGridSize();
applyNoteScale();
applySnapState();
applyAuthLandingMessage();
