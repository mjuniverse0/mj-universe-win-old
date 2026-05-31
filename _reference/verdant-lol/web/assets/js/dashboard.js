const SUPABASE_URL = "https://vtuernoeadchmsptmfkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aG_RLiWvrH6CKZs8IY8x7g_15yloky8";
const ACCOUNTS_TABLE = "accounts";
const ORDERS_TABLE = "orders";
const SESSION_KEY = "verdant_dashboard_session";
const AUTOLOGIN_KEY = "verdant_dashboard_autologin";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

function getClient() {
  return supabaseClient;
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function setAutologinEnabled(enabled) {
  localStorage.setItem(AUTOLOGIN_KEY, enabled ? "1" : "0");
}

function isAutologinEnabled() {
  return localStorage.getItem(AUTOLOGIN_KEY) === "1";
}

function renderAutologinStatus(message, ok = false) {
  const root = document.querySelector("[data-autologin-status]");
  if (!root) return;
  root.innerHTML = `<div style="opacity:.95;animation:fadePulse .9s ease-in-out infinite alternate;white-space:pre-line">${message}</div>`;
  root.style.color = ok ? "#bdfcc6" : "#ff9e9e";
}

function syncOrderFormFromSession() {
  const session = getSession();
  const emailInput = document.getElementById("order-email");
  const usernameInput = document.getElementById("order-username");
  if (!emailInput || !usernameInput) return;
  emailInput.value = session?.email ?? "";
  usernameInput.value = session?.username ?? "";
}

function hookAuth() {
  const form = document.querySelector("[data-auth-form]");
  const out = document.querySelector("[data-auth-result]");
  if (!form || !out) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const action = e.submitter?.value;
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const username = String(fd.get("username") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const rememberMe = fd.get("rememberMe") === "on";

    if (!email || !username || !password) return;

    try {
      const client = getClient();
      if (!client) return;
      const passwordHash = await sha256(password);

      if (action === "signup") {
        const { data: existing, error: existingError } = await client
          .from(ACCOUNTS_TABLE)
          .select("id")
          .or(`email.eq.${email},username.eq.${username}`)
          .limit(1);
        if (existingError) {
          out.textContent = `Sign up failed: ${existingError.message}`;
          return;
        }
        if (existing && existing.length > 0) {
          out.textContent = "Email or username already exists.";
          return;
        }

        const { error } = await client.from(ACCOUNTS_TABLE).insert({
          email,
          username,
          password_hash: passwordHash,
        });
        if (error) {
          if (rememberMe) {
            renderAutologinStatus(
              "Enabling Autologin...\nPlease wait.. <3\nStatus\n\nAutologin Failed",
              false
            );
          }
          out.textContent = `Sign up failed: ${error.message}`;
          return;
        }
        setSession({ email, username });
        setAutologinEnabled(rememberMe);
        if (rememberMe) {
          renderAutologinStatus("Opening Autologin page...", true);
          setTimeout(() => {
            window.location.href = "./autologin.html?mode=enable&next=./client-area.html";
          }, 350);
          return;
        }
        renderAutologinStatus("", true);
        syncOrderFormFromSession();
        out.textContent = "Sign up complete. Redirecting to Client Area...";
        setTimeout(() => {
          window.location.href = "./client-area.html";
        }, 700);
      } else {
        const { data, error } = await client
          .from(ACCOUNTS_TABLE)
          .select("email, username, password_hash")
          .eq("email", email)
          .eq("username", username)
          .maybeSingle();
        if (error || !data) {
          if (rememberMe) {
            renderAutologinStatus(
              "Enabling Autologin...\nPlease wait.. <3\nStatus\n\nAutologin Failed",
              false
            );
          }
          out.textContent = "Login failed: account not found.";
          return;
        }
        if (data.password_hash !== passwordHash) {
          if (rememberMe) {
            renderAutologinStatus(
              "Enabling Autologin...\nPlease wait.. <3\nStatus\n\nAutologin Failed",
              false
            );
          }
          out.textContent = "Login failed: invalid password.";
          return;
        }
        setSession({ email: data.email, username: data.username });
        setAutologinEnabled(rememberMe);
        if (rememberMe) {
          renderAutologinStatus("Opening Autologin page...", true);
          setTimeout(() => {
            window.location.href = "./autologin.html?mode=enable&next=./client-area.html";
          }, 350);
          return;
        }
        renderAutologinStatus("", true);
        syncOrderFormFromSession();
        out.textContent = "Logged in successfully. Redirecting to Client Area...";
        setTimeout(() => {
          window.location.href = "./client-area.html";
        }, 600);
      }
    } catch (err) {
      out.textContent = `Auth error: ${err.message}`;
    }
  });
}

