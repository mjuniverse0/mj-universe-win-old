require("dotenv").config();
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const { computeLicenseExpiresAtIso } = require("./lib/licenseExpiry");
const {
  resolveProductFromRequest,
  normalizeCatalogName,
  loadStoreCatalogSync,
} = require("./lib/storeCatalog");
const {
  absoluteStorefrontImageUrls,
  storefrontImagePathFromSiteProductName,
} = require("./lib/storefrontImageUrl");
const dashboardNotifications = require("./lib/dashboardNotifications");

const app = express();
app.set("trust proxy", 1);
app.use((req, res, next) => {
  if (req.method === "POST" && (req.path === "/api/stripe/webhook" || req.originalUrl === "/api/stripe/webhook")) {
    return express.raw({ type: "application/json" })(req, res, next);
  }
  if (req.method === "POST" && (req.path === "/api/executor/execute" || req.originalUrl === "/api/executor/execute")) {
    return express.raw({ type: "*/*", limit: "2mb" })(req, res, next);
  }
  return express.json({ limit: "1mb" })(req, res, next);
});

const PORT = Number(process.env.WEB_PORT ?? 8787);

/** VPS: daemon that accepts GET / and POST /execute (e.g. http://127.0.0.1:6969). Proxied at /api/executor/*. */
const EXECUTOR_UPSTREAM = String(process.env.VERDANT_EXECUTOR_UPSTREAM ?? "").trim().replace(/\/$/, "");

/** Executor API registered early - `deploy-web.ps1` uploads only web/ to nginx; this route requires Node listening (see deploy/nginx-verdant-api.example.conf). */
app.get("/api/executor/health", (_req, res) => {
  const up = EXECUTOR_UPSTREAM || "";
  res.json({
    ok: true,
    upstreamConfigured: Boolean(up),
    upstreamPreview: up.length > 48 ? `${up.slice(0, 48)}…` : up || null,
    server: "verdant-lol",
  });
});

app.get(["/api/executor", "/api/executor/"], async (_req, res) => {
  if (!EXECUTOR_UPSTREAM) {
    return res.status(503).json({
      ok: false,
      error:
        "Executor upstream not configured. Set VERDANT_EXECUTOR_UPSTREAM on the server (e.g. http://127.0.0.1:6969).",
    });
  }
  try {
    const r = await fetch(`${EXECUTOR_UPSTREAM}/`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return res.status(r.status < 500 ? 200 : 502).json({
      ok: r.status < 500,
      upstreamStatus: r.status,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e?.message ?? e) });
  }
});

function forwardedExecutorHeaders(req, extra = {}) {
  const headers = { ...extra };
  for (const h of ["x-verdant-hwid", "x-verdant-license", "x-verdant-author"]) {
    const v = req.get(h);
    if (v) headers[h] = v;
  }
  return headers;
}

app.post("/api/executor/execute", async (req, res) => {
  if (!EXECUTOR_UPSTREAM) {
    return res.status(503).json({
      error:
        "Executor upstream not configured. Set VERDANT_EXECUTOR_UPSTREAM on the server (e.g. http://127.0.0.1:6969).",
    });
  }
  const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
  const incomingCt = req.get("content-type");
  try {
    const r = await fetch(`${EXECUTOR_UPSTREAM}/execute`, {
      method: "POST",
      headers: forwardedExecutorHeaders(req, {
        "Content-Type": incomingCt && incomingCt.includes("application/json")
          ? "application/json"
          : "text/plain; charset=utf-8",
      }),
      body,
      signal: AbortSignal.timeout(60000),
    });
    const text = await r.text();
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e) });
  }
});

/* Long-poll endpoint for the local C++ agent (verdant_executor.exe). The
 * agent calls GET /api/executor/pull?hwid=X&wait=25 and blocks until the
 * daemon either delivers a queued script or returns 204 on timeout. We mirror
 * the wait window plus a short grace before aborting upstream. */
app.get("/api/executor/pull", async (req, res) => {
  if (!EXECUTOR_UPSTREAM) {
    return res.status(503).json({
      error:
        "Executor upstream not configured. Set VERDANT_EXECUTOR_UPSTREAM on the server.",
    });
  }
  const hwid = String(req.query.hwid ?? "").trim();
  if (!hwid) return res.status(400).json({ error: "Missing ?hwid=" });
  const wait = Math.max(
    1,
    Math.min(55, Number(req.query.wait ?? 25) || 25)
  );
  const url = new URL(`${EXECUTOR_UPSTREAM}/pull`);
  url.searchParams.set("hwid", hwid);
  url.searchParams.set("wait", String(wait));
  try {
    const r = await fetch(url.toString(), {
      method: "GET",
      headers: forwardedExecutorHeaders(req),
      signal: AbortSignal.timeout((wait + 5) * 1000),
    });
    if (r.status === 204) {
      return res.status(204).end();
    }
    const text = await r.text();
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e) });
  }
});

app.post("/api/executor/ack", async (req, res) => {
  if (!EXECUTOR_UPSTREAM) {
    return res.status(503).json({
      error:
        "Executor upstream not configured. Set VERDANT_EXECUTOR_UPSTREAM on the server.",
    });
  }
  const body =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  try {
    const r = await fetch(`${EXECUTOR_UPSTREAM}/ack`, {
      method: "POST",
      headers: forwardedExecutorHeaders(req, {
        "Content-Type": "application/json",
      }),
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e) });
  }
});

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");

function publicAppBase(req) {
  if (PUBLIC_APP_URL) return PUBLIC_APP_URL;
  const host = req.get("x-forwarded-host") || req.get("host");
  const raw =
    (req.get("x-forwarded-proto") && String(req.get("x-forwarded-proto")).split(",")[0].trim()) || "";
  let proto = raw;
  if (!proto && typeof req.secure === "boolean" && req.secure) proto = "https";
  if (!proto) proto = req.protocol;
  if (!proto || (proto !== "http" && proto !== "https")) proto = "https";
  if (
    proto === "http" &&
    host &&
    !/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(host)) &&
    !/^\[::1\](:\d+)?$/.test(String(host))
  ) {
    proto = "https";
  }
  return `${proto}://${host}`;
}

