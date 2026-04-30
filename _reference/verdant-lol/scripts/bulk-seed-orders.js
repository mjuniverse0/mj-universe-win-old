#!/usr/bin/env node
/**
 * Insert many manual orders (service role). Uses catalog from config/store-products.json.
 *
 * Examples:
 *   node scripts/bulk-seed-orders.js --dry-run --all-products --email=mjuniverse0607@gmail.com --username=mjuniverse
 *   node scripts/bulk-seed-orders.js --email=imseniiq@gmail.com --username=tebn --products=apex-life,roblox-life
 */

require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { loadStoreCatalogSync, resolveProductFromRequest } = require("../lib/storeCatalog");
const { computeLicenseExpiresAtIso } = require("../lib/licenseExpiry");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TABLE = process.env.SUPABASE_ORDERS_TABLE ?? "orders";

function normalizeIdentity(v = "") {
  return String(v).trim().toLowerCase();
}

function productSlug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

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

async function insertRow(supabase, row) {
  let { error } = await supabase.from(TABLE).insert(row);
  if (!error) return null;
  const m = String(error.message || "");
  if (m.includes("license_expires_at") && Object.prototype.hasOwnProperty.call(row, "license_expires_at")) {
    const { license_expires_at: _o, ...rest } = row;
    ({ error } = await supabase.from(TABLE).insert(rest));
  }
  return error;
}

function parseArgs(argv) {
  const out = {
    email: "",
    username: "",
    products: [],
    allProducts: false,
    dryRun: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--all-products") out.allProducts = true;
    if (a.startsWith("--email=")) out.email = a.slice("--email=".length);
    if (a.startsWith("--username=")) out.username = a.slice("--username=".length);
    if (a.startsWith("--products=")) {
      out.products = a
        .slice("--products=".length)
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = normalizeIdentity(args.email);
  const username = normalizeIdentity(args.username);
  if (!email || !username) {
    console.error("Required: --email= --username=");
    process.exit(1);
  }

  let ids = args.products;
  if (args.allProducts) {
    const cat = loadStoreCatalogSync();
    ids = cat.items.map((x) => x.id).filter(Boolean);
  }
  if (!ids.length) {
    console.error("Use --all-products or --products=id1,id2");
    process.exit(1);
  }

  console.log("Rows to insert:", ids.length, "for", email, "/", username, args.dryRun ? "(dry-run)" : "");

  if (!args.dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const results = [];

  for (const productId of ids) {
    let resolved;
    try {
      resolved = resolveProductFromRequest({ productId });
    } catch (e) {
      results.push({ productId, ok: false, error: e.message });
      continue;
    }
    const product = resolved.siteProductName;
    const licenseKey = generateLicenseKey(product, resolved.productId);
    const licenseExpiresAt = computeLicenseExpiresAtIso(product);
    const orderId = `ORD-SEED-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const row = {
      order_id: orderId,
      email,
      username,
      product,
      status: "completed",
      license_key: licenseKey,
      license_expires_at: licenseExpiresAt,
    };
    console.log(productId, "→", licenseKey);
    if (args.dryRun) {
      results.push({ ok: true, dryRun: true, orderId, productId, licenseKey });
      continue;
    }
    if (!supabase) continue;
    const err = await insertRow(supabase, row);
    if (err) results.push({ ok: false, productId, error: err.message });
    else results.push({ ok: true, orderId, productId, licenseKey, product });
  }

  console.log("\nDone.", args.dryRun ? "No DB writes." : `Inserted ${results.filter((r) => r.ok).length} orders.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
