/**
 * Maps catalog products to artwork under web/assets/images (never the site logo).
 * Stripe Checkout / Payment Links need absolute https URLs.
 */
const { loadStoreCatalogSync, normalizeCatalogName } = require("./storeCatalog");

/** Generic multi-game bundle card - only used when text cannot be matched (not logo.png). */
const FALLBACK_PRODUCT_IMAGE = "/assets/images/all-access-product.png";

function normalizeImageFilename(ref) {
  const s = String(ref || "").trim();
  if (!s) return "";
  const base = s.replace(/^\.?\/?assets\/images\/?/, "").replace(/^\/+/, "").replace(/^images\/?/, "");
  return `/assets/images/${base}`;
}

/** Prefix inference when catalog row has no image field (legacy). */
function inferImagePathFromProductId(productId) {
  const x = String(productId || "").toLowerCase();
  if (!x) return "";
  if (x.startsWith("all-products-lifetime-lite")) return "/assets/images/lifetime-lite-product.png";
  if (x.startsWith("all-products-lifetime-plus")) return "/assets/images/lifetime-plus-product.png";
  if (x.startsWith("fortnite")) return "/assets/images/fortnite-product.png";
  if (x.startsWith("apex")) return "/assets/images/apex-product.png";
  if (x.startsWith("forza5")) return "/assets/images/fh5-product.png";
  if (x.startsWith("roblox")) return "/assets/images/roblox-product.png";
  if (x.startsWith("cs2")) return "/assets/images/cs2-product.png";
  return "";
}

function storefrontImagePathFromProductId(productId) {
  const catalog = loadStoreCatalogSync();
  const row = catalog.byId[String(productId || "").trim()];
  if (row?.image) return normalizeImageFilename(row.image);
  const inferred = inferImagePathFromProductId(productId);
  if (inferred) return inferred;
  return "";
}

function storefrontImagePathFromSiteProductName(name) {
  const catalog = loadStoreCatalogSync();
  const hit = catalog.byName[normalizeCatalogName(name)];
  if (hit?.image) return normalizeImageFilename(hit.image);
  if (hit?.id) {
    const p = storefrontImagePathFromProductId(hit.id);
    if (p) return p;
  }

  const slug = String(name || "").toLowerCase();
  if (slug.includes("lifetime plus")) return "/assets/images/lifetime-plus-product.png";
  if (slug.includes("lifetime lite")) return "/assets/images/lifetime-lite-product.png";
  if (slug.includes("fort")) return "/assets/images/fortnite-product.png";
  if (slug.includes("apex") || slug.includes("r5")) return "/assets/images/apex-product.png";
  if (slug.includes("forza") || slug.includes("fh5") || slug.includes("horizon 5"))
    return "/assets/images/fh5-product.png";
  if (slug.includes("roblox") || slug.includes("rblx")) return "/assets/images/roblox-product.png";
  if (slug.includes("cs2") || slug.includes("counter")) return "/assets/images/cs2-product.png";
  if (slug.includes("all products") || slug.includes("all-access"))
    return "/assets/images/all-access-product.png";

  return FALLBACK_PRODUCT_IMAGE;
}

/** Checkout-only artwork (e.g. wide hero banner) when set on the catalog row. */
function storefrontStripeCheckoutImagePath(productId, siteProductName) {
  const catalog = loadStoreCatalogSync();
  const pid = String(productId || "").trim();
  if (pid) {
    const row = catalog.byId[pid];
    if (row?.stripeCheckoutImage) return normalizeImageFilename(row.stripeCheckoutImage);
  }
  if (siteProductName) {
    const hit = catalog.byName[normalizeCatalogName(siteProductName)];
    if (hit?.stripeCheckoutImage) return normalizeImageFilename(hit.stripeCheckoutImage);
  }
  return "";
}

/** @returns {string[]} Stripe allows multiple; we attach one artwork URL per line item */
function absoluteStorefrontImageUrls(baseUrl, productId, siteProductName) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  let rel = storefrontStripeCheckoutImagePath(productId, siteProductName);
  if (!rel) rel = storefrontImagePathFromProductId(productId);
  if (!rel && siteProductName) rel = storefrontImagePathFromSiteProductName(siteProductName);
  if (!rel) rel = FALLBACK_PRODUCT_IMAGE;
  const path = rel.startsWith("/") ? rel : `/${rel}`;
  return [`${base}${path}`];
}

module.exports = {
  storefrontImagePathFromProductId,
  storefrontImagePathFromSiteProductName,
  storefrontStripeCheckoutImagePath,
  absoluteStorefrontImageUrls,
};
