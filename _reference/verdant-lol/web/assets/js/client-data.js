const CLIENT_SUPABASE_URL = "https://vtuernoeadchmsptmfkn.supabase.co";
const CLIENT_SUPABASE_KEY = "sb_publishable_aG_RLiWvrH6CKZs8IY8x7g_15yloky8";
const CLIENT_SESSION_KEY = "verdant_dashboard_session";

const clientSupabase = window.supabase.createClient(
  CLIENT_SUPABASE_URL,
  CLIENT_SUPABASE_KEY
);

function getClientSession() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function requireClientSession() {
  const session = getClientSession();
  if (!session) {
    window.location.href = "./dashboard.html";
    return null;
  }
  return session;
}

async function loadClientOrders() {
  const session = requireClientSession();
  window.__verdantOrdersLoadError = "";
  if (!session) return [];

  const email = String(session.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    window.__verdantOrdersLoadError =
      "Session has no email. Open Dashboard, log out, and sign in again.";
    return [];
  }

  /* Match by email only - checkout username can differ between purchases. */
  const q = (cols) =>
    clientSupabase.from("orders").select(cols).eq("email", email).order("created_at", { ascending: false });

  const fullCols =
    "order_id, product, status, claimed_at, download_url, license_key, license_expires_at, created_at, username";
  const noExpiryCols =
    "order_id, product, status, claimed_at, download_url, license_key, created_at, username";

  let { data, error } = await q(fullCols);
  if (error) {
    ({ data, error } = await q(noExpiryCols));
  }
  if (error) {
    console.warn("[client-data] orders query:", error.message || error);
    window.__verdantOrdersLoadError =
      "Could not load purchases from the database. If this persists, contact support. (" +
      (error.message || "unknown error") +
      ")";
    return [];
  }
  return data ?? [];
}

function productStatusClass(status) {
  const s = (status ?? "").toLowerCase();
  if (["completed", "active", "delivered"].includes(s)) return "ok";
  if (["pending", "processing"].includes(s)) return "warn";
  return "down";
}
