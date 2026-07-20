const socket = io();

const noteColors = ["#ffe66e", "#89f0a0", "#89e8ff", "#ffb3d9", "#ffd08b"];

const CANVAS_GROW_STEP = 800;
const CANVAS_PADDING = 320;
const SCALE_MIN = 50;
const SCALE_MAX = 120;
const SCALE_STEP = 5;
const PREVIEW_ANIMATION_MS = 220;
const ALIGN_THRESHOLD_PX = 6;
const EMOJI_OPTIONS = [
  // Obličeje
  "🙂", "😀", "😄", "😁", "😆", "😂", "🤣", "😊", "😉", "😍", "🤩", "😎",
  "🤔", "🙄", "😬", "😅", "😇", "😴", "😐", "😑", "😶", "😏", "🤭", "😮",
  "😡", "😢", "😭", "😱", "🤯", "🥳", "😓", "🙃", "🤗", "🥰", "🤩", "😔",
  "😯", "🤨", "😒", "🤡", "🥺", "🤮", "🤧", "🥵", "🥶", "🤠", "🦸", "🧐",
  // Gesta a ruce
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👀", "✌️", "🤞", "👌", "☝️",
  "👆", "👇", "👈", "👉", "✋", "🤚", "🦾", "🤲", "🤜", "❤️", "💚", "💙",
  // Symboly a značky
  "💡", "✅", "☑️", "❌", "⚠️", "❗", "❓", "⭐", "🔥", "🚀", "🎯", "🏆",
  "📌", "📎", "📝", "📅", "⏰", "🔔", "💬", "📣", "🔍", "🔒", "🔓", "🛡️",
  "♻️", "⬆️", "⬇️", "▶️", "⏹️", "🔄", "🔁", "💯", "🆕", "🆗", "🆙", "🆘",
  // Příroda a zvířata
  "🍀", "🌸", "🌻", "🌳", "🌱", "🐶", "🐱", "🐻", "🐼", "🐢", "🦇", "🐺",
  "🦁", "🐮", "🐍", "🐄", "🦅", "🐉", "🦄", "🌈",
  // Jídlo a pití
  "☕", "🍷", "🍺", "🍻", "🥂", "🍕", "🚗", "🍔", "🍜", "🍱", "🍉", "🍯",
  // Oslavy
  "🎉", "🎈", "🎁", "🎂", "😀", "🥂", "🥇", "👑"
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
let pendingNoteDrag = null;

let resizingNote = null;
let resizingNoteElement = null;
let activeNoteResizePointerId = null;
let noteResizeStart = { x: 0, y: 0, width: 188, height: 146, pointerX: 0, pointerY: 0 };
let lastNoteResizeEmitAt = 0;

let pendingDeleteId = null;
let pendingDeleteTimer = null;
let pendingDeleteAll = false;
let pendingDeleteAllTimer = null;
let draggedBoardText = null;
let draggedBoardTextElement = null;
let activeBoardTextId = null;
let resizingBoardText = null;
let resizingBoardTextElement = null;
let activeTextResizePointerId = null;
let textResizeStart = { x: 0, y: 0, width: 340, height: 110, size: 1.8 };
let activeTextPointerId = null;
let lastTextMoveEmitAt = 0;
let lastTextResizeEmitAt = 0;
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
let noteArchiveClosingTimer = null;
let confirmModalClosingTimer = null;
let activePreviewNoteId = null;
let isPreviewEditing = false;
let verticalGuideEl = null;
let horizontalGuideEl = null;
let noteConnectionsSvg = null;
let lastRichEditorSelection = null;
let pendingInlineFormatSelection = null;
let pendingConfirmAction = null;

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
const NOTE_DEFAULT_WIDTH = 188;
const NOTE_DEFAULT_HEIGHT = 146;
const NOTE_MIN_WIDTH = 120;
const NOTE_MIN_HEIGHT = 90;
const NOTE_MAX_WIDTH = 600;
const NOTE_MAX_HEIGHT = 480;
const NOTE_DRAG_START_THRESHOLD = 6;
const BOARD_TEXT_WIDTH = 340;
const BOARD_TEXT_HEIGHT = 110;
const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_CONNECTION_VERTICAL_CENTER_RATIO = 0.42;

const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const loginEmailWrap = document.querySelector("#login-email-wrap");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const guestLoginBtn = document.querySelector("#guest-login-btn");
const loginError = document.querySelector("#login-error");
const appShell = document.querySelector("#app-shell");
const meBadge = document.querySelector("#me-badge");
const logoutBtn = document.querySelector("#logout-btn");

const board = document.querySelector("#board");
const boardCanvas = document.querySelector("#board-canvas") || board;
const archiveIndicator = document.querySelector("#archive-indicator");
const archiveIndicatorTotal = document.querySelector("#archive-indicator-total");
const archiveIndicatorDone = document.querySelector("#archive-indicator-done");
const noteTemplate = document.querySelector("#note-template");
const noteForm = document.querySelector("#note-form");
const noteText = document.querySelector("#note-text");
const pasteNoteTextBtn = document.querySelector("#paste-note-text");
const noteFormatToolbar = document.querySelector('[data-format-toolbar="note"]');
const fromUser = document.querySelector("#from-user");
const toUserWrap = document.querySelector("#note-to-user-wrap");
const toUser = document.querySelector("#to-user");
const noteIsDelegated = document.querySelector("#note-is-delegated");
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
const notePreviewEditToWrap = document.querySelector("#note-preview-edit-to-wrap");
const notePreviewEditTo = document.querySelector("#note-preview-edit-to");
const notePreviewEditIsDelegated = document.querySelector("#note-preview-edit-is-delegated");
const notePreviewEditPriority = document.querySelector("#note-preview-edit-priority");
const notePreviewEditDeadline = document.querySelector("#note-preview-edit-deadline");
const notePreviewEditColorPalette = document.querySelector("#note-preview-edit-color-palette");
const notePreviewEditFormatToolbar = document.querySelector('[data-format-toolbar="preview-edit"]');
const notePreviewCancelBtn = document.querySelector("#note-preview-cancel-btn");
const notePreviewEditStatus = document.querySelector("#note-preview-edit-status");
const noteArchive = document.querySelector("#note-archive");
const noteArchiveClose = document.querySelector("#note-archive-close");
const noteArchiveSummary = document.querySelector("#note-archive-summary");
const noteArchiveDoneCount = document.querySelector("#note-archive-done-count");
const noteArchiveDoneList = document.querySelector("#note-archive-done-list");
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalTitle = document.querySelector("#confirm-modal-title");
const confirmModalMessage = document.querySelector("#confirm-modal-message");
const confirmModalCancel = document.querySelector("#confirm-modal-cancel");
const confirmModalConfirm = document.querySelector("#confirm-modal-confirm");
const selectionContextMenu = document.querySelector("#selection-context-menu");
const selectionContextSummary = document.querySelector("#selection-context-summary");
const selectionContextEdit = document.querySelector("#selection-context-edit");
const selectionContextDone = document.querySelector("#selection-context-done");
const selectionContextDelete = document.querySelector("#selection-context-delete");
const toolDock = document.querySelector(".tool-dock");
const toolDockPanel = document.querySelector("#tool-dock-panel");
const dockToggleNote = document.querySelector("#dock-toggle-note");
const dockToggleFilter = document.querySelector("#dock-toggle-filter");
const dockToggleActions = document.querySelector("#dock-toggle-actions");
const dockSectionNote = document.querySelector("#dock-section-note");
const dockSectionFilter = document.querySelector("#dock-section-filter");
const dockSectionActions = document.querySelector("#dock-section-actions");
const boardInlineComposer = document.querySelector("#board-inline-composer");
const boardInlineTitle = document.querySelector("#board-inline-title");
const boardInlineControlTitle = document.querySelector("#board-inline-control-title");
const boardInlineText = document.querySelector("#board-inline-text");
const boardInlineNoteFields = document.querySelector("#board-inline-note-fields");
const boardInlinePasteNoteTextBtn = document.querySelector("#board-inline-paste-note-text");
const boardInlineFromUser = document.querySelector("#board-inline-from-user");
const boardInlineToUserWrap = document.querySelector("#board-inline-to-user-wrap");
const boardInlineToUser = document.querySelector("#board-inline-to-user");
const boardInlineIsDelegated = document.querySelector("#board-inline-is-delegated");
const boardInlinePriority = document.querySelector("#board-inline-priority");
const boardInlineDeadline = document.querySelector("#board-inline-deadline");
const boardInlinePalette = document.querySelector("#board-inline-palette");
const boardInlineFormatToolbar = document.querySelector('[data-format-toolbar="board-inline-note"]');
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

const NOTE_FORM_TITLE = "Nový ticket";
const NOTE_FORM_CONTROL_TITLE = "Obsah a delegace";
const NOTE_FORM_TEXT_PLACEHOLDER = "Například: Finální kontrola textu a předání klientovi";
const BOARD_TEXT_TITLE = "Čistý text";
const BOARD_TEXT_CONTROL_TITLE = "Obsah textu";
const BOARD_TEXT_PLACEHOLDER = "Napiš čistý text na plochu";
const AUTH_SESSION_STORAGE_KEY = "nastenka.live.sessionToken";
const NOTE_FORMAT_SIZE_CLASSES = ["note-text-size-small", "note-text-size-normal", "note-text-size-large"];
const NOTE_FORMAT_SIZES = ["small", "normal", "large"];
const NOTE_FORMAT_ALIGNS = ["left", "center", "right"];
const BOARD_TEXT_MIN_SIZE = 0.25;
const BOARD_TEXT_DEFAULT_SIZE = 1.8;
const BOARD_TEXT_MIN_WIDTH = 120;
const BOARD_TEXT_MIN_HEIGHT = 90;
const BOARD_TEXT_SIZE_PRESETS = {
  small: 1.25,
  normal: BOARD_TEXT_DEFAULT_SIZE,
  large: 2.65
};

function normalizeNoteFormat(value) {
  return {
    bold: Boolean(value?.bold),
    italic: Boolean(value?.italic),
    size: NOTE_FORMAT_SIZES.includes(value?.size) ? value.size : "normal",
    align: NOTE_FORMAT_ALIGNS.includes(value?.align) ? value.align : "left"
  };
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

function isActiveNote(note) {
  return getNoteStatus(note) === "active";
}

function isResolvedLinkedNoteWaitingForSource(note) {
  if (getNoteStatus(note) !== "done") {
    return false;
  }

  const sourceNote = getLinkedSourceNote(note);
  return Boolean(sourceNote && getNoteStatus(sourceNote) === "active");
}

function isNoteVisibleOnBoard(note) {
  return isActiveNote(note) || isResolvedLinkedNoteWaitingForSource(note);
}

function isArchivedNote(note) {
  return getNoteStatus(note) === "done" && !isResolvedLinkedNoteWaitingForSource(note);
}

function formatNoteStatusLabel(note) {
  const status = getNoteStatus(note);
  if (status === "done") {
    return "Vyřešeno";
  }
  return "Aktivní";
}

function getLinkedSourceNote(note) {
  const linkedSourceNoteId = sanitizeLinkedSourceNoteId(note?.linkedSourceNoteId);
  if (!linkedSourceNoteId) {
    return null;
  }
  return notes.find((item) => item.id === linkedSourceNoteId) || null;
}

function getNoteFormatFromToolbar(toolbar) {
  if (!toolbar) {
    return normalizeNoteFormat();
  }

  const activeSizeButton = toolbar.querySelector('[data-format-field="size"].active');
  const activeAlignButton = toolbar.querySelector('[data-format-field="align"].active');

  return normalizeNoteFormat({
    size: activeSizeButton?.dataset.formatValue,
    align: activeAlignButton?.dataset.formatValue
  });
}

function setNoteFormatToolbar(toolbar, format) {
  if (!toolbar) {
    return;
  }

  const nextFormat = normalizeNoteFormat(format);

  toolbar.querySelectorAll('[data-format-field="size"]').forEach((button) => {
    const isActive = button.dataset.formatValue === nextFormat.size;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  toolbar.querySelectorAll('[data-format-field="align"]').forEach((button) => {
    const isActive = button.dataset.formatValue === nextFormat.align;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getEditorContainer(editor) {
  return editor?.closest?.("#note-form, #board-inline-composer, #note-preview-edit-form") || null;
}

function getEditorToolbar(editor) {
  return getEditorContainer(editor)?.querySelector(".text-format-toolbar") || null;
}

function getSelectionEditor() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode) {
    return null;
  }

  let node = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  return node instanceof HTMLElement ? node.closest(".rich-editor") : null;
}

function saveSelectionForEditor(editor) {
  const selection = window.getSelection?.();
  if (!editor || !selection || selection.rangeCount === 0 || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
    return;
  }

  lastRichEditorSelection = {
    editor,
    range: selection.getRangeAt(0).cloneRange()
  };
}

function restoreRangeForEditor(editor, range) {
  if (!editor || !range) {
    return false;
  }

  const selection = window.getSelection?.();
  if (!selection) {
    return false;
  }

  editor.focus();
  selection.removeAllRanges();
  selection.addRange(range.cloneRange());
  return true;
}

function restoreSelectionForEditor(editor) {
  if (!editor || !lastRichEditorSelection || lastRichEditorSelection.editor !== editor) {
    return false;
  }

  return restoreRangeForEditor(editor, lastRichEditorSelection.range);
}

function clearPendingInlineFormatSelection(editor = null) {
  if (!editor || pendingInlineFormatSelection?.editor === editor) {
    pendingInlineFormatSelection = null;
  }
}

function rememberPendingInlineFormatSelection(editor) {
  const selection = window.getSelection?.();
  if (!editor || !selection || selection.rangeCount === 0 || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
    clearPendingInlineFormatSelection(editor);
    return;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    clearPendingInlineFormatSelection(editor);
    return;
  }

  let bold = false;
  let italic = false;
  try {
    bold = document.queryCommandState("bold");
  } catch {
    bold = false;
  }
  try {
    italic = document.queryCommandState("italic");
  } catch {
    italic = false;
  }

  pendingInlineFormatSelection = {
    editor,
    range: range.cloneRange(),
    bold,
    italic
  };
}

function getPendingInlineFormatState(editor) {
  const selection = window.getSelection?.();
  if (!editor || !selection || selection.rangeCount === 0 || !isSelectionInsideEditor(editor)) {
    return null;
  }

  if (!pendingInlineFormatSelection || pendingInlineFormatSelection.editor !== editor) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    return null;
  }

  return pendingInlineFormatSelection;
}

function moveCaretAfterInlineFormat(editor, tagNames) {
  const selection = window.getSelection?.();
  if (!editor || !selection || selection.rangeCount === 0) {
    return;
  }

  editor.focus();

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(false);

  let node = range.endContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  let formatNode = node instanceof HTMLElement ? node.closest(tagNames.join(",")) : null;
  while (formatNode instanceof HTMLElement && formatNode.parentElement && formatNode.parentElement !== editor && formatNode.parentElement.closest(tagNames.join(","))) {
    formatNode = formatNode.parentElement.closest(tagNames.join(","));
  }

  if (formatNode instanceof HTMLElement && editor.contains(formatNode)) {
    const caretRange = document.createRange();
    caretRange.setStartAfter(formatNode);
    caretRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretRange);
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function isSelectionInsideEditor(editor) {
  const selection = window.getSelection?.();
  return Boolean(editor && selection?.anchorNode && editor.contains(selection.anchorNode));
}

function hasInlineFormatInSelection(editor, tags) {
  if (!isSelectionInsideEditor(editor)) {
    return false;
  }

  let node = window.getSelection()?.anchorNode || null;
  if (node?.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  while (node instanceof HTMLElement && node !== editor) {
    if (tags.includes(node.tagName.toLowerCase())) {
      return true;
    }
    node = node.parentElement;
  }

  return false;
}

function getEditorFormatState(editor) {
  if (!editor) {
    return normalizeNoteFormat();
  }

  const size = NOTE_FORMAT_SIZES.find((value) => editor.classList.contains(`note-text-size-${value}`)) || "normal";
  const inlineAlign = editor.style.textAlign || "";
  const computedAlign = window.getComputedStyle(editor).textAlign;
  const align = NOTE_FORMAT_ALIGNS.includes(inlineAlign)
    ? inlineAlign
    : NOTE_FORMAT_ALIGNS.includes(computedAlign)
      ? computedAlign
      : "left";

  return normalizeNoteFormat({ size, align });
}

function normalizeInlineTypingMode(editor) {
  const selection = window.getSelection?.();
  if (!editor || !selection) {
    return;
  }

  if (!isSelectionInsideEditor(editor)) {
    if (document.activeElement !== editor) {
      return;
    }
    const caretRange = document.createRange();
    caretRange.selectNodeContents(editor);
    caretRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(caretRange);
  }

  if (selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    return;
  }

  [["bold", ["b", "strong"]], ["italic", ["i", "em"]]].forEach(([action, tags]) => {
    let commandActive = false;
    try {
      commandActive = document.queryCommandState(action);
    } catch {
      commandActive = false;
    }

    if (!commandActive || hasInlineFormatInSelection(editor, tags)) {
      return;
    }

    try {
      document.execCommand(action, false);
    } catch {
      /* ignore unsupported browsers */
    }
  });
}

function resetNoteFormatToolbar(toolbar) {
  setNoteFormatToolbar(toolbar, normalizeNoteFormat());

  const editor = toolbar?.closest?.("#note-form, #board-inline-composer, #note-preview-edit-form")?.querySelector?.(".rich-editor");
  if (editor) {
    applyToolbarFormatToEditor(editor, toolbar);
  }
}

function applyNoteFormatToElement(element, format) {
  if (!element) {
    return;
  }

  const nextFormat = normalizeNoteFormat(format);
  element.classList.remove(...NOTE_FORMAT_SIZE_CLASSES);
  element.classList.add(`note-text-size-${nextFormat.size}`);
  element.style.textAlign = nextFormat.align;
}

const RICH_MAX_LENGTH = 2000;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  if (s.length > RICH_MAX_LENGTH) {
    s = s.slice(0, RICH_MAX_LENGTH);
  }
  return s;
}

function serializeRichNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    return "\n";
  }
  let inner = "";
  node.childNodes.forEach((child) => {
    inner += serializeRichNode(child);
  });
  if (tag === "b" || tag === "strong") {
    return inner ? `<b>${inner}</b>` : "";
  }
  if (tag === "i" || tag === "em") {
    return inner ? `<i>${inner}</i>` : "";
  }
  if (tag === "div" || tag === "p") {
    return `${inner}\n`;
  }
  return inner;
}

function getRichEditorValue(editor) {
  if (!editor) {
    return "";
  }
  let out = "";
  editor.childNodes.forEach((child) => {
    out += serializeRichNode(child);
  });
  return sanitizeRichText(out);
}

function richTextToDisplayHtml(rich) {
  return sanitizeRichText(rich).replace(/\n/g, "<br>");
}

function richTextToPlain(rich) {
  return sanitizeRichText(rich)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function setRichEditor(editor, rich) {
  if (!editor) {
    return;
  }
  editor.innerHTML = richTextToDisplayHtml(rich);
}

function clearRichEditor(editor) {
  if (!editor) {
    return;
  }
  editor.innerHTML = "";
  if (document.activeElement === editor) {
    normalizeInlineTypingMode(editor);
    saveSelectionForEditor(editor);
  }
}

function normalizeBoardTextSize(value) {
  if (Object.hasOwn(BOARD_TEXT_SIZE_PRESETS, value)) {
    return BOARD_TEXT_SIZE_PRESETS[value];
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return BOARD_TEXT_DEFAULT_SIZE;
  }

  return Math.round(Math.max(numericValue, BOARD_TEXT_MIN_SIZE) * 100) / 100;
}

function normalizeBoardTextDimension(value, fallback, min) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.round(Math.max(numericValue, min));
}

function applyBoardTextSizeToElement(element, size) {
  if (!element) {
    return;
  }

  element.style.fontSize = `${normalizeBoardTextSize(size)}rem`;
}

function getBoardTextResizeSize(width, height, baseWidth, baseHeight, baseSize = BOARD_TEXT_DEFAULT_SIZE) {
  const widthScale = Number(width) / Number(baseWidth);
  const heightScale = Number(height) / Number(baseHeight);
  const scale = Math.max(widthScale, heightScale);

  if (!Number.isFinite(scale) || scale <= 0) {
    return normalizeBoardTextSize(baseSize);
  }

  return normalizeBoardTextSize(normalizeBoardTextSize(baseSize) * scale);
}

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

function getNoteBounds(note) {
  const scale = getNoteScale();
  const baseWidth = Number.isFinite(note?.width) ? note.width : NOTE_DEFAULT_WIDTH;
  const baseHeight = Number.isFinite(note?.height) ? note.height : NOTE_DEFAULT_HEIGHT;
  return {
    width: baseWidth * scale,
    height: baseHeight * scale,
    baseWidth,
    baseHeight
  };
}

function normalizeNoteSize(value, fallback, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.round(Math.min(Math.max(numericValue, min), max));
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
  if (!notePreview || !isNoteVisibleOnBoard(note)) {
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

  notePreviewText.innerHTML = richTextToDisplayHtml(note.text);
  applyNoteFormatToElement(notePreviewText, note.format);
  notePreviewDelegation.textContent = `Autor: ${note.from} | Řešitel: ${note.to}`;
  notePreviewDetails.textContent = buildNoteDetailsText(note);
  notePreviewEditBtn?.classList.toggle("hidden", !canEditNote(note) || !isActiveNote(note));
  notePreviewView?.classList.remove("hidden");
  notePreviewEditForm?.classList.add("hidden");
  if (notePreviewEditStatus) {
    notePreviewEditStatus.textContent = "";
    notePreviewEditStatus.classList.remove("is-error");
  }
}

function closeNotePreview(immediate = false) {
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
  notePreviewView?.classList.remove("hidden");
  notePreviewEditForm?.classList.add("hidden");

  if (notePreviewClosingTimer) {
    clearTimeout(notePreviewClosingTimer);
    notePreviewClosingTimer = null;
  }

  if (immediate) {
    notePreview.classList.add("hidden");
    return;
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
  if (!note || !isNoteVisibleOnBoard(note)) {
    closeNotePreview();
    return;
  }

  const previewSheet = notePreview.querySelector(".note-preview-sheet");
  if (previewSheet) {
    previewSheet.style.background = note.color;
  }

  notePreviewText.innerHTML = richTextToDisplayHtml(note.text);
  applyNoteFormatToElement(notePreviewText, note.format);
  notePreviewDelegation.textContent = `Autor: ${note.from} | Řešitel: ${note.to}`;
  notePreviewDetails.textContent = buildNoteDetailsText(note);
  notePreviewEditBtn?.classList.toggle("hidden", !canEditNote(note) || !isActiveNote(note));

  if (isPreviewEditing) {
    setRichEditor(notePreviewEditText, note.text);
    setAuthorFieldValue(notePreviewEditFrom, note.from);
    populatePreviewAssigneeSelect(note.to);
    notePreviewEditIsDelegated.checked = Boolean(note?.isDelegated);
    renderDelegatedSourceSelects();
    notePreviewEditPriority.value = ["Nizka", "Stredni", "Vysoka"].includes(note.priority)
      ? note.priority
      : "Stredni";
    notePreviewEditDeadline.value = note.deadline || "";
    previewEditSelectedColor = note.color || noteColors[0];
    setNoteFormatToolbar(notePreviewEditFormatToolbar, note.format);
    applyToolbarFormatToEditor(notePreviewEditText, notePreviewEditFormatToolbar);
    renderPreviewEditPalette();
  }
}

function enterPreviewEditMode() {
  const note = getActivePreviewNote();
  if (!note || !canEditNote(note)) {
    return;
  }

  isPreviewEditing = true;
  setRichEditor(notePreviewEditText, note.text);
  setAuthorFieldValue(notePreviewEditFrom, note.from);
  populatePreviewAssigneeSelect(note.to);
  notePreviewEditIsDelegated.checked = Boolean(note?.isDelegated);
  renderDelegatedSourceSelects();
  notePreviewEditPriority.value = ["Nizka", "Stredni", "Vysoka"].includes(note.priority)
    ? note.priority
    : "Stredni";
  notePreviewEditDeadline.value = note.deadline || "";
  previewEditSelectedColor = note.color || noteColors[0];
  setNoteFormatToolbar(notePreviewEditFormatToolbar, note.format);
  applyToolbarFormatToEditor(notePreviewEditText, notePreviewEditFormatToolbar);
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
    (dockToggleActions?.classList.contains("active") && "actions");

  if (isAlreadyOpen && activeBtn === section) {
    closeDockPanel();
    return;
  }

  toolDockPanel.classList.remove("hidden");
  dockSectionNote?.classList.toggle("hidden", section !== "note");
  dockSectionFilter?.classList.toggle("hidden", section !== "filter");
  dockSectionActions?.classList.toggle("hidden", section !== "actions");

  dockToggleNote?.classList.toggle("active", section === "note");
  dockToggleFilter?.classList.toggle("active", section === "filter");
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
  activeBoardTextId = null;
  resizingBoardText = null;
  resizingBoardTextElement = null;
  activeTextResizePointerId = null;
  resizingNote = null;
  resizingNoteElement = null;
  activeNoteResizePointerId = null;
  activeTextPointerId = null;

  meBadge.textContent = "";
  logoutBtn?.classList.add("hidden");
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = "";
  loginPassword.value = "";
  loginEmail.value = "";
  loginEmailWrap?.classList.remove("hidden");
  clearRichEditor(noteText);
  sessionSaveStatus.textContent = "";
  setBoardActionStatus("");
  clearStoredSessionToken();
}

function showLoginScreen() {
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
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
  const normalizedNote = normalizeIncomingNote(next);
  if (!normalizedNote) {
    return;
  }

  const index = notes.findIndex((note) => note.id === normalizedNote.id);
  if (index === -1) {
    notes.push(normalizedNote);
    return;
  }
  notes[index] = { ...notes[index], ...normalizedNote };
}

function upsertBoardText(next) {
  const normalizedText = normalizeIncomingBoardText(next);
  if (!normalizedText) {
    return;
  }

  const index = boardTexts.findIndex((item) => item.id === normalizedText.id);
  if (index === -1) {
    boardTexts.push(normalizedText);
    return;
  }
  boardTexts[index] = { ...boardTexts[index], ...normalizedText };
}

function normalizeIncomingNote(next) {
  if (!next || typeof next !== "object" || !next.id) {
    return null;
  }

  const status = normalizeNoteStatus(next.status, Boolean(next.done));

  return {
    ...next,
    text: sanitizeRichText(typeof next.text === "string" ? next.text : ""),
    isDelegated: Boolean(next.isDelegated || sanitizeLinkedSourceNoteId(next.linkedSourceNoteId)),
    linkedSourceNoteId: sanitizeLinkedSourceNoteId(next.linkedSourceNoteId),
    from: String(next.from || ""),
    to: String(next.to || ""),
    priority: typeof next.priority === "string" && next.priority ? next.priority : "Stredni",
    deadline: typeof next.deadline === "string" ? next.deadline : "",
    color: typeof next.color === "string" && next.color ? next.color : noteColors[0],
    x: snapToGrid(Number.isFinite(next.x) ? next.x : 0),
    y: snapToGrid(Number.isFinite(next.y) ? next.y : 0),
    width: normalizeNoteSize(next.width, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH),
    height: normalizeNoteSize(next.height, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT),
    status,
    done: status === "done",
    format: normalizeNoteFormat(next.format)
  };
}

function normalizeIncomingBoardText(next) {
  if (!next || typeof next !== "object" || !next.id) {
    return null;
  }

  return {
    ...next,
    text: typeof next.text === "string" ? next.text : "",
    author: String(next.author || "Uživatel"),
    x: Number.isFinite(next.x) ? next.x : 0,
    y: Number.isFinite(next.y) ? next.y : 0,
    width: normalizeBoardTextDimension(next.width, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH),
    height: normalizeBoardTextDimension(next.height, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT),
    size: normalizeBoardTextSize(next.size)
  };
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

function setAuthorFieldValue(field, value = "") {
  if (!field) {
    return;
  }

  field.value = String(value || "").trim();
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

  setAuthorFieldValue(fromUser, me?.name || "");

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
    setAuthorFieldValue(boardInlineFromUser, me?.name || "");
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
      setAuthorFieldValue(notePreviewEditFrom, note.from);
      populatePreviewAssigneeSelect(note.to);
    }
  }

  renderDelegatedSourceSelects();
}

function syncDelegatedControls(toggle, assigneeWrap, assigneeSelect) {
  if (!toggle || !assigneeSelect) {
    return;
  }

  const isDelegated = Boolean(toggle.checked);
  assigneeWrap?.classList.toggle("hidden", !isDelegated);

  if (!isDelegated) {
    const defaultAssignee = me?.name || assigneeSelect.value || "";
    if (defaultAssignee) {
      assigneeSelect.value = defaultAssignee;
    }
  }
}

function renderDelegatedSourceSelects() {
  syncDelegatedControls(noteIsDelegated, toUserWrap, toUser);
  syncDelegatedControls(boardInlineIsDelegated, boardInlineToUserWrap, boardInlineToUser);
  syncDelegatedControls(notePreviewEditIsDelegated, notePreviewEditToWrap, notePreviewEditTo);
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

function getDoneNotes() {
  return notes.filter((note) => isArchivedNote(note));
}

function getArchivedNotes() {
  return getDoneNotes();
}

function getLinkedSourceDirectionLabel(note) {
  const source = getLinkedSourceNote(note);
  return source ? `${source.from} -> ${source.to}` : "";
}

function buildNoteDetailsText(note) {
  const parts = [`Priorita: ${formatPriorityLabel(note.priority)}`];
  if (note.deadline) {
    parts.push(`Termín: ${note.deadline}`);
  }
  parts.push(`Stav: ${formatNoteStatusLabel(note)}`);

  const linkedSourceDirectionLabel = getLinkedSourceDirectionLabel(note);
  if (linkedSourceDirectionLabel) {
    parts.push(`Navazuje na: ${linkedSourceDirectionLabel}`);
  }

  return parts.join(" | ");
}

function ensureNoteConnectionsOverlay() {
  if (!boardCanvas) {
    return null;
  }

  if (!noteConnectionsSvg || !boardCanvas.contains(noteConnectionsSvg)) {
    noteConnectionsSvg = document.createElementNS(SVG_NS, "svg");
    noteConnectionsSvg.classList.add("board-connections");

    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "note-connection-arrow");
    marker.setAttribute("markerWidth", "9");
    marker.setAttribute("markerHeight", "9");
    marker.setAttribute("refX", "7.5");
    marker.setAttribute("refY", "4.5");
    marker.setAttribute("orient", "auto-start-reverse");
    marker.setAttribute("viewBox", "0 0 9 9");

    const arrowPath = document.createElementNS(SVG_NS, "path");
    arrowPath.setAttribute("d", "M1 1 L8 4.5 L1 8 Z");
    arrowPath.classList.add("board-connection-arrow");

    marker.append(arrowPath);
    defs.append(marker);
    noteConnectionsSvg.append(defs);
  }

  const canvasRect = boardCanvas.getBoundingClientRect();
  const overlayWidth = Math.max(boardCanvas.clientWidth, Math.round(canvasRect.width), 1);
  const overlayHeight = Math.max(boardCanvas.clientHeight, Math.round(canvasRect.height), 1);

  noteConnectionsSvg.setAttribute("width", String(overlayWidth));
  noteConnectionsSvg.setAttribute("height", String(overlayHeight));
  noteConnectionsSvg.setAttribute("viewBox", `0 0 ${overlayWidth} ${overlayHeight}`);
  boardCanvas.append(noteConnectionsSvg);
  return noteConnectionsSvg;
}

function getRenderedNoteRect(note) {
  if (!boardCanvas || !note?.id) {
    return null;
  }

  const element = boardCanvas.querySelector(`.sticky[data-id="${note.id}"]`);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const canvasRect = boardCanvas.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return {
    x: elementRect.left - canvasRect.left,
    y: elementRect.top - canvasRect.top,
    width: elementRect.width,
    height: elementRect.height
  };
}

function getNoteConnectionCenter(note) {
  const bounds = getRenderedNoteRect(note) || getNoteBounds(note);
  const originX = Number.isFinite(bounds.x) ? bounds.x : note.x;
  const originY = Number.isFinite(bounds.y) ? bounds.y : note.y;
  return {
    x: originX + bounds.width / 2,
    y: originY + bounds.height * NOTE_CONNECTION_VERTICAL_CENTER_RATIO
  };
}

function getNoteConnectionAnchor(note, towardX, towardY) {
  const bounds = getRenderedNoteRect(note) || getNoteBounds(note);
  const originX = Number.isFinite(bounds.x) ? bounds.x : note.x;
  const originY = Number.isFinite(bounds.y) ? bounds.y : note.y;
  const center = getNoteConnectionCenter(note);
  const deltaX = towardX - center.x;
  const deltaY = towardY - center.y;

  if (deltaX === 0 && deltaY === 0) {
    return center;
  }

  const left = originX;
  const right = originX + bounds.width;
  const top = originY;
  const bottom = originY + bounds.height;

  const horizontalDistance = deltaX >= 0 ? right - center.x : center.x - left;
  const verticalDistance = deltaY >= 0 ? bottom - center.y : center.y - top;

  const horizontalScale = Math.abs(deltaX) > 0.001 ? horizontalDistance / Math.abs(deltaX) : Number.POSITIVE_INFINITY;
  const verticalScale = Math.abs(deltaY) > 0.001 ? verticalDistance / Math.abs(deltaY) : Number.POSITIVE_INFINITY;
  const scale = Math.min(horizontalScale, verticalScale);

  return {
    x: center.x + deltaX * scale,
    y: center.y + deltaY * scale
  };
}

function renderNoteConnections() {
  const overlay = ensureNoteConnectionsOverlay();
  if (!overlay) {
    return;
  }

  overlay.querySelectorAll(".board-connection").forEach((element) => {
    element.remove();
  });

  const visibleNotes = getVisibleNotes();
  if (visibleNotes.length === 0) {
    return;
  }

  const visibleNotesById = new Map(visibleNotes.map((note) => [note.id, note]));

  visibleNotes.forEach((note) => {
    const linkedSourceNoteId = sanitizeLinkedSourceNoteId(note.linkedSourceNoteId);
    if (!linkedSourceNoteId) {
      return;
    }

    const sourceNote = visibleNotesById.get(linkedSourceNoteId);
    if (!sourceNote || sourceNote.id === note.id) {
      return;
    }

    const sourceCenter = getNoteConnectionCenter(sourceNote);
    const targetCenter = getNoteConnectionCenter(note);
    const start = getNoteConnectionAnchor(sourceNote, targetCenter.x, targetCenter.y);
    const end = getNoteConnectionAnchor(note, sourceCenter.x, sourceCenter.y);

    const connectionGroup = document.createElementNS(SVG_NS, "g");
    connectionGroup.classList.add("board-connection");

    const connectionLine = document.createElementNS(SVG_NS, "line");
    connectionLine.classList.add("board-connection-line");
    connectionLine.setAttribute("x1", String(start.x));
    connectionLine.setAttribute("y1", String(start.y));
    connectionLine.setAttribute("x2", String(end.x));
    connectionLine.setAttribute("y2", String(end.y));
    connectionLine.setAttribute("marker-end", "url(#note-connection-arrow)");
    connectionGroup.append(connectionLine);

    overlay.append(connectionGroup);
  });
}

function getNoteSummary(note, maxLength = 80) {
  const plain = richTextToPlain(note?.text || "").replace(/\s+/g, " ").trim();
  if (!plain) {
    return "(bez textu)";
  }
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength - 1)}...`;
}

function renderArchiveIndicator() {
  if (!archiveIndicator || !archiveIndicatorTotal || !archiveIndicatorDone) {
    return;
  }

  const doneCount = getDoneNotes().length;

  archiveIndicator.classList.toggle("hidden", doneCount === 0);
  archiveIndicatorTotal.textContent = String(doneCount);
  archiveIndicatorDone.textContent = `Vyřešené ${doneCount}`;
}

function createArchiveEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "note-archive-empty";
  empty.textContent = message;
  return empty;
}

function requestNoteRestore(note) {
  if (!note?.id) {
    return;
  }

  socket.emit("note:toggle", { id: note.id }, (response) => {
    if (!response?.ok) {
      setBoardActionStatus(response?.message || "Obnovení lístku se nepodařilo.", true);
      return;
    }
    setBoardActionStatus("ticket byl vrácen zpět na plochu.");
  });
}

function createArchiveNoteCard(note, status) {
  const card = document.createElement("article");
  card.className = `note-archive-card note-archive-card-${status}`;

  const top = document.createElement("div");
  top.className = "note-archive-card-top";

  const meta = document.createElement("div");
  meta.className = "note-archive-meta";
  const delegation = document.createElement("div");
  delegation.textContent = `Autor: ${note.from} | Řešitel: ${note.to}`;
  const details = document.createElement("div");
  details.textContent = `Priorita: ${formatPriorityLabel(note.priority)}${note.deadline ? ` | Termín: ${note.deadline}` : ""}`;
  meta.append(delegation, details);

  const state = document.createElement("span");
  state.className = `note-archive-state note-archive-state-${status}`;
  state.textContent = formatNoteStatusLabel(note);
  top.append(meta, state);

  const text = document.createElement("p");
  text.className = "note-archive-text";
  text.innerHTML = richTextToDisplayHtml(note.text);
  applyNoteFormatToElement(text, note.format);

  const actions = document.createElement("div");
  actions.className = "note-archive-actions";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "secondary-btn";
  restoreBtn.textContent = "Vrátit na plochu";
  restoreBtn.addEventListener("click", () => {
    requestNoteRestore(note);
  });
  actions.append(restoreBtn);

  card.append(top, text, actions);
  return card;
}

function renderArchiveList(target, items, status, emptyMessage) {
  if (!target) {
    return;
  }

  target.innerHTML = "";
  if (items.length === 0) {
    target.append(createArchiveEmptyState(emptyMessage));
    return;
  }

  items
    .slice()
    .reverse()
    .forEach((note) => {
      target.append(createArchiveNoteCard(note, status));
    });
}

function renderNoteArchive() {
  if (!noteArchiveDoneList) {
    return;
  }

  const doneNotes = getDoneNotes();

  if (noteArchiveSummary) {
    noteArchiveSummary.textContent = `Mimo plochu je ${doneNotes.length} vyřešených lístků.`;
  }
  if (noteArchiveDoneCount) {
    noteArchiveDoneCount.textContent = String(doneNotes.length);
  }

  renderArchiveList(noteArchiveDoneList, doneNotes, "done", "Zatím tu nejsou žádné vyřešené lístky.");
}

function refreshArchivedNotesUi() {
  renderArchiveIndicator();
  if (noteArchive && !noteArchive.classList.contains("hidden")) {
    renderNoteArchive();
  }
}

function openNoteArchive() {
  if (!noteArchive) {
    return;
  }

  if (noteArchiveClosingTimer) {
    clearTimeout(noteArchiveClosingTimer);
    noteArchiveClosingTimer = null;
  }

  renderNoteArchive();
  noteArchive.classList.remove("hidden");
  requestAnimationFrame(() => {
    noteArchive.classList.add("open");
  });
  noteArchive.setAttribute("aria-hidden", "false");
}

function closeNoteArchive(immediate = false) {
  if (!noteArchive) {
    return;
  }

  noteArchive.classList.remove("open");
  noteArchive.setAttribute("aria-hidden", "true");

  if (noteArchiveClosingTimer) {
    clearTimeout(noteArchiveClosingTimer);
    noteArchiveClosingTimer = null;
  }

  if (immediate) {
    noteArchive.classList.add("hidden");
    return;
  }

  noteArchiveClosingTimer = window.setTimeout(() => {
    noteArchive.classList.add("hidden");
    noteArchiveClosingTimer = null;
  }, PREVIEW_ANIMATION_MS);
}

function openConfirmModal({ title, message, confirmLabel, confirmTone = "default", onConfirm }) {
  if (!confirmModal || !confirmModalTitle || !confirmModalMessage || !confirmModalConfirm) {
    onConfirm?.();
    return;
  }

  if (confirmModalClosingTimer) {
    clearTimeout(confirmModalClosingTimer);
    confirmModalClosingTimer = null;
  }

  pendingConfirmAction = typeof onConfirm === "function" ? onConfirm : null;
  confirmModalTitle.textContent = title || "Potvrzení";
  confirmModalMessage.textContent = message || "";
  confirmModalConfirm.textContent = confirmLabel || "Potvrdit";
  confirmModalConfirm.className = confirmTone === "danger" ? "danger-btn" : "secondary-btn";
  confirmModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    confirmModal.classList.add("open");
  });
  confirmModal.setAttribute("aria-hidden", "false");
}

function closeConfirmModal(immediate = false) {
  if (!confirmModal) {
    return;
  }

  confirmModal.classList.remove("open");
  confirmModal.setAttribute("aria-hidden", "true");

  if (confirmModalClosingTimer) {
    clearTimeout(confirmModalClosingTimer);
    confirmModalClosingTimer = null;
  }

  const finish = () => {
    confirmModal.classList.add("hidden");
    pendingConfirmAction = null;
    confirmModalClosingTimer = null;
  };

  if (immediate) {
    finish();
    return;
  }

  confirmModalClosingTimer = window.setTimeout(finish, PREVIEW_ANIMATION_MS);
}

function runPendingConfirmAction() {
  const action = pendingConfirmAction;
  closeConfirmModal(true);
  action?.();
}

function isMyNote(note) {
  return Boolean(me?.name && note?.from === me.name);
}

function isAssignedToMe(_note) {
  return true;
}

function canEditNote(note) {
  return isMyNote(note);
}

function canToggleNote(_note) {
  return true;
}

function canMoveNote(_note) {
  return Boolean(me);
}

function getSelectedMovableNotes() {
  return notes.filter((note) => selectedNoteIds.has(note.id) && isActiveNote(note) && canMoveNote(note));
}

function getSelectedOwnedNotes() {
  return notes.filter((note) => selectedNoteIds.has(note.id) && isActiveNote(note) && isMyNote(note));
}

function closeSelectionContextMenu() {
  selectionContextMenu?.classList.add("hidden");
}

function openSelectionContextMenu(event) {
  const ownedNotes = getSelectedOwnedNotes();
  if (!selectionContextMenu || selectedNoteIds.size === 0) {
    return;
  }

  event.preventDefault();
  selectionContextSummary.textContent = ownedNotes.length === 0
    ? "Ve výběru nemáš vlastní ticket."
    : `Vlastní tickety ve výběru: ${ownedNotes.length}`;
  selectionContextEdit.disabled = ownedNotes.length !== 1;
  selectionContextDone.disabled = ownedNotes.length === 0;
  selectionContextDelete.disabled = ownedNotes.length === 0;
  selectionContextMenu.classList.remove("hidden");

  const menuWidth = selectionContextMenu.offsetWidth;
  const menuHeight = selectionContextMenu.offsetHeight;
  selectionContextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - menuWidth - 8)}px`;
  selectionContextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - menuHeight - 8)}px`;
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

  const ids = Array.from(selectedNoteIds).filter((id) => {
    const note = notes.find((item) => item.id === id);
    return note && isActiveNote(note) && isMyNote(note);
  });
  if (ids.length === 0) {
    setBoardActionStatus("Nejdřív označ vlastní aktivní lístky ke smazání.");
    return;
  }

  openConfirmModal({
    title: "Smazat vybrané lístky?",
    message: `Vybrané lístky (${ids.length}) se trvale smažou z plochy.`,
    confirmLabel: "Smazat vybrané",
    confirmTone: "danger",
    onConfirm: () => {
      socket.emit("note:deleteMany", { ids }, (response) => {
        if (!response?.ok) {
          setBoardActionStatus(response?.message || "Smazání vybraných lístků se nepodařilo.", true);
          return;
        }

        const removedCount = Number(response?.removedCount || 0);
        const deniedCount = Number(response?.deniedCount || 0);
        if (removedCount === 0) {
          setBoardActionStatus(
            deniedCount > 0
              ? "Vybrané lístky nemůžeš smazat."
              : "Vybrané lístky už nejsou aktivní.",
            deniedCount > 0
          );
          return;
        }

        setBoardActionStatus(
          deniedCount > 0
            ? `Smazáno: ${removedCount}. Přeskočeno: ${deniedCount}.`
            : `Smazáno: ${removedCount}.`
        );
      });
    }
  });
}

function markSelectedNotesDone() {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  const ids = getSelectedOwnedNotes().map((note) => note.id);
  if (ids.length === 0) {
    setBoardActionStatus("Nejdřív označ vlastní lístky.");
    return;
  }

  socket.emit("note:markManyDone", { ids }, (response) => {
    if (!response?.ok) {
      setBoardActionStatus(response?.message || "Hromadné označení jako vyřešené se nepodařilo.", true);
      return;
    }

    const updatedCount = Number(response?.updatedCount || 0);
    const deniedCount = Number(response?.deniedCount || 0);
    const alreadyDoneCount = Number(response?.alreadyDoneCount || 0);

    if (updatedCount === 0) {
      if (deniedCount > 0) {
        setBoardActionStatus("Vybrané lístky nemůžeš označit jako vyřešené.", true);
        return;
      }

      if (alreadyDoneCount > 0) {
        setBoardActionStatus("Vybrané lístky už jsou vyřešené.");
        return;
      }

      setBoardActionStatus("Vybrané lístky už neexistují.");
      return;
    }

    const details = [];
    if (alreadyDoneCount > 0) {
      details.push(`už vyřešené: ${alreadyDoneCount}`);
    }
    if (deniedCount > 0) {
      details.push(`bez oprávnění: ${deniedCount}`);
    }

    setBoardActionStatus(
      details.length > 0
        ? `Označeno jako vyřešené: ${updatedCount} (${details.join(", ")}).`
        : `Označeno jako vyřešené: ${updatedCount}.`
    );
  });
}

function isMyBoardText(_item) {
  return true;
}

function canEditBoardText(_item) {
  return true;
}

function setActiveBoardText(id) {
  activeBoardTextId = id || null;
  boardCanvas.querySelectorAll(".board-text-node.selected").forEach((element) => {
    element.classList.toggle("selected", element.dataset.id === activeBoardTextId);
  });
}

function clearActiveBoardText() {
  setActiveBoardText(null);
}

function editBoardText(item, element) {
  if (!canEditBoardText(item)) {
    setBoardActionStatus("Tento text může upravit jen jeho autor nebo admin.", true);
    return;
  }

  if (!element) {
    return;
  }

  const existingEditor = element.querySelector(".board-text-editor");
  if (existingEditor) {
    existingEditor.querySelector("textarea")?.focus();
    return;
  }

  const textBody = element.querySelector(".board-text-body");
  const previousHeight = element.style.height;
  const previousOverflow = element.style.overflow;
  const previousMinHeight = element.style.minHeight;
  const editor = document.createElement("form");
  editor.className = "board-text-editor";

  const textarea = document.createElement("textarea");
  textarea.value = item.text || "";
  textarea.maxLength = 300;
  textarea.required = true;

  const actions = document.createElement("div");
  actions.className = "board-text-editor-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "Uložit";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "danger-btn";
  deleteBtn.textContent = "Smazat";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "secondary-btn";
  cancelBtn.textContent = "Zrušit";

  actions.append(saveBtn, deleteBtn, cancelBtn);
  editor.append(textarea, actions);
  element.classList.add("editing");
  element.style.minHeight = previousHeight || `${BOARD_TEXT_HEIGHT}px`;
  element.style.height = "auto";
  element.style.overflow = "visible";
  textBody?.classList.add("hidden");
  element.append(editor);

  const closeEditor = () => {
    editor.remove();
    element.classList.remove("editing");
    element.style.height = previousHeight;
    element.style.overflow = previousOverflow;
    element.style.minHeight = previousMinHeight;
    textBody?.classList.remove("hidden");
  };

  editor.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      setBoardActionStatus("Text nemůže být prázdný.", true);
      return;
    }

    socket.emit("text:update", { id: item.id, text, size: normalizeBoardTextSize(item.size) }, (response) => {
      if (!response?.ok) {
        setBoardActionStatus(response?.message || "Úprava textu se nepodařila.", true);
        return;
      }

      setBoardActionStatus("Text byl upraven.");
      closeEditor();
    });
  });

  deleteBtn.addEventListener("click", () => {
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

  cancelBtn.addEventListener("click", () => {
    closeEditor();
  });

  textarea.focus();
  textarea.select();
}

function emitBoardTextResize(item, width, height, ack) {
  socket.emit("text:resize", { id: item.id, width, height, size: item.size }, ack);
}

function emitNoteResize(note, width, height, ack) {
  socket.emit("note:resize", { id: note.id, width, height }, ack);
}

function startNoteResize(note, element, event) {
  resizingNote = note;
  resizingNoteElement = element;
  activeNoteResizePointerId = event.pointerId;
  noteResizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: Number.isFinite(note.width) ? note.width : NOTE_DEFAULT_WIDTH,
    height: Number.isFinite(note.height) ? note.height : NOTE_DEFAULT_HEIGHT
  };
  lastNoteResizeEmitAt = 0;
  element.classList.add("resizing");
  element.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function startBoardTextResize(item, element, event) {
  resizingBoardText = item;
  resizingBoardTextElement = element;
  activeTextResizePointerId = event.pointerId;
  textResizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH,
    height: Number.isFinite(item.height) ? item.height : BOARD_TEXT_HEIGHT,
    size: normalizeBoardTextSize(item.size)
  };
  lastTextResizeEmitAt = 0;
  element.classList.add("resizing");
  element.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
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

    if (targetTextarea.isContentEditable) {
      targetTextarea.textContent = clipboardText;
    } else {
      targetTextarea.value = clipboardText;
    }
    targetTextarea.focus();
    updateFormatButtonsState(targetTextarea);
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

  if (targetTextarea.isContentEditable) {
    targetTextarea.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && targetTextarea.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      targetTextarea.append(document.createTextNode(text));
    }
    updateFormatButtonsState(targetTextarea);
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

  document.querySelectorAll(".emoji-toggle-btn").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const wrap = toggleBtn.closest(".emoji-picker-wrap");
      const palette = wrap?.querySelector(".emoji-palette");
      if (!palette) {
        return;
      }
      const isOpen = !palette.hidden;
      document.querySelectorAll(".emoji-palette").forEach((p) => {
        p.hidden = true;
        p.style.top = "";
        p.style.left = "";
        p.style.transform = "";
        p.closest(".emoji-picker-wrap")?.querySelector(".emoji-toggle-btn")?.setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        palette.hidden = false;
        const rect = toggleBtn.getBoundingClientRect();
        const panelWidth = palette.offsetWidth || 334;
        const panelHeight = palette.offsetHeight || 220;
        let left = rect.left;
        if (left + panelWidth > window.innerWidth - 8) {
          left = Math.max(8, rect.right - panelWidth);
        }
        if (left < 8) {
          left = 8;
        }
        const spaceAbove = rect.top - 8;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        if (spaceAbove >= panelHeight || spaceAbove > spaceBelow) {
          const top = Math.max(8, rect.top - panelHeight - 6);
          palette.style.top = `${top}px`;
          palette.style.transform = "";
        } else {
          const top = Math.min(window.innerHeight - panelHeight - 8, rect.bottom + 6);
          palette.style.top = `${Math.max(8, top)}px`;
          palette.style.transform = "";
        }
        palette.style.left = `${left}px`;
        toggleBtn.setAttribute("aria-expanded", "true");
      }
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

function updateFormatButtonsState(editor) {
  const toolbar = getEditorToolbar(editor);
  if (!editor || !toolbar) {
    return;
  }

  setNoteFormatToolbar(toolbar, getEditorFormatState(editor));
  const pendingState = getPendingInlineFormatState(editor);

  ["bold", "italic"].forEach((action) => {
    const button = toolbar.querySelector(`[data-format-action="${action}"]`);
    if (!button) {
      return;
    }
    const selection = window.getSelection?.();
    const anchorNode = selection?.anchorNode || null;
    const shouldUseQueryCommandState = isSelectionInsideEditor(editor) && anchorNode && anchorNode !== editor;
    let active = false;
    try {
      active = shouldUseQueryCommandState ? document.queryCommandState(action) : false;
    } catch {
      active = false;
    }

    if (!active) {
      active = action === "bold"
        ? hasInlineFormatInSelection(editor, ["b", "strong"])
        : hasInlineFormatInSelection(editor, ["i", "em"]);
    }

    if (!active && pendingState) {
      active = Boolean(pendingState[action]);
    }

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function clearFormatButtonsState(editor) {
  const toolbar = getEditorToolbar(editor);
  if (!toolbar) {
    return;
  }

  setNoteFormatToolbar(toolbar, getEditorFormatState(editor));
  toolbar.querySelectorAll("[data-format-action]").forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
}

function applyToolbarFormatToEditor(editor, toolbar) {
  if (!editor || !toolbar) {
    return;
  }
  applyNoteFormatToElement(editor, getNoteFormatFromToolbar(toolbar));
  updateFormatButtonsState(editor);
}

[noteText, boardInlineText, notePreviewEditText].forEach((editor) => {
  if (!editor) {
    return;
  }
  ["keyup", "mouseup", "focus"].forEach((eventName) => {
    editor.addEventListener(eventName, () => {
      if (eventName === "keyup" || eventName === "mouseup" || eventName === "focus") {
        clearPendingInlineFormatSelection(editor);
      }
      if (eventName === "focus") {
        normalizeInlineTypingMode(editor);
      }
      saveSelectionForEditor(editor);
      updateFormatButtonsState(editor);
    });
  });
  editor.addEventListener("input", () => {
    clearPendingInlineFormatSelection(editor);
    saveSelectionForEditor(editor);
    updateFormatButtonsState(editor);
  });
  editor.addEventListener("blur", () => {
    clearPendingInlineFormatSelection(editor);
    clearFormatButtonsState(editor);
  });
});

document.addEventListener("selectionchange", () => {
  const editor = getSelectionEditor();
  if (!editor) {
    clearPendingInlineFormatSelection();
    return;
  }

  const selection = window.getSelection?.();
  if (selection?.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
    clearPendingInlineFormatSelection(editor);
  }

  saveSelectionForEditor(editor);
  updateFormatButtonsState(editor);
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const formatButton = target.closest(".format-btn");
  if (!(formatButton instanceof HTMLElement)) {
    return;
  }

  const editor = getEmojiTargetTextarea(formatButton);
  if (editor?.isContentEditable) {
    saveSelectionForEditor(editor);
  }

  event.preventDefault();
});

function getVisibleNotes() {
  const filter = assigneeFilter.value || "Vsechny";
  return notes.filter((note) => isNoteVisibleOnBoard(note) && (filter === "Vsechny" || note.to === filter));
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
  clearRichEditor(boardInlineText);
  if (boardInlineTitle) {
    boardInlineTitle.textContent = boardInlineCreateMode === "note" ? NOTE_FORM_TITLE : BOARD_TEXT_TITLE;
  }
  if (boardInlineControlTitle) {
    boardInlineControlTitle.textContent =
      boardInlineCreateMode === "note" ? NOTE_FORM_CONTROL_TITLE : BOARD_TEXT_CONTROL_TITLE;
  }
  boardInlineText.dataset.placeholder =
    boardInlineCreateMode === "note" ? NOTE_FORM_TEXT_PLACEHOLDER : BOARD_TEXT_PLACEHOLDER;
  if (boardInlineNoteFields) {
    boardInlineNoteFields.classList.toggle("hidden", boardInlineCreateMode !== "note");
  }
  if (boardInlineFromUser) {
    setAuthorFieldValue(boardInlineFromUser, me?.name || "");
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
  if (boardInlineIsDelegated) {
    boardInlineIsDelegated.checked = false;
  }
  renderDelegatedSourceSelects();
  boardInlineSelectedColor = selectedNoteColor;
  resetNoteFormatToolbar(boardInlineFormatToolbar);
  applyToolbarFormatToEditor(boardInlineText, boardInlineFormatToolbar);
  renderBoardInlinePalette();
  if (boardInlineSubmit) {
    boardInlineSubmit.textContent = boardInlineCreateMode === "note" ? "Přidat ticket" : "Přidat text";
  }
  boardInlineText.focus();
}

function openBoardInlineComposerAtViewportCenter(mode = "text") {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  if (!board) {
    return;
  }

  closeNotePreview()
  closeBoardQuickCreate();
  openBoardInlineComposerAtPosition(
    board.scrollLeft + (board.clientWidth / 2),
    board.scrollTop + (board.clientHeight / 2),
    mode
  );
}

function closeBoardInlineComposer() {
  if (!boardInlineComposer || !boardInlineText) {
    return;
  }

  boardInlineComposer.classList.add("hidden");
  boardInlineComposer.dataset.mode = "";
  clearRichEditor(boardInlineText);
  resetNoteFormatToolbar(boardInlineFormatToolbar);
  if (boardInlineIsDelegated) {
    boardInlineIsDelegated.checked = false;
  }
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

  const doneNotes = notes.filter((note) => getNoteStatus(note) === "done");
  if (doneNotes.length === 0) {
    donePositionText.classList.add("hidden");
    return;
  }

  donePositionText.classList.remove("hidden");

  const doneBounds = doneNotes.map((note) => getNoteBounds(note));
  const doneMinX = Math.min(...doneNotes.map((note) => note.x));
  const doneMaxX = Math.max(...doneNotes.map((note, index) => note.x + doneBounds[index].width));
  const doneMinY = Math.min(...doneNotes.map((note) => note.y));
  const doneMaxY = Math.max(...doneNotes.map((note, index) => note.y + doneBounds[index].height));
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
    donePositionText.textContent = "Vyřešené lístky jsou právě v aktuálním pohledu. Klikni pro přesun.";
    return;
  }

  donePositionText.textContent = `Vyřešené lístky jsou mimo aktuální výřez: ${hints.join(", ")}. Klikni pro přesun.`;
}

function navigateToDoneNotes() {
  if (!board) {
    return;
  }

  const doneNotes = notes.filter((note) => getNoteStatus(note) === "done");
  if (doneNotes.length === 0) {
    return;
  }

  const doneBounds = doneNotes.map((note) => getNoteBounds(note));
  const doneMinX = Math.min(...doneNotes.map((note) => note.x));
  const doneMaxX = Math.max(...doneNotes.map((note, index) => note.x + doneBounds[index].width));
  const doneMinY = Math.min(...doneNotes.map((note) => note.y));
  const doneMaxY = Math.max(...doneNotes.map((note, index) => note.y + doneBounds[index].height));

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

  const richText = getRichEditorValue(boardInlineText);
  const plainText = richTextToPlain(richText);
  if (!plainText) {
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
      text: richText,
      to: toValue,
      isDelegated: Boolean(boardInlineIsDelegated?.checked),
      priority: priorityValue,
      deadline: deadlineValue,
      color: boardInlineSelectedColor,
      format: getNoteFormatFromToolbar(boardInlineFormatToolbar),
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
      text: plainText,
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
  applyBoardTextSizeToElement(textEl, item.size);
  textEl.classList.toggle("selected", activeBoardTextId === item.id);
  textEl.dataset.id = item.id;
  textEl.style.left = `${item.x}px`;
  textEl.style.top = `${item.y}px`;
  textEl.style.width = `${Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH}px`;
  textEl.style.maxWidth = `${Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH}px`;
  textEl.style.height = `${Number.isFinite(item.height) ? item.height : BOARD_TEXT_HEIGHT}px`;
  textEl.title = `${item.author || "Uživatel"}: ${item.text}`;

  const textBody = document.createElement("span");
  textBody.className = "board-text-body";

  const textContent = document.createElement("span");
  textContent.className = "board-text-content";
  textContent.textContent = item.text;

  const resizeHandle = document.createElement("button");
  resizeHandle.type = "button";
  resizeHandle.className = "board-text-resize";
  resizeHandle.setAttribute("aria-label", "Změnit velikost tažením");
  resizeHandle.title = "Změnit velikost tažením";

  const canEdit = canEditBoardText(item);
  if (!canEdit) {
    resizeHandle.classList.add("hidden");
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    setActiveBoardText(item.id);
    startBoardTextResize(item, textEl, event);
  });

  textBody.append(textContent, resizeHandle);
  textEl.append(textBody);

  textEl.addEventListener("dblclick", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setActiveBoardText(item.id);
    editBoardText(item, textEl);
  });

  textEl.addEventListener("pointerdown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".board-text-resize, .note-resize, button, textarea, .board-text-editor")) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    setActiveBoardText(item.id);
    draggedBoardText = item;
    draggedBoardTextElement = textEl;
    activeTextPointerId = event.pointerId;

    const boardRect = board.getBoundingClientRect();
    textDragOffset.x = event.clientX - boardRect.left - item.x + board.scrollLeft;
    textDragOffset.y = event.clientY - boardRect.top - item.y + board.scrollTop;

    boardCanvas.append(textEl);
    textEl.style.zIndex = "18";
    textEl.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  return textEl;
}

function getClientDoneLanePosition(currentNoteId) {
  const doneWithoutCurrent = notes
    .filter((note) => getNoteStatus(note) === "done" && note.id !== currentNoteId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const activeNotes = notes.filter((note) => isActiveNote(note));

  const index = doneWithoutCurrent.length;
  const ring = Math.floor(index / CLIENT_DONE_OVAL_POINTS_PER_RING);
  const slot = index % CLIENT_DONE_OVAL_POINTS_PER_RING;
  const angle = -Math.PI / 2 + (slot / CLIENT_DONE_OVAL_POINTS_PER_RING) * Math.PI * 2;
  const radiusX = CLIENT_DONE_OVAL_RADIUS_X + ring * CLIENT_DONE_OVAL_RING_STEP_X;
  const radiusY = CLIENT_DONE_OVAL_RADIUS_Y + ring * CLIENT_DONE_OVAL_RING_STEP_Y;
  const activeRightEdge =
    activeNotes.length > 0 ? Math.max(...activeNotes.map((note) => {
      const bounds = getNoteBounds(note);
      return note.x + bounds.width;
    })) : 0;
  const minLeftEdgeForDone = activeRightEdge + CLIENT_DONE_ACTIVE_GAP_PX;
  const doneCenterX = Math.max(CLIENT_DONE_OVAL_BASE_CENTER_X, minLeftEdgeForDone + radiusX);

  return {
    x: Math.round(doneCenterX + Math.cos(angle) * radiusX),
    y: Math.round(CLIENT_DONE_OVAL_CENTER_Y + Math.sin(angle) * radiusY)
  };
}

function getAlignmentItems(kind, currentId) {
  const visibleNotes = getVisibleNotes().map((note) => {
    const bounds = getNoteBounds(note);
    return {
      id: note.id,
      kind: "note",
      x: note.x,
      y: note.y,
      width: bounds.width,
      height: bounds.height
    };
  });

  const textItems = boardTexts.map((item) => ({
    id: item.id,
    kind: "text",
    x: item.x,
    y: item.y,
    width: Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH,
    height: Number.isFinite(item.height) ? item.height : BOARD_TEXT_HEIGHT
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
  const left = Math.min(selectionStart.x, selectionCurrent.x);
  const top = Math.min(selectionStart.y, selectionCurrent.y);
  selectionRectEl.style.left = `${left}px`;
  selectionRectEl.style.top = `${top}px`;
  selectionRectEl.style.width = `${Math.abs(selectionCurrent.x - selectionStart.x)}px`;
  selectionRectEl.style.height = `${Math.abs(selectionCurrent.y - selectionStart.y)}px`;
  selectionRectEl.classList.remove("hidden");
}

function updateSelectedNotesByArea() {
  if (!selectionStart || !selectionCurrent) {
    return;
  }

  const left = Math.min(selectionStart.x, selectionCurrent.x);
  const right = Math.max(selectionStart.x, selectionCurrent.x);
  const top = Math.min(selectionStart.y, selectionCurrent.y);
  const bottom = Math.max(selectionStart.y, selectionCurrent.y);
  const scale = getNoteScale();

  selectedNoteIds = new Set(
    getVisibleNotes()
      .filter((note) => {
        const bounds = getNoteBounds(note);
        const noteRight = note.x + bounds.width * scale;
        const noteBottom = note.y + bounds.height * scale;
        return note.x <= right && noteRight >= left && note.y <= bottom && noteBottom >= top;
      })
      .map((note) => note.id)
  );

  boardCanvas.querySelectorAll(".sticky").forEach((stickyEl) => {
    stickyEl.classList.toggle("selected", selectedNoteIds.has(stickyEl.dataset.id));
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
  sticky.classList.add("appear");
  sticky.addEventListener("animationend", () => sticky.classList.remove("appear"), { once: true });
  sticky.style.background = note.color;
  sticky.style.left = `${note.x}px`;
  sticky.style.top = `${note.y}px`;
  sticky.style.width = `${Number.isFinite(note.width) ? note.width : NOTE_DEFAULT_WIDTH}px`;
  sticky.style.height = `${Number.isFinite(note.height) ? note.height : NOTE_DEFAULT_HEIGHT}px`;
  sticky.style.setProperty("--tilt", `${Math.random() * 6 - 3}deg`);

  text.innerHTML = richTextToDisplayHtml(note.text);
  applyNoteFormatToElement(text, note.format);
  delegation.textContent = `${note.from} -> ${note.to}`;
  details.textContent = `P:${formatPriorityLabel(note.priority)}${note.deadline ? ` | T:${note.deadline}` : ""}`;
  text.title = richTextToPlain(note.text);
  delegation.title = `Autor: ${note.from} | Řešitel: ${note.to}`;
  details.title = `Priorita: ${formatPriorityLabel(note.priority)}${note.deadline ? ` | Termín: ${note.deadline}` : ""}`;
  doneToggle.textContent = getNoteStatus(note) === "done" ? "Obnovit" : "Vyřešeno";
  sticky.classList.toggle("done", getNoteStatus(note) === "done");
  sticky.classList.toggle("selected", selectedNoteIds.has(note.id));

  const canDelete = canEditNote(note);
  if (!canDelete) {
    deleteToggle.classList.add("hidden");
  }

  if (!canToggleNote(note)) {
    doneToggle.classList.add("hidden");
  }

  if (canToggleNote(note)) {
    doneToggle.addEventListener("click", () => {
      const waitsForSourceResolution = isActiveNote(note) && Boolean(sanitizeLinkedSourceNoteId(note.linkedSourceNoteId));
      openConfirmModal({
        title: "Přesunout ticket do vyřešených?",
        message: waitsForSourceResolution
          ? `ticket \"${getNoteSummary(note, 64)}\" bude označen jako vyřešený, ale zůstane na ploše, dokud nebude vyřešen i navázaný ticket zadavatele.`
          : `ticket \"${getNoteSummary(note, 64)}\" se přesune mimo plochu do archivu vyřešených.`,
        confirmLabel: "Přesunout do vyřešených",
        onConfirm: () => {
          socket.emit("note:toggle", { id: note.id }, (response) => {
            if (!response?.ok && response?.message) {
              setBoardActionStatus(response.message, true);
              return;
            }
            setBoardActionStatus(
              waitsForSourceResolution
                ? "ticket byl označen jako vyřešený a zůstává na ploše do vyřešení zadání."
                : "ticket byl přesunut do vyřešených."
            );
          });
        }
      });
    });
  }

  deleteToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    openConfirmModal({
      title: "Smazat ticket?",
      message: `ticket \"${getNoteSummary(note, 64)}\" se trvale smaže z plochy.`,
      confirmLabel: "Smazat ticket",
      confirmTone: "danger",
      onConfirm: () => {
        socket.emit("note:delete", { id: note.id }, (response) => {
          if (!response?.ok && response?.message) {
            setBoardActionStatus(response.message, true);
            return;
          }
          setBoardActionStatus("ticket byl smazán.");
        });
      }
    });
  });

  const resizeHandle = document.createElement("button");
  resizeHandle.type = "button";
  resizeHandle.className = "note-resize";
  resizeHandle.setAttribute("aria-label", "Změnit velikost tažením");
  resizeHandle.title = "Změnit velikost tažením";

  const canResize = canEditNote(note);
  if (!canResize) {
    resizeHandle.classList.add("hidden");
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    startNoteResize(note, sticky, event);
  });

  sticky.append(resizeHandle);

  sticky.addEventListener("pointerdown", (event) => {
    if (!isActiveNote(note) || !canMoveNote(note)) {
      return;
    }

    if (event.target.closest(".done-toggle") || event.target.closest(".delete-toggle") || event.target.closest(".note-resize") || event.target.closest(".board-text-resize") || event.button !== 0) {
      return;
    }

    const boardRect = board.getBoundingClientRect();
    pendingNoteDrag = {
      note,
      element: sticky,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      dragOffsetX: event.clientX - boardRect.left - note.x + board.scrollLeft,
      dragOffsetY: event.clientY - boardRect.top - note.y + board.scrollTop
    };
    sticky.classList.add("drag-pending");
    window.getSelection?.()?.removeAllRanges();
    event.preventDefault();
  });

  sticky.addEventListener("dblclick", (event) => {
    if (event.target.closest(".done-toggle") || event.target.closest(".delete-toggle") || event.target.closest(".pin")) {
      return;
    }
    openNotePreview(note);
  });

  return sticky;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  boardTexts.forEach((item) => {
    try {
      fragment.append(createBoardTextElement(item));
    } catch (error) {
      console.error("Nepodarilo se vykreslit text na plose", item, error);
    }
  });

  getVisibleNotes().forEach((note) => {
    try {
      fragment.append(createStickyElement(note));
    } catch (error) {
      console.error("Nepodarilo se vykreslit listek", note, error);
    }
  });

  boardCanvas.querySelectorAll(".sticky, .board-text-node").forEach((item) => {
    item.remove();
  });

  boardCanvas.append(fragment);
  renderNoteConnections();

  ensureGuideElements();
  hideAlignmentGuides();
  ensureSelectionRect();
  clearSelectionVisual();
  updateDonePositionHints();
  refreshArchivedNotesUi();
  renderDelegatedSourceSelects();
}

