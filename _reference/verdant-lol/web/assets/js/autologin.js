const AUTOLOGIN_KEY = "verdant_dashboard_autologin";
const SESSION_KEY = "verdant_dashboard_session";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") ?? "enable";
const next = params.get("next") ?? "./client-area.html";
const root = document.querySelector("[data-autologin-screen]");

function paint(message, ok = false) {
  if (!root) return;
  root.textContent = message;
  root.style.color = ok ? "#bdfcc6" : "#ff9e9e";
}

async function typeStages(lines, ok = false) {
  if (!root) return;
  root.style.color = ok ? "#bdfcc6" : "#ff9e9e";
  root.textContent = "";
  for (const line of lines) {
    let current = "";
    for (const ch of line) {
      current += ch;
      root.textContent = `${root.textContent}${ch}`;
      await new Promise((r) => setTimeout(r, 18));
    }
    root.textContent = `${root.textContent}\n`;
    await new Promise((r) => setTimeout(r, 220));
    // Keep typed line and move on.
  }
}

function hasSession() {
  try {
    return Boolean(localStorage.getItem(SESSION_KEY));
  } catch {
    return false;
  }
}

async function run() {
  if (!root) return;
  await typeStages(["[Stage 1/3] Enabling Autologin...", "[Stage 2/3] Please wait.. <3", "[Stage 3/3] Status"], true);
  await new Promise((r) => setTimeout(r, 350));

  if (mode === "enable") {
    if (hasSession()) {
      localStorage.setItem(AUTOLOGIN_KEY, "1");
      await typeStages(["", "Autologin Enabled"], true);
      setTimeout(() => {
        window.location.href = next;
      }, 950);
      return;
    }
    await typeStages(["", "Autologin Failed"], false);
    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 1100);
    return;
  }

  if (mode === "resume") {
    if (hasSession() && localStorage.getItem(AUTOLOGIN_KEY) === "1") {
      await typeStages(["Autologin session found.", "Redirecting to Client Area..."], true);
      setTimeout(() => {
        window.location.href = next;
      }, 750);
      return;
    }
    await typeStages(["Autologin Failed"], false);
    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 850);
  }
}

run();
