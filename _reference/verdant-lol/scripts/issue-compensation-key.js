#!/usr/bin/env node
/**
 * Fix a bad checkout row (e.g. product "Unknown") or insert a manual compensation order.
 *
 * Usage (from repo root, with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env):
 *   node scripts/issue-compensation-key.js
 *   node scripts/issue-compensation-key.js --email=user@mail.com --username=tebn --product-id=roblox-life
 *   node scripts/issue-compensation-key.js --dry-run
 *
 * Default run targets the compensation case: Roblox Lifetime for Imseniiq@gmail.com / Tebn.
 */

require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");
const { resolveProductFromRequest } = require("../lib/storeCatalog");
const { computeLicenseExpiresAtIso } = require("../lib/licenseExpiry");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ORDERS_TABLE = process.env.SUPABASE_ORDERS_TABLE ?? "orders";

function normalizeIdentity(value = "") {
  return String(value).trim().toLowerCase();
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

function parseArgs(argv) {
  const out = {
    email: "imseniiq@gmail.com",
    username: "tebn",
    productId: "roblox-life",
    dryRun: false,
    insertIfMissing: true,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--no-insert") out.insertIfMissing = false;
    if (a.startsWith("--email=")) out.email = a.slice("--email=".length);
    if (a.startsWith("--username=")) out.username = a.slice("--username=".length);
    if (a.startsWith("--product-id=")) out.productId = a.slice("--product-id=".length);
  }
  return out;
}

function isUnknownProduct(p) {
  const s = String(p || "").trim();
  return !s || /^unknown$/i.test(s);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = normalizeIdentity(args.email);
  const username = normalizeIdentity(args.username);
  let resolved;
  try {
    resolved = resolveProductFromRequest({ productId: args.productId });
  } catch (e) {
    console.error("Invalid product-id:", e.message || e);
    process.exit(1);
  }
  const product = resolved.siteProductName;
  const licenseKey = generateLicenseKey(product, resolved.productId);
  const licenseExpiresAt = computeLicenseExpiresAtIso(product);

  console.log("--- Compensation key (preview) ---");
  console.log("Email:          ", email);
  console.log("Username:       ", username);
  console.log("Product (DB):   ", product);
  console.log("product_id:     ", resolved.productId);
  console.log("License key:    ", licenseKey);
  console.log("license_expires:", licenseExpiresAt ?? "(null = lifetime)");
  console.log("Dry run:        ", args.dryRun);

  if (args.dryRun) {
    console.log("\n(No database writes - remove --dry-run to apply.)");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env - cannot write.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const table = SUPABASE_ORDERS_TABLE;

  const { data: rows, error: selErr } = await supabase.from(table).select("*").eq("email", email);
  if (selErr) {
    console.error("Select failed:", selErr.message);
    process.exit(1);
  }

  const unknownRows = (rows || []).filter((r) => isUnknownProduct(r.product));
  const patch = {
    product,
    license_key: licenseKey,
    license_expires_at: licenseExpiresAt,
    username,
    status: "completed",
  };

  if (unknownRows.length) {
    for (const row of unknownRows) {
      const { error: upErr } = await supabase.from(table).update(patch).eq("order_id", row.order_id);
      if (upErr) {
        console.error("Update failed for", row.order_id, upErr.message);
        process.exit(1);
      }
      console.log("\nUpdated order", row.order_id, " -  replaced Unknown with Roblox Lifetime + new key.");
    }
    console.log("\nDone. Send the customer the license key above.");
    return;
  }

  console.log("\nNo row with product Unknown for this email.");

  if (!args.insertIfMissing) {
    console.log("(--no-insert: skipping new order.)");
    return;
  }

  const orderId = `ORD-MANUAL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const insertRow = {
    order_id: orderId,
    email,
    username,
    product,
    status: "completed",
    license_key: licenseKey,
    license_expires_at: licenseExpiresAt,
  };

  let { error: insErr } = await supabase.from(table).insert(insertRow);
  if (insErr && String(insErr.message || "").includes("license_expires_at")) {
    const { license_expires_at: _x, ...rest } = insertRow;
    ({ error: insErr } = await supabase.from(table).insert(rest));
  }
  if (insErr) {
    console.error("Insert failed:", insErr.message);
    process.exit(1);
  }

  console.log("\nInserted new order", orderId);
  console.log("Done. Send the customer the license key above.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