function removeRenderedBoardItem(selector) {
  const element = boardCanvas?.querySelector(selector);
  if (element) {
    element.remove();
  }

  ensureGuideElements();
  hideAlignmentGuides();
  ensureSelectionRect();
  clearSelectionVisual();
  updateDonePositionHints();
  refreshArchivedNotesUi();
  renderNoteConnections();
  renderDelegatedSourceSelects();
}

function syncNoteAfterServerUpdate(note, previousStatus = "active") {
  if (!note?.id) {
    return;
  }

  const currentStatus = getNoteStatus(note);
  const selector = `.sticky[data-id="${note.id}"]`;
  const isStillVisibleOnBoard = isNoteVisibleOnBoard(note);

  if (currentStatus !== "active") {
    selectedNoteIds.delete(note.id);
    if (!isStillVisibleOnBoard && activePreviewNoteId === note.id) {
      closeNotePreview();
    }
    if (dragged && dragged.id === note.id) {
      dragged = null;
      draggedElement = null;
      activePointerId = null;
    }

    if (!isStillVisibleOnBoard) {
      removeRenderedBoardItem(selector);
      refreshArchivedNotesUi();
      return;
    }

    renderBoard();
    if (activePreviewNoteId === note.id) {
      refreshOpenPreview();
    }
    return;
  }

  const bounds = getNoteBounds(note);
  ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);

  if (previousStatus !== "active") {
    renderBoard();
    if (note.id === activePreviewNoteId) {
      refreshOpenPreview();
    }
    return;
  }

  renderBoard();
  if (note.id === activePreviewNoteId) {
    refreshOpenPreview();
  }
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

