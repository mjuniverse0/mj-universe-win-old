/**
 * Canonical storefront catalog (config/store-products.json).
 * Used to resolve data-product-id → display name, list price, and Stripe metadata.
 */
const fs = require("node:fs");
const path = require("node:path");

let cache = null;

function normalizeCatalogName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function loadStoreCatalogSync() {
  if (cache) return cache;
  const jsonPath = path.join(__dirname, "..", "config", "store-products.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const byId = Object.create(null);
  const byName = Object.create(null);
  for (const item of raw.items) {
    if (!item.id) continue;
    byId[item.id] = item;
    byName[normalizeCatalogName(item.siteProductName)] = item;
  }
  cache = {
    currency: raw.currency || "usd",
    items: raw.items,
    byId,
    byName,
  };
  return cache;
}

/**
 * @param {{ productId?: string, product?: string }} body
 * @returns {{ productId: string, siteProductName: string, listUsd: number|null, durationDays: number|null }}
 */
function resolveProductFromRequest(body) {
  const catalog = loadStoreCatalogSync();
  const pid = String(body?.productId ?? "").trim();
  if (pid) {
    const row = catalog.byId[pid];
    if (!row) {
      throw new Error(`Unknown productId: ${pid}`);
    }
    return {
      productId: pid,
      siteProductName: row.siteProductName,
      listUsd: Number(row.usd),
      durationDays: row.durationDays === undefined ? null : row.durationDays,
    };
  }
  const legacy = String(body?.product ?? "").trim();
  if (!legacy) {
    throw new Error("productId or product is required");
  }
  const hit = catalog.byName[normalizeCatalogName(legacy)];
  if (hit && hit.id) {
    return {
      productId: hit.id,
      siteProductName: hit.siteProductName,
      listUsd: Number(hit.usd),
      durationDays: hit.durationDays === undefined ? null : hit.durationDays,
    };
  }
  return {
    productId: "",
    siteProductName: legacy,
    listUsd: null,
    durationDays: null,
  };
}

module.exports = {
  loadStoreCatalogSync,
  resolveProductFromRequest,
  normalizeCatalogName,
};