const WEB_DIR = path.join(__dirname, "web");
const WEB_ROOT = fs.existsSync(WEB_DIR) ? WEB_DIR : __dirname;
const FAVICON_PATH = path.join(WEB_ROOT, "assets", "images", "favicon.ico");
const FAVICON_PNG_PATH = path.join(WEB_ROOT, "assets", "images", "favicon.ico.png");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const LAUNCHER_LATEST_VERSION = process.env.LAUNCHER_LATEST_VERSION ?? "1.0.0";
const LAUNCHER_MIN_VERSION = process.env.LAUNCHER_MIN_VERSION ?? "1.0.0";
const LAUNCHER_UPDATE_CHANNEL = process.env.LAUNCHER_UPDATE_CHANNEL ?? "stable";
const LAUNCHER_UPDATE_URL = process.env.LAUNCHER_UPDATE_URL ?? "";
const LAUNCHER_UPDATE_SHA256 = process.env.LAUNCHER_UPDATE_SHA256 ?? "";
const LAUNCHER_UPDATE_SIGNATURE = process.env.LAUNCHER_UPDATE_SIGNATURE ?? "";
const LAUNCHER_RELEASE_NOTES = process.env.LAUNCHER_RELEASE_NOTES ?? "Latest stable launcher build.";
const LAUNCHER_RUNTIME_FILES_JSON = process.env.LAUNCHER_RUNTIME_FILES_JSON ?? "[]";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ORDERS_TABLE = process.env.SUPABASE_ORDERS_TABLE ?? "orders";

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;
const customPaymentLinks = new Map();
/** In-memory idempotency when Supabase is not configured (dev / demo) */
const stripeFulfilledMemory = new Map();

const FALLBACK_PROMOS = {
  VERDANT10: { type: "percent", value: 10 },
  WELCOME15: { type: "percent", value: 15 },
};

const FALLBACK_GIFTS = {
  "GIFT-FN-FREE": { product_hint: "fortnite", redeemed: false, amount_usd: 15 },
  "GIFT-APEX-FREE": { product_hint: "apex", redeemed: false, amount_usd: 15 },
  "GIFT-RBLX-FREE": { product_hint: "roblox", redeemed: false, amount_usd: 15 },
  "GIFT-CS2-FREE": { product_hint: "cs2", redeemed: false, amount_usd: 15 },
  "GIFT-FH5-FREE": { product_hint: "forza", redeemed: false, amount_usd: 15 },
  "GIFT-NWM6Z7NBYX": { product_hint: "fortnite", redeemed: false, amount_usd: 500 },
  /** Generert kundekode - ingen product_hint = gyldig på alle produkter. Juster saldo i Supabase om du bruker DB som sannhet. */
  "GIFT-EQ8B34YBA6": { redeemed: false, amount_usd: 100 },
};

/**
 * Stripe Checkout extras:
 * - STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION: Dashboard Payment Method Configuration id (recommended).
 * - Else STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES: explicit list (e.g. card,apple_pay,google_pay).
 * - Else {} - lets Checkout use account defaults (some API versions reject automatic_payment_methods on Session).
 * Optional: STRIPE_CHECKOUT_AUTOMATIC_PAYMENT_METHODS=1 adds { automatic_payment_methods: { enabled: true } } for newer accounts only.
 */
function resolveStripeCheckoutSessionOverrides(currencyLower) {
  const pmc = String(process.env.STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION ?? "").trim();
  if (pmc) {
    return { payment_method_configuration: pmc };
  }
  const raw = String(process.env.STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES ?? "").trim();
  if (raw) {
    let types = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (types.includes("mb_way") && currencyLower !== "eur") {
      types = types.filter((t) => t !== "mb_way");
    }
    if (types.length) return { payment_method_types: types };
  }
  if (String(process.env.STRIPE_CHECKOUT_AUTOMATIC_PAYMENT_METHODS ?? "").trim() === "1") {
    return { automatic_payment_methods: { enabled: true } };
  }
  return {};
}

function isMissingLicenseExpiresColumn(err) {
  const m = String(err?.message ?? err?.details ?? err ?? "");
  return /license_expires_at/i.test(m) && (/does not exist/i.test(m) || /schema cache/i.test(m));
}

async function supabaseInsertOrderRow(row) {
  let { error } = await supabase.from(SUPABASE_ORDERS_TABLE).insert(row);
  if (!error) return null;
  if (
    isMissingLicenseExpiresColumn(error) &&
    row &&
    Object.prototype.hasOwnProperty.call(row, "license_expires_at")
  ) {
    const { license_expires_at: _omit, ...rest } = row;
    ({ error } = await supabase.from(SUPABASE_ORDERS_TABLE).insert(rest));
  }
  return error;
}