guestLoginBtn?.addEventListener("click", () => {
  loginError.textContent = "";
  loginError.classList.remove("is-success");
  socket.emit("auth:guest");
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!me) {
    return;
  }

  const text = getRichEditorValue(noteText);
  if (!text) {
    return;
  }

  socket.emit("note:create", {
    text,
    to: toUser.value,
    isDelegated: Boolean(noteIsDelegated?.checked),
    priority: priority.value,
    deadline: deadline.value,
    color: selectedNoteColor,
    format: getNoteFormatFromToolbar(noteFormatToolbar),
    x: snapToGrid(80 + Math.random() * 460),
    y: snapToGrid(70 + Math.random() * 240)
  });

  noteForm.reset();
  clearRichEditor(noteText);
  setAuthorFieldValue(fromUser, me?.name || "");
  if (noteIsDelegated) {
    noteIsDelegated.checked = false;
  }
  selectedNoteColor = noteColors[0];
  resetNoteFormatToolbar(noteFormatToolbar);
  renderNotePalette();
  renderDelegatedSourceSelects();
  closeDockPanel();
});

function handleBoardSurfaceDoubleClick(event) {
  if (!me) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (
    target.closest(".sticky") ||
    target.closest(".board-inline-composer") ||
    target.closest(".board-text-node") ||
    target.closest(".board-quick-create") ||
    target.closest(".board-nav-hints")
  ) {
    return;
  }

  event.preventDefault();
  window.getSelection?.()?.removeAllRanges();
  closeNotePreview();
  closeBoardInlineComposer();
  openBoardQuickCreateAt(event.clientX, event.clientY);
}

