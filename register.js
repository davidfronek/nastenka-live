const socket = io();

const registerForm = document.querySelector("#register-form");
const registerUsername = document.querySelector("#register-username");
const registerEmail = document.querySelector("#register-email");
const registerPassword = document.querySelector("#register-password");
const registerError = document.querySelector("#register-error");

registerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  registerError.textContent = "";

  const username = registerUsername.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value.trim();

  if (!username || !email || !password) {
    registerError.textContent = "Vyplň uživatelské jméno, e-mail a heslo.";
    return;
  }

  socket.emit("auth:register", {
    username,
    email,
    password
  });
});

socket.on("auth:error", (message) => {
  registerError.textContent = message || "Registrace selhala";
});

socket.on("auth:ok", () => {
  const encodedEmail = encodeURIComponent(registerEmail?.value.trim() || "");
  window.location.href = `/?registered=1&email=${encodedEmail}`;
});