async function supabaseSelectOrderByOrderId(orderId) {
  let { data, error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select("order_id, license_key, product, license_expires_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error && isMissingLicenseExpiresColumn(error)) {
    ({ data, error } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .select("order_id, license_key, product")
      .eq("order_id", orderId)
      .maybeSingle());
    if (data && data.license_expires_at === undefined) data.license_expires_at = null;
  }
  return { data, error };
}

async function supabaseSelectOrderByLicenseKey(normalizedKey) {
  const full =
    "id, order_id, email, username, product, license_key, license_expires_at, claimed_discord_id, hwid_lock, hwid_last_seen, status";
  const fallback =
    "id, order_id, email, username, product, license_key, claimed_discord_id, hwid_lock, hwid_last_seen, status";
  let { data, error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select(full)
    .eq("license_key", normalizedKey)
    .maybeSingle();
  if (error && isMissingLicenseExpiresColumn(error)) {
    ({ data, error } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .select(fallback)
      .eq("license_key", normalizedKey)
      .maybeSingle());
    if (data && data.license_expires_at === undefined) data.license_expires_at = null;
  }
  return { data, error };
}

const DASHBOARD_ADMIN_SECRET = String(process.env.DASHBOARD_ADMIN_SECRET ?? "").trim();

function bearerAdminToken(req) {
  const h = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  return m ? m[1].trim() : "";
}

function adminTokensEqual(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function assertDashboardAdmin(req, res) {
  if (!DASHBOARD_ADMIN_SECRET) {
    res.status(503).json({ error: "Admin API disabled (set DASHBOARD_ADMIN_SECRET in server env)" });
    return false;
  }
  if (!adminTokensEqual(bearerAdminToken(req), DASHBOARD_ADMIN_SECRET)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/** Comma-separated in VERDANT_SHOP_OPERATOR_EMAILS - required in body.operatorEmail when granting if set. */
function shopOperatorEmailsList() {
  return String(process.env.VERDANT_SHOP_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => normalizeIdentity(s))
    .filter(Boolean);
}

function assertShopGrantAuthorized(req, res) {
  const grantSec = String(process.env.SHOP_GRANT_SECRET ?? "").trim();
  const adminSec = String(process.env.DASHBOARD_ADMIN_SECRET ?? "").trim();
  const tokens = [grantSec, adminSec].filter(Boolean);
  if (!tokens.length) {
    res.status(503).json({
      error: "Grant API disabled (set SHOP_GRANT_SECRET or DASHBOARD_ADMIN_SECRET on the server)",
    });
    return false;
  }
  const tok = bearerAdminToken(req);
  const ok = tokens.some((t) => adminTokensEqual(tok, t));
  if (!ok) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const allowed = shopOperatorEmailsList();
  if (allowed.length) {
    const op = normalizeIdentity(req.body?.operatorEmail ?? "");
    if (!allowed.includes(op)) {
      res.status(403).json({ error: "Operator email not allowed (VERDANT_SHOP_OPERATOR_EMAILS)" });
      return false;
    }
  }
  return true;
}

function paymentIntentIdFromSession(session) {
  const pi = session?.payment_intent;
  if (!pi) return "";
  return typeof pi === "string" ? pi : pi.id || "";
}

function sessionMoneyFields(session) {
  return {
    amountCents: session?.amount_total ?? null,
    currency: session?.currency ?? "",
  };
}

function assertStripe() {
  if (!stripe) {
    throw new Error("Missing STRIPE_SECRET_KEY in .env");
  }
}

function orderIdFromCheckoutSessionId(sessionId) {
  return `ORD-STR-${crypto.createHash("sha256").update(String(sessionId), "utf8").digest("hex").slice(0, 20).toUpperCase()}`;
}

function extractStripeApiError(err) {
  if (!err) return "Stripe request failed";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.raw && typeof err.raw === "object" && err.raw.message) return err.raw.message;
  return "Stripe request failed";
}

async function retrieveCheckoutSessionForFulfillment(sessionId) {
  assertStripe();
  return stripe.checkout.sessions.retrieve(String(sessionId), {
    expand: ["line_items.data.price.product", "payment_intent"],
  });
}

function generateOrderId(captureId) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${captureId.slice(-8)}-${suffix}`;
}

function normalizeIdentity(value = "") {
  return value.trim().toLowerCase();
}

/** 4-letter SKU for license middle segment; prefers catalog id so keys never show UNKN for valid games. */
function licenseSkuTagFromProductId(productIdHint = "") {
  const id = String(productIdHint || "").trim().toLowerCase();
  if (!id) return "";
  if (id.startsWith("roblox")) return "RBLX";
  if (id.startsWith("fortnite")) return "FNTE";
  if (id.startsWith("apex")) return "APEX";
  if (id.startsWith("cs2")) return "CS2X";
  if (id.startsWith("forza5")) return "FH5X";
  if (id.startsWith("all-products-lifetime-plus")) return "ALLP";
  if (id.startsWith("all-products-lifetime-lite")) return "ALLL";
  return "";
}

function generateLicenseKey(productDisplayName = "VERDANT", productIdHint = "") {
  const fromId = licenseSkuTagFromProductId(productIdHint);
  const fromName = productSlug(productDisplayName).replace(/[^a-z0-9]/g, "").slice(0, 4).toUpperCase();
  const tag = (fromId || fromName || "GEN").slice(0, 4);
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VERDANT-${tag}-${part()}-${part()}`;
}

function catalogProductIdFromMetaAndName(m, siteProductName) {
  const pid = String(m?.product_id || m?.productId || "").trim();
  if (pid) {
    try {
      const r = resolveProductFromRequest({ productId: pid });
      return r.productId || "";
    } catch (_) {
      /* ignore */
    }
  }
  const name = String(siteProductName || "").trim();
  if (!name) return "";
  try {
    const r = resolveProductFromRequest({ product: name });
    return r.productId || "";
  } catch (_) {
    return "";
  }
}

function badProductPlaceholder(name) {
  const s = String(name || "").trim();
  return !s || /^unknown$/i.test(s);
}

function stripHostedProductTitle(title) {
  return String(title || "")
    .replace(/^verdant\s+external\s*[-\u2013\u2014]\s*/i, "")
    .trim();
}

function tryResolveProductFromLineTitle(rawTitle) {
  const cleaned = stripHostedProductTitle(rawTitle);
  if (badProductPlaceholder(cleaned)) return "";
  try {
    const r = resolveProductFromRequest({ product: cleaned });
    if (r.productId) return r.siteProductName;
  } catch (_) {
    /* no catalog match */
  }
  return "";
}

function productFromCheckoutLineItems(session) {
  const rows = session.line_items?.data;
  if (!rows || !rows.length) return "";
  const first = rows[0];
  const prod = first.price?.product;
  if (prod && typeof prod === "object" && prod.name) return String(prod.name).trim();
  return String(first.description || "").trim();
}

/** Fill product / email / username when Payment Links omit checkout metadata */
async function fulfillmentIdentityFromSession(session) {
  let m = { ...(session.metadata || {}) };
  let product = "";
  let email = m.email ? normalizeIdentity(m.email) : "";
  let username = m.username ? normalizeIdentity(m.username) : "";

  const pidFromMeta = () => String(m.product_id || m.productId || "").trim();

  const applyPid = () => {
    const pid = pidFromMeta();
    if (!pid) return false;
    try {
      product = resolveProductFromRequest({ productId: pid }).siteProductName;
      return Boolean(product);
    } catch (_) {
      return false;
    }
  };

  applyPid();

  if (badProductPlaceholder(product)) {
    product = String(m.product || m.site_product || "").trim();
  }
  if (badProductPlaceholder(product)) {
    product = "";
  }

  const incomplete = !product || !email || !username;
  if (incomplete && stripe) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product"],
      });
      m = { ...m, ...(full.metadata || {}) };
      applyPid();
      if (badProductPlaceholder(product)) {
        product = String(m.product || m.site_product || "").trim();
      }
      if (badProductPlaceholder(product)) {
        product = tryResolveProductFromLineTitle(productFromCheckoutLineItems(full));
      }
      if (badProductPlaceholder(product)) {
        const lineTitle = productFromCheckoutLineItems(full);
        const stripped = stripHostedProductTitle(lineTitle);
        const cand = stripped || String(lineTitle || "").trim();
        if (!badProductPlaceholder(cand)) product = cand;
      }
      email = email || (full.customer_details?.email ? normalizeIdentity(full.customer_details.email) : "");
      const fallbackUser = email.includes("@") ? email.split("@")[0] : "";
      username =
        username ||
        (full.customer_details?.name ? normalizeIdentity(full.customer_details.name) : "") ||
        normalizeIdentity(fallbackUser || "customer");
    } catch (err) {
      console.error("checkout.session.retrieve expand failed:", err?.message || err);
    }
  }

  applyPid();
  if (badProductPlaceholder(product)) {
    try {
      product = tryResolveProductFromLineTitle(productFromCheckoutLineItems(session));
    } catch (_) {
      /* ignore */
    }
  }
  if (badProductPlaceholder(product)) {
    const lineTitle = productFromCheckoutLineItems(session);
    const stripped = stripHostedProductTitle(lineTitle);
    const cand = stripped || String(lineTitle || "").trim();
    if (!badProductPlaceholder(cand)) product = cand;
  }

  applyPid();

  /* Last resort: exact catalog match on Stripe line item title (hosted description). */
  if (badProductPlaceholder(product)) {
    const lineTitle = stripHostedProductTitle(productFromCheckoutLineItems(session));
    const slug = normalizeCatalogName(lineTitle);
    if (slug) {
      const hit = loadStoreCatalogSync().byName[slug];
      if (hit?.siteProductName) product = hit.siteProductName;
    }
  }

  return { m, product, email, username };
}