board?.addEventListener("dblclick", handleBoardSurfaceDoubleClick);

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

  clearActiveBoardText();

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

boardCanvas?.addEventListener("contextmenu", (event) => {
  openSelectionContextMenu(event);
});

assigneeFilter.addEventListener("change", renderBoard);

toUser?.addEventListener("change", renderDelegatedSourceSelects);
boardInlineToUser?.addEventListener("change", renderDelegatedSourceSelects);
notePreviewEditTo?.addEventListener("change", renderDelegatedSourceSelects);
noteIsDelegated?.addEventListener("change", renderDelegatedSourceSelects);
boardInlineIsDelegated?.addEventListener("change", renderDelegatedSourceSelects);
notePreviewEditIsDelegated?.addEventListener("change", renderDelegatedSourceSelects);

dockToggleNote?.addEventListener("click", () => {
  openDockSection("note");
});

dockToggleFilter?.addEventListener("click", () => {
  openDockSection("filter");
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
    setPreviewEditStatus("ticket už neexistuje.", true);
    return;
  }

  if (!canEditNote(note)) {
    setPreviewEditStatus("Tento ticket může upravit jen autor nebo admin.", true);
    return;
  }

  if (!socket.connected) {
    setPreviewEditStatus("Spojení se serverem není aktivní. Obnov stránku nebo restartuj server.", true);
    return;
  }

  const text = getRichEditorValue(notePreviewEditText);
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
      isDelegated: Boolean(notePreviewEditIsDelegated?.checked),
      priority: notePreviewEditPriority.value,
      deadline: notePreviewEditDeadline.value,
      color: previewEditSelectedColor,
      format: getNoteFormatFromToolbar(notePreviewEditFormatToolbar)
    },
    (response) => {
      clearPendingPreviewUpdateTimer();
      if (!response?.ok) {
        setPreviewEditStatus(response?.message || "Úprava lístku se nepodařila.", true);
        return;
      }

      setPreviewEditStatus("ticket byl upraven.");
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
    closeSelectionContextMenu();
    closeNotePreview();
    closeDockPanel();
    closeBoardQuickCreate();
    closeBoardInlineComposer();
    clearSelection();
    clearActiveBoardText();
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

document.addEventListener("pointerdown", (event) => {
  if (!selectionContextMenu || selectionContextMenu.classList.contains("hidden")) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!selectionContextMenu.contains(target)) {
    closeSelectionContextMenu();
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
  if (!(target instanceof Element)) {
    return;
  }

  const formatButton = target.closest(".format-btn");
  if (formatButton instanceof HTMLElement) {
    const action = formatButton.dataset.formatAction;
    const editor = getEmojiTargetTextarea(formatButton);
    if (editor && editor.isContentEditable && (action === "bold" || action === "italic")) {
      const pendingRange = pendingInlineFormatSelection?.editor === editor ? pendingInlineFormatSelection.range : null;
      const cachedRange = lastRichEditorSelection?.editor === editor ? lastRichEditorSelection.range : null;
      const liveSelection = window.getSelection?.();
      const liveRange = liveSelection && liveSelection.rangeCount > 0 ? liveSelection.getRangeAt(0) : null;
      const effectiveRange = [liveRange, pendingRange, cachedRange].find((range) => range && !range.collapsed)
        || liveRange
        || pendingRange
        || cachedRange;
      const hadSelection = Boolean(effectiveRange && !effectiveRange.collapsed);
      const formatTags = action === "bold" ? ["b", "strong"] : ["i", "em"];
      const restored = effectiveRange
        ? restoreRangeForEditor(editor, effectiveRange)
        : restoreSelectionForEditor(editor);
      if (!restored) {
        editor.focus();
      }
      try {
        document.execCommand("styleWithCSS", false, false);
      } catch {
        /* older browsers ignore this */
      }
      document.execCommand(action, false);
      if (hadSelection) {
        window.setTimeout(() => {
          rememberPendingInlineFormatSelection(editor);
          moveCaretAfterInlineFormat(editor, formatTags);
          normalizeInlineTypingMode(editor);
          saveSelectionForEditor(editor);
          updateFormatButtonsState(editor);
        }, 0);
      } else {
        clearPendingInlineFormatSelection(editor);
        normalizeInlineTypingMode(editor);
        saveSelectionForEditor(editor);
        updateFormatButtonsState(editor);
      }
    }
    const field = formatButton.dataset.formatField;
    const value = formatButton.dataset.formatValue;
    if (editor && field && value) {
      const toolbar = formatButton.closest(".text-format-toolbar");
      if (toolbar) {
        setNoteFormatToolbar(toolbar, {
          ...getEditorFormatState(editor),
          [field]: value
        });
        applyToolbarFormatToEditor(editor, toolbar);
        editor.focus();
      }
    }
    return;
  }

  const emojiButton = target.closest(".emoji-btn");
  if (!(emojiButton instanceof HTMLElement)) {
    return;
  }

  const emoji = emojiButton.dataset.emoji || "";
  insertTextAtCursor(getEmojiTargetTextarea(emojiButton), emoji);
  // zavrít panel po výběru
  const openPalette = emojiButton.closest(".emoji-palette");
  if (openPalette) {
    openPalette.hidden = true;
    openPalette.style.top = "";
    openPalette.style.left = "";
    openPalette.style.transform = "";
    openPalette.closest(".emoji-picker-wrap")?.querySelector(".emoji-toggle-btn")?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  if (!event.target.closest(".emoji-picker-wrap")) {
    document.querySelectorAll(".emoji-palette").forEach((p) => {
      if (!p.hidden) {
        p.hidden = true;
        p.style.top = "";
        p.style.left = "";
        p.style.transform = "";
        p.closest(".emoji-picker-wrap")?.querySelector(".emoji-toggle-btn")?.setAttribute("aria-expanded", "false");
      }
    });
  }
});

archiveIndicator?.addEventListener("click", () => {
  openNoteArchive();
});

noteArchive?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeArchive === "true") {
    closeNoteArchive();
  }
});

