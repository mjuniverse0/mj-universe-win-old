/**
 * License duration inferred from storefront product titles (matches web data-product strings).
 * null duration = no expiry (lifetime / all-access lifetime tiers).
 */

function productSlug(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** @returns {number|null} Days until expiry from purchase moment; null = never expires */
function inferLicenseDurationDays(product = "") {
  const p = productSlug(product);
  if (!p) return null;
  if (p.includes("lifetime") || p.includes("all products lifetime")) return null;
  if (p.includes("7 days") || p.includes("7 day")) return 7;
  if (p.includes("monthly")) return 30;
  return null;
}

/** ISO timestamp for DB, or null if lifetime */
function computeLicenseExpiresAtIso(product, purchaseDate = new Date()) {
  const days = inferLicenseDurationDays(product);
  if (days == null) return null;
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(purchaseDate.getTime() + ms).toISOString();
}

module.exports = {
  inferLicenseDurationDays,
  computeLicenseExpiresAtIso,
  productSlug,
};