function normalizeCode(value = "") {
  return value.trim().toUpperCase();
}

/** Parse list price from JSON (handles 12, 12.5, 12,50 if no other dots) */
function parseServerMoney(raw) {
  if (raw == null) return NaN;
  let s = String(raw).replace(/\$/g, "").replace(/\s/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",") && !s.includes(".")) s = s.replace(/,/g, ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function productSlug(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function productMatchesHint(product, hint) {
  return productSlug(product).includes(productSlug(hint));
}

function applyPromo(amount, promo) {
  if (!promo) return Number(amount);
  const base = Number(amount);
  if (promo.type === "percent") {
    return Math.max(0, +(base * (1 - promo.value / 100)).toFixed(2));
  }
  if (promo.type === "fixed") {
    return Math.max(0, +(base - promo.value).toFixed(2));
  }
  return base;
}

function applyGiftCardDiscount(amount, giftCard) {
  if (!giftCard) return Number(amount);
  const base = Number(amount);
  const rawAmount =
    Number(giftCard.amount_usd ?? giftCard.amountUsd ?? giftCard.value ?? 0);
  if (!rawAmount || rawAmount <= 0) return base;
  return Math.max(0, +(base - rawAmount).toFixed(2));
}

async function computeFinalAmount({ product, amount, promoCode = "", giftCardCode = "" }) {
  const baseNum =
    typeof amount === "number" && Number.isFinite(amount) ? amount : parseServerMoney(String(amount));
  if (!Number.isFinite(baseNum) || baseNum < 0) {
    return {
      finalAmount: NaN,
      subtotalAfterPromo: NaN,
      promoApplied: false,
      giftCardApplied: false,
      giftCardDiscountUsed: 0,
      giftCardRejectReason: null,
      promo: null,
    };
  }

  const promo = await getPromo(promoCode);
  const subtotalAfterPromo = applyPromo(baseNum, promo);
  let finalAmount = subtotalAfterPromo;

  let giftCardDiscountUsed = 0;
  let giftCardApplied = false;
  let giftCardRejectReason = null;
  const giftCodeNorm = normalizeCode(giftCardCode);
  const giftCard = giftCodeNorm ? await getGiftCard(giftCardCode) : null;

  if (giftCodeNorm) {
    if (!giftCard) {
      giftCardRejectReason = "not_found";
    } else {
      const gcVal = Number(giftCard.amount_usd ?? giftCard.amountUsd ?? giftCard.value ?? 0);
      if (giftCard.redeemed) giftCardRejectReason = "redeemed";
      else if (!Number.isFinite(gcVal) || gcVal <= 0) giftCardRejectReason = "zero_balance";
      else if (giftCard.product_hint && !productMatchesHint(product, giftCard.product_hint)) {
        giftCardRejectReason = "wrong_product";
      }
    }
  }

  if (giftCard) {
    const gcVal = Number(giftCard.amount_usd ?? giftCard.amountUsd ?? giftCard.value ?? 0);
    const redeemAllowed =
      !giftCard.redeemed &&
      Number.isFinite(gcVal) &&
      gcVal > 0 &&
      (!giftCard.product_hint || productMatchesHint(product, giftCard.product_hint));
    if (redeemAllowed) {
      const beforeGift = finalAmount;
      finalAmount = applyGiftCardDiscount(finalAmount, giftCard);
      giftCardDiscountUsed = +(beforeGift - finalAmount).toFixed(2);
      giftCardApplied = true;
      giftCardRejectReason = null;
    }
  }

  return {
    finalAmount,
    subtotalAfterPromo,
    promo,
    promoApplied: Boolean(promo),
    giftCardApplied,
    giftCardDiscountUsed,
    giftCardRejectReason,
  };
}

function createCustomPaymentLinkToken(payload) {
  const token = `cpl_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  customPaymentLinks.set(token, {
    ...payload,
    createdAt: Date.now(),
    used: false,
  });
  return token;
}

/** If catalog has list price, client amount must match (prevents tampered checkout). */
function assertPriceMatchesCatalog(resolved, clientAmountNum) {
  if (resolved.listUsd == null || !Number.isFinite(resolved.listUsd)) return;
  if (Math.abs(Number(clientAmountNum) - Number(resolved.listUsd)) > 0.02) {
    throw new Error(
      `Listed price mismatch for ${resolved.productId || resolved.siteProductName}. Refresh the page and try again.`
    );
  }
}

function getProductImagePath(product = "") {
  return storefrontImagePathFromSiteProductName(product);
}

async function consumeGiftCardBalance({ giftCardCode, amountToConsume, buyerIdentity }) {
  const code = normalizeCode(giftCardCode);
  const spend = Number(amountToConsume);
  if (!code || !Number.isFinite(spend) || spend <= 0) {
    return { ok: true, remainingBalance: null };
  }
  if (supabase) {
    const { data: giftCard, error } = await supabase
      .from("gift_cards")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!giftCard) throw new Error("Gift card not found");
    const current = Number(giftCard.amount_usd ?? 0);
    if (current < spend) throw new Error("Gift card balance is too low");
    const remaining = +(current - spend).toFixed(2);
    const update = {
      amount_usd: remaining,
      redeemed: remaining <= 0,
      active: remaining > 0,
      redeemed_by: buyerIdentity,
      redeemed_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from("gift_cards")
      .update(update)
      .eq("id", giftCard.id);
    if (updateError) throw updateError;
    return { ok: true, remainingBalance: remaining };
  }

  const local = FALLBACK_GIFTS[code];
  if (!local) throw new Error("Gift card not found");
  const current = Number(local.amount_usd ?? local.amountUsd ?? 0);
  if (current < spend) throw new Error("Gift card balance is too low");
  const remaining = +(current - spend).toFixed(2);
  local.amount_usd = remaining;
  local.redeemed = remaining <= 0;
  return { ok: true, remainingBalance: remaining };
}

async function getPromo(codeRaw) {
  const code = normalizeCode(codeRaw);
  if (!code) return null;
  if (supabase) {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (!error && data) return data;
  }
  return FALLBACK_PROMOS[code] ?? null;
}

async function getGiftCard(codeRaw) {
  const code = normalizeCode(codeRaw);
  if (!code) return null;
  if (supabase) {
    const { data, error } = await supabase
      .from("gift_cards")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (!error && data) return data;
  }
  return FALLBACK_GIFTS[code] ?? null;
}

async function markGiftCardRedeemed(codeRaw, discordOrEmail = "web") {
  const code = normalizeCode(codeRaw);
  if (!code) return;
  if (supabase) {
    await supabase
      .from("gift_cards")
      .update({
        active: false,
        redeemed: true,
        redeemed_at: new Date().toISOString(),
        redeemed_by: discordOrEmail,
      })
      .eq("code", code);
    return;
  }
  if (FALLBACK_GIFTS[code]) FALLBACK_GIFTS[code].redeemed = true;
}

async function fulfillStripeCheckoutSession(session) {
  if (!session || !session.id) {
    return { ok: false, error: "Invalid session" };
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false, error: "Payment not completed" };
  }

  const { m, product, email, username } = await fulfillmentIdentityFromSession(session);
  if (!product || !email || !username) {
    return {
      ok: false,
      error:
        "Checkout session missing product, email, or username. Use website checkout or add metadata / customer email on Payment Links.",
    };
  }

  const giftSpend = parseServerMoney(m.gift_card_discount_used);
  const giftCardDiscountUsed = Number.isFinite(giftSpend) && giftSpend > 0 ? giftSpend : 0;
  const giftCardCode = m.giftCardCode || "";
  const orderId = orderIdFromCheckoutSessionId(session.id);
  const licenseExpiresAt = computeLicenseExpiresAtIso(product);

  if (supabase) {
    const { data: ex, error: selErr } = await supabaseSelectOrderByOrderId(orderId);
    if (selErr) return { ok: false, error: selErr.message };
    if (ex) {
      let dupPid = "";
      try {
        dupPid = resolveProductFromRequest({ product: ex.product }).productId || "";
      } catch (_) {
        /* unknown legacy product string */
      }
      return {
        ok: true,
        orderId: ex.order_id,
        licenseKey: ex.license_key,
        product: ex.product,
        productId: dupPid,
        remainingGiftCardBalance: null,
        licenseExpiresAt: ex.license_expires_at ?? null,
        duplicate: true,
      };
    }
  } else if (stripeFulfilledMemory.has(session.id)) {
    return { ok: true, ...stripeFulfilledMemory.get(session.id), duplicate: true };
  }

  const skuId = catalogProductIdFromMetaAndName(m, product);
  const licenseKey = generateLicenseKey(product, skuId);
  if (supabase) {
    const insErr = await supabaseInsertOrderRow({
      order_id: orderId,
      email: normalizeIdentity(email),
      username: normalizeIdentity(username),
      product,
      status: "completed",
      license_key: licenseKey,
      license_expires_at: licenseExpiresAt,
    });
    if (insErr) return { ok: false, error: insErr.message };
  }

  let remainingGiftCardBalance = null;
  if (giftCardCode && giftCardDiscountUsed > 0) {
    const consumed = await consumeGiftCardBalance({
      giftCardCode: normalizeCode(giftCardCode),
      amountToConsume: giftCardDiscountUsed,
      buyerIdentity: normalizeIdentity(email),
    });
    remainingGiftCardBalance = consumed.remainingBalance;
  }

  if (!supabase) {
    stripeFulfilledMemory.set(session.id, {
      orderId,
      licenseKey,
      product,
      productId: skuId,
      remainingGiftCardBalance,
      licenseExpiresAt,
    });
  }

  return {
    ok: true,
    orderId,
    licenseKey,
    product,
    productId: skuId,
    remainingGiftCardBalance,
    licenseExpiresAt,
    duplicate: false,
  };
}

async function previewOrderHandler(req, res) {
  try {
    const { amount = "9.99", promoCode = "", giftCardCode = "" } = req.body ?? {};
    let resolved;
    try {
      resolved = resolveProductFromRequest(req.body ?? {});
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid product" });
    }
    const product = resolved.siteProductName;
    if (!resolved.productId) {
      return res.status(400).json({
        error:
          "Could not resolve a catalog product for this preview. Refresh the store page and try again.",
      });
    }
    const parsedClient = parseServerMoney(String(amount));
    const baseAmount =
      resolved.listUsd != null && Number.isFinite(resolved.listUsd) ? Number(resolved.listUsd) : parsedClient;
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({ error: "amount must be a valid positive number" });
    }
    try {
      assertPriceMatchesCatalog(resolved, parsedClient);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const {
      finalAmount,
      subtotalAfterPromo,
      promo,
      promoApplied,
      giftCardApplied,
      giftCardDiscountUsed,
      giftCardRejectReason,
    } = await computeFinalAmount({
      product,
      amount: baseAmount,
      promoCode,
      giftCardCode,
    });

    const freeViaFullPromo = Boolean(promo) && subtotalAfterPromo < 0.01;
    return res.json({
      baseAmount,
      finalAmount,
      discountAmount: +(baseAmount - finalAmount).toFixed(2),
      promoApplied,
      giftCardApplied,
      giftCardDiscountUsed,
      giftCardRejectReason,
      subtotalAfterPromo,
      customPaymentEligible:
        Number.isFinite(finalAmount) && finalAmount < 0.01 && (giftCardApplied || freeViaFullPromo),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

app.post("/api/payments/preview-order", previewOrderHandler);
app.post("/api/paypal/preview-order", previewOrderHandler);

app.get("/api/stripe/config", (_req, res) => {
  res.json({ enabled: Boolean(stripe) });
});

async function createCheckoutSessionHandler(req, res) {
  try {
    assertStripe();
    const { amount = "9.99", currency = "USD", email, username, promoCode = "", giftCardCode = "" } = req.body ?? {};
    let resolved;
    try {
      resolved = resolveProductFromRequest(req.body ?? {});
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid product" });
    }
    const product = resolved.siteProductName;
    if (!email || !username) {
      return res.status(400).json({
        error: "Email and username are required",
      });
    }
    if (!resolved.productId) {
      return res.status(400).json({
        error:
          "Could not resolve a catalog product from this checkout. Refresh the store page and try again.",
      });
    }

    const parsedClient = parseServerMoney(String(amount));
    const baseNum =
      resolved.listUsd != null && Number.isFinite(resolved.listUsd) ? Number(resolved.listUsd) : parsedClient;
    if (!Number.isFinite(baseNum) || baseNum < 0) {
      return res.status(400).json({ error: "amount must be a valid non-negative number" });
    }
    try {
      assertPriceMatchesCatalog(resolved, parsedClient);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const {
      finalAmount,
      subtotalAfterPromo,
      promo,
      giftCardApplied,
      giftCardDiscountUsed,
    } = await computeFinalAmount({
      product,
      amount: baseNum,
      promoCode,
      giftCardCode,
    });

    const freeViaFullPromo = Boolean(promo) && subtotalAfterPromo < 0.01;

    if (finalAmount < 0.01 && (giftCardApplied || freeViaFullPromo)) {
      const siteBase = publicAppBase(req);
      const token = createCustomPaymentLinkToken({
        product,
        productId: resolved.productId || "",
        email: normalizeIdentity(email),
        username: normalizeIdentity(username),
        giftCardCode: giftCardApplied ? normalizeCode(giftCardCode) : "",
        giftCardDiscountUsed: giftCardDiscountUsed ?? 0,
        freeViaPromo: Boolean(freeViaFullPromo && !giftCardApplied),
      });
      return res.json({
        customPayment: true,
        finalAmount: 0,
        customPaymentUrl: `${siteBase}/api/payments/custom-payment/${token}`,
      });
    }

    if (!Number.isFinite(finalAmount) || finalAmount < 0.01) {
      return res.status(400).json({
        error:
          "Order total is too small after applying your codes. Clear any invalid promo/gift input to pay the full list price, or check the amount and codes you entered.",
        finalAmount,
        giftCardApplied,
        subtotalAfterPromo,
        baseAmount: baseNum,
      });
    }

    const site = publicAppBase(req);
    const cur = String(currency || "USD").toLowerCase();
    const checkoutExtras = resolveStripeCheckoutSessionOverrides(cur);
    const valueStr = (Math.round(Number(finalAmount) * 100) / 100).toFixed(2);
    const unitCents = Math.round(Number(valueStr) * 100);
    if (!Number.isFinite(unitCents) || unitCents < 1) {
      return res.status(400).json({ error: "Invalid charge amount" });
    }
    const itemName = String(product).replace(/\s+/g, " ").trim().slice(0, 120) || "Verdant product";
    const meta = {
      product: String(product).slice(0, 500),
      product_id: String(resolved.productId || "").slice(0, 120),
      email: normalizeIdentity(email).slice(0, 200),
      username: normalizeIdentity(username).slice(0, 200),
      promoCode: normalizeCode(promoCode) || "",
      giftCardCode: normalizeCode(giftCardCode) || "",
      list_amount: baseNum.toFixed(2),
      gift_card_discount_used: (giftCardDiscountUsed ?? 0).toFixed(2),
    };
    const checkoutImages = absoluteStorefrontImageUrls(site, resolved.productId, resolved.siteProductName);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...checkoutExtras,
      line_items: [
        {
          price_data: {
            currency: cur,
            product_data: {
              name: itemName,
              description: `Verdant External - ${itemName}`.slice(0, 500),
              images: checkoutImages,
            },
            unit_amount: unitCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${site}/payment-return.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/payment-return.html?cancel=1`,
      customer_email: String(email).includes("@") ? String(email).trim() : undefined,
      metadata: meta,
    });
    return res.json({
      url: session.url,
      sessionId: session.id,
      finalAmount: Number(valueStr),
    });
  } catch (error) {
    const message = error?.raw ? extractStripeApiError(error) : error?.message;
    return res.status(400).json({
      error: message || "Could not start Stripe Checkout",
      stripe: error?.raw || null,
    });
  }
}