noteArchiveClose?.addEventListener("click", () => {
  closeNoteArchive();
});

confirmModal?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeConfirm === "true") {
    closeConfirmModal();
  }
});

confirmModalCancel?.addEventListener("click", () => {
  closeConfirmModal();
});

confirmModalConfirm?.addEventListener("click", () => {
  runPendingConfirmAction();
});

deleteAllBtn?.addEventListener("click", () => {
  if (!me) {
    setBoardActionStatus("Nejdříve se přihlas.", true);
    return;
  }

  const activeCount = notes.filter((note) => isActiveNote(note)).length;
  if (activeCount === 0) {
    setBoardActionStatus("Na ploše není žádný aktivní ticket.");
    return;
  }

  openConfirmModal({
    title: "Smazat všechny aktivní lístky?",
    message: `Všechny aktivní lístky (${activeCount}) se trvale smažou z plochy.`,
    confirmLabel: "Smazat vše",
    confirmTone: "danger",
    onConfirm: () => {
      socket.emit("note:deleteAll", {}, (response) => {
        if (!response?.ok) {
          setBoardActionStatus(response?.message || "Smazání všech lístků se nepodařilo.", true);
          return;
        }

        if (response?.removedCount === 0) {
          setBoardActionStatus("Na ploše není žádný aktivní ticket.");
          return;
        }

        setBoardActionStatus(`Smazáno lístků: ${response.removedCount}.`);
      });
    }
  });
});