function hookOrderLookup() {
  const form = document.querySelector("[data-order-form]");
  const out = document.querySelector("[data-order-result]");
  if (!form || !out) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const session = getSession();
    if (!session) {
      out.textContent = "Log in first.";
      return;
    }
    const client = getClient();

    const fd = new FormData(form);
    const orderId = String(fd.get("orderId") ?? "").trim();
    const email = session.email;
    const username = session.username;

    const { data, error } = await client
      .from(ORDERS_TABLE)
      .select("order_id, product, email, username, claimed_at")
      .eq("order_id", orderId)
      .eq("email", email)
      .eq("username", username)
      .maybeSingle();

    if (error || !data) {
      out.textContent = "No matching order found.";
      return;
    }

    out.textContent = `Order found: ${data.product} | Claimed: ${
      data.claimed_at ? "Yes" : "No"
    }`;
  });
}

function autoRedirectIfRemembered() {
  const session = getSession();
  if (session && isAutologinEnabled()) {
    window.location.href = "./autologin.html?mode=resume&next=./client-area.html";
  }
}

const SITE_API =
  window.location.protocol === "file:"
    ? "http://localhost:8787"
    : window.location.origin;

const ADMIN_SECRET_STORAGE = "verdant_dashboard_admin_secret";

function adminSecretGet() {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_STORAGE) || "";
  } catch {
    return "";
  }
}

function adminSecretSet(v) {
  try {
    sessionStorage.setItem(ADMIN_SECRET_STORAGE, String(v ?? "").trim());
  } catch {
    /* ignore */
  }
}

function adminSecretClear() {
  try {
    sessionStorage.removeItem(ADMIN_SECRET_STORAGE);
  } catch {
    /* ignore */
  }
}

function hookAdminSecretPanel() {
  const secretInput = document.getElementById("admin-secret-input");
  const secretSave = document.getElementById("admin-secret-save");
  const secretClear = document.getElementById("admin-secret-clear");
  const secretStatus = document.getElementById("admin-secret-status");

  function setStatus(msg) {
    if (secretStatus) secretStatus.textContent = msg || "";
  }

  secretSave?.addEventListener("click", () => {
    adminSecretSet(secretInput?.value || "");
    setStatus("Saved for this tab. Full alert controls + restore require this secret.");
    if (typeof window.__verdantNotifyRefresh === "function") window.__verdantNotifyRefresh();
  });

  secretClear?.addEventListener("click", () => {
    adminSecretClear();
    if (secretInput) secretInput.value = "";
    setStatus("Disconnected.");
    if (typeof window.__verdantNotifyRefresh === "function") window.__verdantNotifyRefresh();
  });

  if (secretInput && adminSecretGet()) {
    secretInput.placeholder = "--------";
  }
}

function hookShopGrantTools() {
  const details = document.getElementById("shop-grant-tools");
  const grantSecret = document.getElementById("grant-secret-input");
  const btn = document.getElementById("grant-submit");
  const out = document.getElementById("grant-result");
  const emailIn = document.getElementById("grant-target-email");
  const userIn = document.getElementById("grant-target-username");
  const pidsIn = document.getElementById("grant-product-ids");
  if (!details || !btn) return;

  async function refreshVisibility() {
    try {
      const res = await fetch(`${SITE_API}/api/public/shop-config`);
      const json = await res.json().catch(() => ({}));
      const allowed = json.shopOperatorEmails || [];
      const session = getSession();
      const em = String(session?.email ?? "")
        .trim()
        .toLowerCase();
      const show = allowed.length && em && allowed.some((x) => String(x).trim().toLowerCase() === em);
      details.hidden = !show;
    } catch {
      details.hidden = true;
    }
  }

  btn.addEventListener("click", async () => {
    if (!out) return;
    const token = String(grantSecret?.value ?? "").trim();
    const session = getSession();
    const operatorEmail = String(session?.email ?? "").trim().toLowerCase();
    const email = String(emailIn?.value ?? "")
      .trim()
      .toLowerCase();
    const username = String(userIn?.value ?? "").trim().toLowerCase();
    const raw = String(pidsIn?.value ?? "");
    const productIds = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!token || !operatorEmail || !email || !username || !productIds.length) {
      out.textContent = "Fill grant token, customer email/username, and at least one product id.";
      return;
    }
    out.textContent = "Working...";
    try {
      const res = await fetch(`${SITE_API}/api/shop/grant-licenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          operatorEmail,
          grants: productIds.map((productId) => ({ email, username, productId })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      out.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      out.textContent = String(e.message || e);
    }
  });

  refreshVisibility();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshVisibility();
  });
}

hookAuth();
hookOrderLookup();
syncOrderFormFromSession();
autoRedirectIfRemembered();
hookAdminSecretPanel();
hookShopGrantTools();
