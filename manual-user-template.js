const form = document.querySelector("#manual-user-form");
const usernameInput = document.querySelector("#manual-username");
const emailInput = document.querySelector("#manual-email");
const passwordInput = document.querySelector("#manual-password");
const roleInput = document.querySelector("#manual-role");
const copyJsonBtn = document.querySelector("#copy-json-btn");
const statusEl = document.querySelector("#manual-status");
const outputEl = document.querySelector("#manual-output");

function getApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/users/template-entry";
  }
  return null;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "";
  statusEl.classList.remove("is-success");

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    statusEl.textContent =
      "Tento formulář otevři přes běžící server na http://localhost:3099/manual-user-template.html (ne jako lokální soubor).";
    return;
  }

  const payload = {
    username: usernameInput?.value.trim(),
    email: emailInput?.value.trim(),
    password: passwordInput?.value.trim(),
    role: roleInput?.value === "admin" ? "admin" : "user",
    defaultColor: "#ff5d43"
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data?.ok) {
      statusEl.textContent = data?.message || "Generování záznamu se nepodařilo.";
      return;
    }

    outputEl.value = JSON.stringify(data.entry, null, 2);
    statusEl.textContent = "JSON záznam je připravený ke zkopírování.";
    statusEl.classList.add("is-success");
  } catch {
    statusEl.textContent =
      "Nepodařilo se kontaktovat server. Spusť aplikaci příkazem npm run dev ve složce nastenka-live.";
  }
});

copyJsonBtn?.addEventListener("click", async () => {
  statusEl.textContent = "";
  statusEl.classList.remove("is-success");

  const text = outputEl?.value.trim();
  if (!text) {
    statusEl.textContent = "Nejprve vygeneruj JSON záznam.";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = "JSON byl zkopírován do schránky.";
    statusEl.classList.add("is-success");
  } catch {
    statusEl.textContent = "Kopírování se nepodařilo. Označ text ve výstupu a zkopíruj ho ručně.";
  }
});
