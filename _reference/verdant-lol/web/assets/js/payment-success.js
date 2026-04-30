(function () {
  /** Fallback if ?product=Unknown or truncated; mirrors config/store-products.json */
  const SITE_PRODUCT_NAME_BY_PRODUCT_ID = {
    "all-products-lifetime-plus": "All Products Lifetime Plus Key",
    "all-products-lifetime-lite": "All Products Lifetime Lite Key",
    "fortnite-7d": "Fortnite 7 Days Key",
    "fortnite-30d": "Fortnite Monthly Key",
    "fortnite-life": "Fortnite Lifetime Key",
    "apex-7d": "Apex Legends 7 Days Key",
    "apex-30d": "Apex Legends Monthly Key",
    "apex-life": "Apex Legends Lifetime Key",
    "roblox-7d": "Roblox 7 Days Key",
    "roblox-30d": "Roblox Monthly Key",
    "roblox-life": "Roblox Lifetime Key",
    "cs2-7d": "CS2 7 Days Key",
    "cs2-30d": "CS2 Monthly Key",
    "cs2-life": "CS2 Lifetime Key",
    "forza5-7d": "Forza Horizon 5 7 Days Key",
    "forza5-30d": "Forza Horizon 5 Monthly Key",
    "forza5-life": "Forza Horizon 5 Lifetime Key",
  };

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId");
  const licenseKey = params.get("licenseKey");
  const giftRemaining = params.get("giftRemaining");

  let product = (params.get("product") || "").trim();
  const productIdHint = (params.get("productId") || "").trim();
  if (/^unknown$/i.test(product)) product = "";
  if (!product && productIdHint && SITE_PRODUCT_NAME_BY_PRODUCT_ID[productIdHint]) {
    product = SITE_PRODUCT_NAME_BY_PRODUCT_ID[productIdHint];
  }

  const details = document.querySelector("[data-success-details]");
  const rows = document.querySelector("[data-success-rows]");
  const intro = document.querySelector("[data-success-intro]");
  const fallback = document.querySelector("[data-success-fallback]");

  if (!orderId || !product) {
    if (details) details.style.display = "none";
    if (intro) intro.style.display = "none";
    if (fallback) fallback.style.display = "block";
    return;
  }

  if (details) details.style.display = "block";
  if (rows) {
    const lines = [
      ["Product", product],
      ["Order ID", orderId],
      ["License key", licenseKey && licenseKey.length ? licenseKey : "N/A"],
    ];
    if (giftRemaining && giftRemaining.length) {
      lines.push([
        "Gift card remaining",
        Number.isFinite(Number(giftRemaining)) ? `$${Number(giftRemaining).toFixed(2)}` : giftRemaining,
      ]);
    }
    rows.innerHTML = lines
      .map(
        ([k, v]) =>
          `<div class="row" style="margin-bottom:8px"><strong style="color:#a9a9a9">${k}:</strong> <span data-copyable>${v}</span></div>`
      )
      .join("");
  }
})();