app.post("/api/stripe/create-checkout-session", createCheckoutSessionHandler);
app.post("/api/paypal/create-order", createCheckoutSessionHandler);

app.post("/api/stripe/verify-session", async (req, res) => {
  try {
    assertStripe();
    const { sessionId } = req.body ?? {};
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const session = await retrieveCheckoutSessionForFulfillment(sessionId);
    const r = await fulfillStripeCheckoutSession(session);
    if (!r.ok) {
      try {
        dashboardNotifications.append(
          {
            type: "verify_failed",
            severity: "error",
            title: "Payment received - license not issued yet",
            detail: String(r.error),
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentIdFromSession(session),
            recoverable: true,
            ...sessionMoneyFields(session),
          },
          { dedupeKey: `verify_fail_${session.id}` }
        );
      } catch (_) {
        /* ignore store errors */
      }
      return res.status(400).json({ error: r.error });
    }
    return res.json({
      orderId: r.orderId,
      licenseKey: r.licenseKey,
      product: r.product,
      productId: r.productId ?? "",
      remainingGiftCardBalance: r.remainingGiftCardBalance,
      licenseExpiresAt: r.licenseExpiresAt ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/stripe/webhook", (_req, res) => {
  res.type("text/plain; charset=utf-8").send(
    "Stripe webhook URL - POST only. Stripe Dashboard must point here with signing secret; opening this link in a browser (GET) does not trigger a webhook."
  );
});

app.post("/api/stripe/webhook", async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook: ${err.message}`);
  }

  const type = event.type;
  const obj = event.data.object;

  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const session = obj;
      const r = await fulfillStripeCheckoutSession(session);
      if (!r.ok) {
        const errStr = String(r.error || "");
        if (!errStr.includes("not completed") && !errStr.includes("Payment not completed")) {
          console.error("Stripe webhook fulfill:", r.error, session?.id);
          dashboardNotifications.append(
            {
              type: "fulfill_failed",
              severity: "error",
              title: "Stripe paid - database order missing or blocked",
              detail: errStr,
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentIdFromSession(session),
              recoverable: true,
              ...sessionMoneyFields(session),
            },
            { dedupeKey: `webhook_fail_${session.id}` }
          );
        }
      }
    } else if (type === "checkout.session.async_payment_failed") {
      const session = obj;
      dashboardNotifications.append(
        {
          type: "async_payment_failed",
          severity: "error",
          title: "Async payment failed",
          detail: `Session ${session.id}`,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentIdFromSession(session),
          ...sessionMoneyFields(session),
        },
        { dedupeKey: `async_fail_${session.id}` }
      );
    } else if (type === "payment_intent.payment_failed") {
      const pi = obj;
      dashboardNotifications.append(
        {
          type: "payment_failed",
          severity: "warn",
          title: "Payment failed",
          detail: pi.last_payment_error?.message || pi.id,
          stripePaymentIntentId: pi.id,
          amountCents: pi.amount,
          currency: pi.currency,
        },
        { dedupeKey: `pi_failed_${pi.id}`, windowMs: 60 * 60 * 1000 }
      );
    } else if (type === "payment_intent.processing") {
      const pi = obj;
      dashboardNotifications.append(
        {
          type: "payment_processing",
          severity: "info",
          title: "Payment processing",
          detail: "Awaiting confirmation from the payment method.",
          stripePaymentIntentId: pi.id,
          amountCents: pi.amount,
          currency: pi.currency,
        },
        { dedupeKey: `pi_processing_${pi.id}`, windowMs: 30 * 60 * 1000 }
      );
    }
  } catch (e) {
    console.error("Webhook side-effect:", e?.message || e);
  }

  return res.json({ received: true });
});

/** Public read - same feed as admin (no secrets in payload). */
app.get("/api/notifications", (_req, res) => {
  res.json({ items: dashboardNotifications.readAll() });
});

app.get("/api/public/shop-config", (_req, res) => {
  res.json({
    shopOperatorEmails: shopOperatorEmailsList(),
  });
});

app.post("/api/shop/grant-licenses", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Database not configured" });
  }
  if (!assertShopGrantAuthorized(req, res)) return;
  const grants = req.body?.grants;
  if (!Array.isArray(grants) || !grants.length) {
    return res.status(400).json({ error: "grants must be a non-empty array" });
  }
  const results = [];
  for (const g of grants) {
    const email = normalizeIdentity(g.email ?? "");
    const username = normalizeIdentity(g.username ?? "");
    const productId = String(g.productId ?? "").trim();
    if (!email || !username || !productId) {
      results.push({ ok: false, error: "Each grant needs email, username, productId", raw: g });
      continue;
    }
    try {
      const resolved = resolveProductFromRequest({ productId });
      const product = resolved.siteProductName;
      const skuId = resolved.productId;
      const licenseKey = generateLicenseKey(product, skuId);
      const licenseExpiresAt = computeLicenseExpiresAtIso(product);
      const orderId = `ORD-GIFT-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
      const row = {
        order_id: orderId,
        email,
        username,
        product,
        status: "completed",
        license_key: licenseKey,
        license_expires_at: licenseExpiresAt,
      };
      const insErr = await supabaseInsertOrderRow(row);
      if (insErr) {
        results.push({ ok: false, error: insErr.message, productId });
      } else {
        results.push({
          ok: true,
          orderId,
          licenseKey,
          product,
          productId: skuId,
        });
      }
    } catch (e) {
      results.push({ ok: false, error: e.message || String(e), productId });
    }
  }
  res.json({ results });
});

