const socket = io();
const loginView = document.querySelector("#admin-login");
const appView = document.querySelector("#admin-app");
const loginForm = document.querySelector("#admin-login-form");
const loginEmail = document.querySelector("#admin-login-email");
const loginPassword = document.querySelector("#admin-login-password");
const loginStatus = document.querySelector("#admin-login-status");
const identity = document.querySelector("#admin-identity");
const logoutButton = document.querySelector("#admin-logout");
const userForm = document.querySelector("#user-form");
const userId = document.querySelector("#user-id");
const usernameInput = document.querySelector("#user-username");
const emailInput = document.querySelector("#user-email");
const passwordInput = document.querySelector("#user-password");
const passwordHint = document.querySelector("#password-hint");
const roleInput = document.querySelector("#user-role");
const colorInput = document.querySelector("#user-color");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-user");
const cancelEditButton = document.querySelector("#cancel-edit");
const userStatus = document.querySelector("#user-status");
const userList = document.querySelector("#user-list");
const listStatus = document.querySelector("#list-status");
const refreshButton = document.querySelector("#refresh-users");

let currentUser = null;
let sessionToken = "";
let users = [];
const AUTH_SESSION_STORAGE_KEY = "nastenka.live.sessionToken";
const openedFromBoard = new URLSearchParams(window.location.search).get("from") === "board";

function getStoredSessionToken() {
  try {
    return window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function clearStoredSessionToken() {
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function showAdminLogin(message = "") {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  setStatus(loginStatus, message, Boolean(message));
}

function resumeBoardSession() {
  sessionToken = getStoredSessionToken();
  if (!openedFromBoard || !sessionToken) {
    return;
  }

  loginView.classList.add("hidden");
  socket.emit("auth:resume", { sessionToken });
}

function setStatus(element, message, isError = false) {
  element.textContent = message || "";
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", Boolean(message) && !isError);
}

function resetForm() {
  userForm.reset();
  userId.value = "";
  colorInput.value = "#ff5d43";
  formTitle.textContent = "Nový uživatel";
  saveButton.textContent = "Vytvořit účet";
  passwordInput.required = true;
  passwordHint.textContent = "(povinné)";
  cancelEditButton.classList.add("hidden");
}

function editUser(user) {
  userId.value = user.id;
  usernameInput.value = user.username;
  emailInput.value = user.email;
  passwordInput.value = "";
  passwordInput.required = false;
  passwordHint.textContent = "(prázdné = beze změny)";
  roleInput.value = user.role;
  colorInput.value = /^#[0-9a-f]{6}$/i.test(user.defaultColor) ? user.defaultColor : "#ff5d43";
  formTitle.textContent = "Upravit uživatele";
  saveButton.textContent = "Uložit změny";
  cancelEditButton.classList.remove("hidden");
  setStatus(userStatus, "");
  usernameInput.focus();
}

function renderUsers() {
  userList.innerHTML = "";
  if (users.length === 0) {
    userList.innerHTML = '<p class="empty-state">Zatím není vytvořený žádný účet.</p>';
    return;
  }

  users.forEach((user) => {
    const item = document.createElement("article");
    item.className = "user-row";
    item.innerHTML = `
      <span class="user-color" style="background:${user.defaultColor}"></span>
      <div class="user-details">
        <strong>${escapeHtml(user.username)}</strong>
        <span>${escapeHtml(user.email)}</span>
      </div>
      <span class="role-badge role-${user.role}">${user.role === "admin" ? "admin" : "uživatel"}</span>
      <div class="row-actions">
        <button class="small-button" type="button" data-action="edit" data-id="${escapeHtml(user.id)}">Upravit</button>
        <button class="small-button danger-button" type="button" data-action="delete" data-id="${escapeHtml(user.id)}">Smazat</button>
      </div>`;
    userList.append(item);
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || "Požadavek se nepodařilo dokončit.");
  }
  return payload;
}

async function loadUsers() {
  setStatus(listStatus, "Načítám účty...");
  try {
    const payload = await apiRequest("/api/admin/users");
    users = payload.users || [];
    renderUsers();
    setStatus(listStatus, `${users.length} účtů načteno.`);
  } catch (error) {
    setStatus(listStatus, error.message, true);
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus(loginStatus, "Přihlašování...");
  socket.emit("auth:login", { email: loginEmail.value.trim(), password: loginPassword.value });
});

socket.on("auth:ok", (user) => {
  if (user.role !== "admin") {
    setStatus(loginStatus, "Tato stránka je pouze pro administrátory.", true);
    socket.emit("auth:logout");
    return;
  }
  currentUser = user;
  sessionToken = user.sessionToken || "";
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  identity.textContent = `Přihlášen: ${user.name} · ${user.email}`;
  loadUsers();
});

socket.on("auth:required", () => {
  clearStoredSessionToken();
  sessionToken = "";
  showAdminLogin("Relace vypršela. Přihlas se znovu.");
});

socket.on("auth:error", (message) => {
  setStatus(loginStatus, message || "Přihlášení selhalo.", true);
});

socket.on("connect_error", () => {
  setStatus(loginStatus, "Server není dostupný.", true);
});

logoutButton.addEventListener("click", () => {
  socket.emit("auth:logout");
  clearStoredSessionToken();
  sessionToken = "";
  currentUser = null;
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  loginPassword.value = "";
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(userStatus, "Ukládám...");
  const id = userId.value;
  const payload = {
    username: usernameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    role: roleInput.value,
    defaultColor: colorInput.value
  };

  try {
    await apiRequest(id ? `/api/admin/users/${encodeURIComponent(id)}` : "/api/admin/users", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    resetForm();
    setStatus(userStatus, id ? "Změny byly uloženy." : "Účet byl vytvořen.");
    await loadUsers();
  } catch (error) {
    setStatus(userStatus, error.message, true);
  }
});

userList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const user = users.find((item) => item.id === button.dataset.id);
  if (!user) {
    return;
  }
  if (button.dataset.action === "edit") {
    editUser(user);
    return;
  }
  if (!window.confirm(`Opravdu odstranit účet ${user.username}?`)) {
    return;
  }
  try {
    await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    if (user.id === userId.value) {
      resetForm();
    }
    await loadUsers();
  } catch (error) {
    setStatus(listStatus, error.message, true);
  }
});

cancelEditButton.addEventListener("click", resetForm);
refreshButton.addEventListener("click", loadUsers);

resumeBoardSession();