deleteSelectedBtn?.addEventListener("click", () => {
  deleteSelectedNotes();
});

markSelectedDoneBtn?.addEventListener("click", () => {
  markSelectedNotesDone();
});

selectionContextEdit?.addEventListener("click", () => {
  const [note] = getSelectedOwnedNotes();
  closeSelectionContextMenu();
  if (!note || getSelectedOwnedNotes().length !== 1) {
    return;
  }

  openNotePreview(note);
  enterPreviewEditMode();
});

selectionContextDone?.addEventListener("click", () => {
  closeSelectionContextMenu();
  markSelectedNotesDone();
});

selectionContextDelete?.addEventListener("click", () => {
  closeSelectionContextMenu();
  deleteSelectedNotes();
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

  if (pendingNoteDrag) {
    if (event.pointerId !== pendingNoteDrag.pointerId) {
      return;
    }

    const scale = getNoteScale();
    const deltaX = (event.clientX - pendingNoteDrag.startClientX) / scale;
    const deltaY = (event.clientY - pendingNoteDrag.startClientY) / scale;

    if (Math.hypot(deltaX, deltaY) < NOTE_DRAG_START_THRESHOLD) {
      return;
    }

    dragged = pendingNoteDrag.note;
    draggedElement = pendingNoteDrag.element;
    activePointerId = pendingNoteDrag.pointerId;
    dragOffset.x = pendingNoteDrag.dragOffsetX;
    dragOffset.y = pendingNoteDrag.dragOffsetY;
    draggedElement.classList.remove("drag-pending");

    const selectedMovable = getSelectedMovableNotes();
    if (selectedNoteIds.has(dragged.id) && selectedMovable.length > 1) {
      draggedSelection = selectedMovable.map((item) => ({
        note: item,
        startX: item.x,
        startY: item.y,
        element: boardCanvas.querySelector(`.sticky[data-id="${item.id}"]`)
      }));

      draggedSelection.forEach((entry) => {
        if (entry.element) {
          boardCanvas.append(entry.element);
          entry.element.classList.add("dragging");
          entry.element.style.zIndex = "10";
        }
      });
    } else {
      draggedSelection = null;
    }

    boardCanvas.append(draggedElement);
    draggedElement.classList.add("dragging");
    draggedElement.style.zIndex = "10";
    draggedElement.setPointerCapture(activePointerId);
    pendingNoteDrag = null;
  }

  if (resizingBoardText && resizingBoardTextElement) {
    if (activeTextResizePointerId !== null && event.pointerId !== activeTextResizePointerId) {
      return;
    }

    const scale = getNoteScale();
    const deltaX = (event.clientX - textResizeStart.x) / scale;
    const deltaY = (event.clientY - textResizeStart.y) / scale;
    const nextWidth = normalizeBoardTextDimension(textResizeStart.width + deltaX, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH);
    const nextHeight = normalizeBoardTextDimension(textResizeStart.height + deltaY, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT);
    const nextSize = getBoardTextResizeSize(
      nextWidth,
      nextHeight,
      textResizeStart.width,
      textResizeStart.height,
      textResizeStart.size
    );

    resizingBoardText.width = nextWidth;
    resizingBoardText.height = nextHeight;
    resizingBoardText.size = nextSize;
    resizingBoardTextElement.style.width = `${nextWidth}px`;
    resizingBoardTextElement.style.maxWidth = `${nextWidth}px`;
    resizingBoardTextElement.style.height = `${nextHeight}px`;
    applyBoardTextSizeToElement(resizingBoardTextElement, nextSize);

    const now = performance.now();
    if (now - lastTextResizeEmitAt > 90) {
      lastTextResizeEmitAt = now;
      emitBoardTextResize(resizingBoardText, nextWidth, nextHeight);
    }
    return;
  }

  if (draggedBoardText && draggedBoardTextElement) {
    if (activeTextPointerId !== null && event.pointerId !== activeTextPointerId) {
      return;
    }

    const boardRect = board.getBoundingClientRect();
    const nextX = event.clientX - boardRect.left - textDragOffset.x + board.scrollLeft;
    const nextY = event.clientY - boardRect.top - textDragOffset.y + board.scrollTop;
    const textWidth = Number.isFinite(draggedBoardText.width) ? draggedBoardText.width : BOARD_TEXT_WIDTH;
    const textHeight = Number.isFinite(draggedBoardText.height) ? draggedBoardText.height : BOARD_TEXT_HEIGHT;
    const maxX = Math.max(0, canvasWidth - textWidth);
    const maxY = Math.max(0, canvasHeight - textHeight);
    const draftX = clamp(nextX, 0, maxX);
    const draftY = clamp(nextY, 0, maxY);
    const aligned = updateAlignmentGuides(draftX, draftY, { width: textWidth, height: textHeight }, "text", draggedBoardText.id);

    draggedBoardText.x = clamp(aligned.x, 0, maxX);
    draggedBoardText.y = clamp(aligned.y, 0, maxY);

    ensureCanvasForPosition(draggedBoardText.x, draggedBoardText.y, textWidth, textHeight);

    draggedBoardTextElement.style.left = `${draggedBoardText.x}px`;
    draggedBoardTextElement.style.top = `${draggedBoardText.y}px`;

    const now = performance.now();
    if (now - lastTextMoveEmitAt > 45) {
      lastTextMoveEmitAt = now;
      socket.emit("text:move", { id: draggedBoardText.id, x: draggedBoardText.x, y: draggedBoardText.y });
    }
    return;
  }

  if (resizingNote && resizingNoteElement) {
    if (activeNoteResizePointerId !== null && event.pointerId !== activeNoteResizePointerId) {
      return;
    }

    const scale = getNoteScale();
    const deltaX = (event.clientX - noteResizeStart.x) / scale;
    const deltaY = (event.clientY - noteResizeStart.y) / scale;
    const nextWidth = normalizeNoteSize(noteResizeStart.width + deltaX, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
    const nextHeight = normalizeNoteSize(noteResizeStart.height + deltaY, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);

    resizingNote.width = nextWidth;
    resizingNote.height = nextHeight;
    resizingNoteElement.style.width = `${nextWidth}px`;
    resizingNoteElement.style.height = `${nextHeight}px`;
    renderNoteConnections();

    const now = performance.now();
    if (now - lastNoteResizeEmitAt > 90) {
      lastNoteResizeEmitAt = now;
      emitNoteResize(resizingNote, nextWidth, nextHeight);
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
  const bounds = getNoteBounds(dragged);
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

    draggedSelection.forEach((entry) => {
      const entryBounds = getNoteBounds(entry.note);
      const entryMaxX = Math.max(0, canvasWidth - entryBounds.width);
      const entryMaxY = Math.max(0, canvasHeight - entryBounds.height);
      entry.note.x = clamp(entry.startX + deltaX, 0, entryMaxX);
      entry.note.y = clamp(entry.startY + deltaY, 0, entryMaxY);
      ensureCanvasForPosition(entry.note.x, entry.note.y, entryBounds.width, entryBounds.height);

      if (entry.element) {
        entry.element.style.left = `${entry.note.x}px`;
        entry.element.style.top = `${entry.note.y}px`;
      }
    });

    renderNoteConnections();

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
  renderNoteConnections();

  const now = performance.now();
  if (now - lastMoveEmitAt > 45) {
    lastMoveEmitAt = now;
    socket.emit("note:move", { id: dragged.id, x: dragged.x, y: dragged.y });
  }
});

document.addEventListener("pointerup", (event) => {
  if (pendingNoteDrag) {
    if (event.pointerId === pendingNoteDrag.pointerId) {
      pendingNoteDrag.element?.classList.remove("drag-pending");
      pendingNoteDrag = null;
    }
    return;
  }

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

  if (resizingBoardText && resizingBoardTextElement) {
    if (activeTextResizePointerId !== null && event.pointerId !== activeTextResizePointerId) {
      return;
    }

    const finalWidth = normalizeBoardTextDimension(resizingBoardText.width, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH);
    const finalHeight = normalizeBoardTextDimension(resizingBoardText.height, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT);
    const finalSize = getBoardTextResizeSize(
      finalWidth,
      finalHeight,
      textResizeStart.width,
      textResizeStart.height,
      textResizeStart.size
    );
    resizingBoardText.width = finalWidth;
    resizingBoardText.height = finalHeight;
    resizingBoardText.size = finalSize;
    resizingBoardTextElement.style.width = `${finalWidth}px`;
    resizingBoardTextElement.style.maxWidth = `${finalWidth}px`;
    resizingBoardTextElement.style.height = `${finalHeight}px`;
    applyBoardTextSizeToElement(resizingBoardTextElement, finalSize);

    emitBoardTextResize(resizingBoardText, finalWidth, finalHeight, (response) => {
      if (!response?.ok) {
        setBoardActionStatus(response?.message || "Změna velikosti textu se nepodařila.", true);
        return;
      }

      setBoardActionStatus("Velikost textu byla změněna.");
    });
    resizingBoardTextElement.classList.remove("resizing");

    if (activeTextResizePointerId !== null && resizingBoardTextElement.hasPointerCapture(activeTextResizePointerId)) {
      resizingBoardTextElement.releasePointerCapture(activeTextResizePointerId);
    }

    resizingBoardText = null;
    resizingBoardTextElement = null;
    activeTextResizePointerId = null;
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

  if (resizingNote && resizingNoteElement) {
    if (activeNoteResizePointerId !== null && event.pointerId !== activeNoteResizePointerId) {
      return;
    }

    const finalWidth = normalizeNoteSize(resizingNote.width, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
    const finalHeight = normalizeNoteSize(resizingNote.height, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);
    resizingNote.width = finalWidth;
    resizingNote.height = finalHeight;
    resizingNoteElement.style.width = `${finalWidth}px`;
    resizingNoteElement.style.height = `${finalHeight}px`;

    emitNoteResize(resizingNote, finalWidth, finalHeight, (response) => {
      if (!response?.ok) {
        setBoardActionStatus(response?.message || "Změna velikosti lístku se nepodařila.", true);
        return;
      }

      setBoardActionStatus("Velikost lístku byla změněna.");
    });
    resizingNoteElement.classList.remove("resizing");

    if (activeNoteResizePointerId !== null && resizingNoteElement.hasPointerCapture(activeNoteResizePointerId)) {
      resizingNoteElement.releasePointerCapture(activeNoteResizePointerId);
    }

    resizingNote = null;
    resizingNoteElement = null;
    activeNoteResizePointerId = null;
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
        entry.element.classList.remove("dragging");
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
  draggedElement.classList.remove("dragging");
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
    showLoginScreen();
  }
});

socket.on("auth:ok", (user) => {
  me = user;
  storeSessionToken(user?.sessionToken);
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  meBadge.textContent = `Přihlášen: ${me.name}`;
  logoutBtn?.classList.remove("hidden");
  setAuthorFieldValue(fromUser, me.name);
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
    showLoginScreen();
    return;
  }

  socket.emit("auth:resume", { sessionToken });
});

socket.on("board:init", ({ notes: initialNotes, texts: initialTexts, activity }) => {
  notes = Array.isArray(initialNotes) ? initialNotes.map(normalizeIncomingNote).filter(Boolean) : [];
  boardTexts = Array.isArray(initialTexts) ? initialTexts.map(normalizeIncomingBoardText).filter(Boolean) : [];
  selectedNoteIds = new Set();
  notes.forEach((note) => {
    const bounds = getNoteBounds(note);
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
  const bounds = getNoteBounds(note);
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


socket.on("text:updated", (item) => {
  upsertBoardText(item);
  const element = boardCanvas.querySelector(`.board-text-node[data-id="${item.id}"]`);
  if (!element) {
    renderBoard();
    return;
  }

  const textBody = element.querySelector(".board-text-content");
  if (textBody) {
    textBody.textContent = item.text;
  }
  applyBoardTextSizeToElement(element, item.size);
  element.style.width = `${Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH}px`;
  element.style.maxWidth = `${Number.isFinite(item.width) ? item.width : BOARD_TEXT_WIDTH}px`;
  element.style.height = `${Number.isFinite(item.height) ? item.height : BOARD_TEXT_HEIGHT}px`;
  element.title = `${item.author || "Uživatel"}: ${item.text}`;
  renderBoard();
});

socket.on("text:resized", ({ id, width, height, size }) => {
  const textItem = boardTexts.find((item) => item.id === id);
  if (!textItem) {
    return;
  }

  textItem.width = normalizeBoardTextDimension(width, BOARD_TEXT_WIDTH, BOARD_TEXT_MIN_WIDTH);
  textItem.height = normalizeBoardTextDimension(height, BOARD_TEXT_HEIGHT, BOARD_TEXT_MIN_HEIGHT);
  textItem.size = normalizeBoardTextSize(
    size ?? getBoardTextResizeSize(textItem.width, textItem.height, textItem.width, textItem.height, textItem.size)
  );

  const element = boardCanvas.querySelector(`.board-text-node[data-id="${id}"]`);
  if (element) {
    element.style.width = `${textItem.width}px`;
    element.style.maxWidth = `${textItem.width}px`;
    element.style.height = `${textItem.height}px`;
    applyBoardTextSizeToElement(element, textItem.size);
  }
});

socket.on("text:deleted", ({ id }) => {
  boardTexts = boardTexts.filter((item) => item.id !== id);

  if (activeBoardTextId === id) {
    activeBoardTextId = null;
  }
  if (draggedBoardText && draggedBoardText.id === id) {
    draggedBoardText = null;
    draggedBoardTextElement = null;
    activeTextPointerId = null;
    hideAlignmentGuides();
  }

  removeRenderedBoardItem(`.board-text-node[data-id="${id}"]`);
  setBoardActionStatus("Text byl smazán.");
});

socket.on("note:moved", ({ id, x, y }) => {
  const note = notes.find((item) => item.id === id);
  if (!note) {
    return;
  }

  note.x = snapToGrid(x);
  note.y = snapToGrid(y);

  const bounds = getNoteBounds(note);
  ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);

  const element = boardCanvas.querySelector(`.sticky[data-id="${id}"]`);
  if (element) {
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
  }

  renderNoteConnections();

  if (id === activePreviewNoteId) {
    refreshOpenPreview();
  }
});

socket.on("note:resized", ({ id, width, height }) => {
  const note = notes.find((item) => item.id === id);
  if (!note) {
    return;
  }

  note.width = normalizeNoteSize(width, NOTE_DEFAULT_WIDTH, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
  note.height = normalizeNoteSize(height, NOTE_DEFAULT_HEIGHT, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);

  const element = boardCanvas.querySelector(`.sticky[data-id="${id}"]`);
  if (element) {
    element.style.width = `${note.width}px`;
    element.style.height = `${note.height}px`;
  }

  renderNoteConnections();

  if (id === activePreviewNoteId) {
    refreshOpenPreview();
  }
});

socket.on("note:updated", (nextNote) => {
  if (!nextNote?.id) {
    return;
  }

  const previousNote = notes.find((item) => item.id === nextNote.id);
  const previousStatus = previousNote ? getNoteStatus(previousNote) : "active";

  upsertNote(nextNote);
  const note = notes.find((item) => item.id === nextNote.id);
  if (!note) {
    return;
  }

  syncNoteAfterServerUpdate(note, previousStatus);
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
    const bounds = getNoteBounds(note);
    ensureCanvasForPosition(note.x, note.y, bounds.width, bounds.height);
  }

  const element = boardCanvas.querySelector(`.sticky[data-id="${id}"]`);

  if (element && moved && Number.isFinite(x) && Number.isFinite(y) && (x !== previousX || y !== previousY)) {
    element.classList.toggle("done", done);
    const doneButton = element.querySelector(".done-toggle");
    if (doneButton) {
      doneButton.textContent = done ? "Obnovit" : "Vyřešeno";
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

  removeRenderedBoardItem(`.sticky[data-id="${id}"]`);
  setBoardActionStatus("ticket byl smazán.");
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

window.addEventListener("pageshow", () => {
  closeNotePreview(true);
  closeBoardQuickCreate();
  closeBoardInlineComposer();
  clearSelection();
  clearActiveBoardText();
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
closeNotePreview(true);
closeBoardQuickCreate();
closeBoardInlineComposer();
clearSelection();
clearActiveBoardText();
applyAuthLandingMessage();
if (!getStoredSessionToken()) {
  showLoginScreen();
}