app.get("/api/admin/notifications", (req, res) => {
  if (!assertDashboardAdmin(req, res)) return;
  res.json({ items: dashboardNotifications.readAll() });
});

app.post("/api/admin/notifications/read", (req, res) => {
  if (!assertDashboardAdmin(req, res)) return;
  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ error: "id required" });
  dashboardNotifications.markRead(id);
  res.json({ ok: true });
});

app.post("/api/admin/notifications/read-all", (req, res) => {
  if (!assertDashboardAdmin(req, res)) return;
  dashboardNotifications.markAllRead();
  res.json({ ok: true });
});

app.post("/api/admin/stripe/recover-fulfillment", async (req, res) => {
  if (!assertDashboardAdmin(req, res)) return;
  try {
    assertStripe();
    const { sessionId, paymentIntentId } = req.body ?? {};
    const sid = String(sessionId ?? "").trim();
    const pi = String(paymentIntentId ?? "").trim();
    if (!sid && !pi) {
      return res.status(400).json({ error: "sessionId or paymentIntentId required" });
    }
    let full;
    if (sid) {
      full = await retrieveCheckoutSessionForFulfillment(sid);
    } else {
      const list = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 5 });
      if (!list.data.length) {
        return res.status(404).json({
          error:
            "No Checkout Session linked to this PaymentIntent. Customer may have paid outside Checkout.",
        });
      }
      full = await retrieveCheckoutSessionForFulfillment(list.data[0].id);
    }
    const r = await fulfillStripeCheckoutSession(full);
    if (!r.ok) {
      return res.status(400).json({ error: r.error, stripeSessionId: full.id });
    }
    dashboardNotifications.append({
      type: "payment_recovered",
      severity: "success",
      title: "Fulfillment restored",
      detail: r.duplicate
        ? `Order already existed: ${r.orderId}`
        : `Issued ${r.product} → ${r.orderId}`,
      stripeSessionId: full.id,
      stripePaymentIntentId: paymentIntentIdFromSession(full),
      orderId: r.orderId,
    });
    return res.json({
      ok: true,
      duplicate: Boolean(r.duplicate),
      orderId: r.orderId,
      licenseKey: r.licenseKey,
      product: r.product,
      productId: r.productId ?? "",
      remainingGiftCardBalance: r.remainingGiftCardBalance,
      licenseExpiresAt: r.licenseExpiresAt ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/paypal/redeem-gift-card", async (req, res) => {
  return res.status(400).json({
    error: "Gift cards are discount-only. Use normal checkout with giftCardCode.",
  });
});

async function customPaymentGet(req, res) {
  try {
    const { token } = req.params;
    const payload = customPaymentLinks.get(token);
    if (!payload) {
      return res.status(404).send("Custom payment link not found.");
    }
    if (payload.used) {
      return res.status(400).send("Custom payment link has already been used.");
    }
    if (Date.now() - payload.createdAt > 1000 * 60 * 30) {
      customPaymentLinks.delete(token);
      return res.status(400).send("Custom payment link expired.");
    }

    const orderId = generateOrderId(`giftbal-${Date.now()}`);
    const licenseKey = generateLicenseKey(payload.product, payload.productId || "");
    const licenseExpiresAt = computeLicenseExpiresAtIso(payload.product);
    if (supabase) {
      const error = await supabaseInsertOrderRow({
        order_id: orderId,
        email: payload.email,
        username: payload.username,
        product: payload.product,
        status: "completed",
        license_key: licenseKey,
        license_expires_at: licenseExpiresAt,
      });
      if (error) return res.status(500).send(`Failed to create order: ${error.message}`);
    }

    const consumed = await consumeGiftCardBalance({
      giftCardCode: payload.giftCardCode,
      amountToConsume: payload.giftCardDiscountUsed,
      buyerIdentity: payload.email,
    });
    payload.used = true;
    customPaymentLinks.set(token, payload);

    const isPromoOnly = Boolean(payload.freeViaPromo);
    const giftRowHtml = isPromoOnly
      ? ""
      : `<div class="row"><strong>Gift card balance (after use):</strong> ${
          consumed.remainingBalance == null
            ? "-"
            : "$" + Number(consumed.remainingBalance).toFixed(2)
        }</div>`;
    return res.send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Verdant Payment Complete</title>
          <style>
            :root {
              --bg: #050505;
              --panel: rgba(14, 14, 14, 0.72);
              --line: rgba(255, 255, 255, 0.14);
              --text: #f8f8f8;
              --muted: #a9a9a9;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              font-family: Inter, Segoe UI, sans-serif;
              color: var(--text);
              background: radial-gradient(circle at 20% -10%, #1a1a1a 0%, var(--bg) 45%);
              display: grid;
              place-items: center;
              padding: 24px;
            }
            .card {
              width: min(760px, 100%);
              border: 1px solid var(--line);
              border-radius: 16px;
              background: var(--panel);
              box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(10px);
              padding: 22px;
            }
            h1 {
              margin: 0 0 10px;
              font-size: 1.5rem;
            }
            .muted {
              color: var(--muted);
              margin-bottom: 14px;
            }
            .product-image {
              width: 100%;
              max-height: 260px;
              object-fit: cover;
              border-radius: 12px;
              border: 1px solid rgba(255, 255, 255, 0.16);
              margin: 8px 0 16px;
              display: block;
            }
            .rows {
              display: grid;
              gap: 10px;
              margin-top: 8px;
            }
            .row {
              border: 1px solid var(--line);
              border-radius: 10px;
              background: rgba(255, 255, 255, 0.03);
              padding: 10px 12px;
            }
            .row strong {
              display: inline-block;
              min-width: 180px;
            }
            .actions {
              margin-top: 18px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .btn {
              border-radius: 10px;
              padding: 10px 14px;
              font-weight: 700;
              text-decoration: none;
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: var(--text);
              background: transparent;
            }
            .btn.primary {
              border-color: transparent;
              background: linear-gradient(180deg, #fff, #d8d8d8);
              color: #0a0a0a;
            }
          </style>
        </head>
        <body>
          <main class="card">
            <h1>Verdant Payment Complete</h1>
            <p class="muted">${
              isPromoOnly
                ? "No payment was required (promotional pricing)."
                : "Order created successfully with gift card balance."
            }</p>
            <img class="product-image" src="${getProductImagePath(payload.product)}" alt="Product image" />
            <div class="rows">
              <div class="row"><strong>Product:</strong> ${payload.product}</div>
              <div class="row"><strong>Order ID:</strong> ${orderId}</div>
              <div class="row"><strong>License Key:</strong> ${licenseKey}</div>
              ${giftRowHtml}
            </div>
            <div class="actions">
              <a class="btn" href="javascript:history.back()">Go Back</a>
              <a class="btn primary" href="/dashboard.html">Go to Dashboard</a>
              <a class="btn" href="/products.html">Go to Products</a>
            </div>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(`Custom payment failed: ${error.message}`);
  }
}

app.get("/api/payments/custom-payment/:token", customPaymentGet);
app.get("/api/paypal/custom-payment/:token", customPaymentGet);

app.get("/api/client/version", (_req, res) => {
  const latestVersion = String(LAUNCHER_LATEST_VERSION || "").trim();
  const minCompatibleVersion = String(LAUNCHER_MIN_VERSION || "").trim();
  const channel = String(LAUNCHER_UPDATE_CHANNEL || "stable").trim() || "stable";
  const downloadUrl = String(LAUNCHER_UPDATE_URL || "").trim();
  const sha256 = String(LAUNCHER_UPDATE_SHA256 || "").trim().toLowerCase();
  const signature = String(LAUNCHER_UPDATE_SIGNATURE || "").trim();
  const notes = String(LAUNCHER_RELEASE_NOTES || "Latest stable launcher build.");
  let runtimeFiles = [];
  try {
    const parsed = JSON.parse(LAUNCHER_RUNTIME_FILES_JSON);
    if (Array.isArray(parsed)) {
      runtimeFiles = parsed
        .map((entry) => ({
          path: String(entry?.path ?? "").trim(),
          url: String(entry?.url ?? "").trim(),
          sha256: String(entry?.sha256 ?? "").trim().toLowerCase(),
        }))
        .filter((entry) => entry.path && entry.url);
    }
  } catch {
    runtimeFiles = [];
  }

  if (!latestVersion) {
    return res.status(500).json({
      error: "Launcher latest version is not configured",
      code: "LAUNCHER_VERSION_MISSING",
    });
  }

  const hasUpdateArtifact = Boolean(downloadUrl);
  return res.json({
    product: "verdant-launcher",
    latestVersion,
    notes,
    // Backward-compatible keys consumed by older launcher builds.
    updateAvailable: false,
    // Updater payload for newer builds.
    update: {
      channel,
      latestVersion,
      minCompatibleVersion: minCompatibleVersion || "0.0.0",
      downloadUrl,
      sha256,
      signature,
      notes,
      hasUpdateArtifact,
      installMode: "runtime_bundle",
      runtime: {
        files: runtimeFiles,
      },
      publishedAt: new Date().toISOString(),
    },
  });
});

app.post("/api/client/verify-license", async (req, res) => {
  try {
    const { licenseKey, email = "", username = "", product = "", hwid = "" } = req.body ?? {};
    const normalizedKey = normalizeCode(licenseKey);
    if (!normalizedKey || !hwid) {
      return res.status(400).json({ error: "licenseKey and hwid are required" });
    }

    if (!supabase) {
      if (normalizedKey === "VERDANT-DEMO-KEY") {
        return res.json({
          valid: true,
          bound: true,
          message: "Demo mode license accepted.",
          orderId: "DEMO-ORDER",
          product: product || "Fortnite",
        });
      }
      return res.status(404).json({ valid: false, error: "License not found" });
    }

    const { data: order, error } = await supabaseSelectOrderByLicenseKey(normalizedKey);
    if (error) return res.status(500).json({ error: error.message });
    if (!order) return res.status(404).json({ valid: false, error: "License not found" });
    if (order.license_expires_at) {
      const expMs = new Date(order.license_expires_at).getTime();
      if (Number.isFinite(expMs) && Date.now() > expMs) {
        return res.status(403).json({
          valid: false,
          error: "License expired",
          licenseExpiresAt: order.license_expires_at,
        });
      }
    }
    if (!order.claimed_discord_id) {
      return res.status(403).json({
        valid: false,
        error: "License is not activated yet. Claim order in Discord first.",
      });
    }
    if (order.status && String(order.status).toLowerCase() !== "completed") {
      return res.status(400).json({ valid: false, error: "Order not completed for this license" });
    }

    const normalizedEmail = normalizeIdentity(email);
    const normalizedUser = normalizeIdentity(username);
    if (normalizedEmail && order.email !== normalizedEmail) {
      return res.status(403).json({ valid: false, error: "License email mismatch" });
    }
    if (normalizedUser && order.username !== normalizedUser) {
      return res.status(403).json({ valid: false, error: "License username mismatch" });
    }
    if (product && !productMatchesHint(order.product, product)) {
      return res.status(403).json({ valid: false, error: "License product mismatch" });
    }

    const currentLock = order.hwid_lock ?? "";
    if (currentLock && currentLock !== hwid) {
      return res.status(403).json({ valid: false, error: "HWID mismatch: reset required" });
    }

    const nextLock = currentLock || hwid;
    const { error: updateError } = await supabase
      .from(SUPABASE_ORDERS_TABLE)
      .update({
        hwid_lock: nextLock,
        hwid_last_seen: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.json({
      valid: true,
      bound: !currentLock,
      message: currentLock ? "License verified." : "License verified and HWID bound.",
      orderId: order.order_id,
      product: order.product,
      licenseExpiresAt: order.license_expires_at ?? null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/favicon.ico", (_req, res) => {
  res.sendFile(FAVICON_PATH, (err) => {
    if (!err) return;
    res.sendFile(FAVICON_PNG_PATH, (pngErr) => {
      if (pngErr) res.status(404).end();
    });
  });
});

app.use(express.static(WEB_ROOT));
app.listen(PORT, () => {
  console.log(`Verdant web server running on http://localhost:${PORT}`);
});
