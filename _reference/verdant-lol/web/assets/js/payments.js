const API_BASE =
  window.location.protocol === "file:"
    ? "http://localhost:8787"
    : window.location.origin;

async function getStripeConfig() {
  const res = await fetch(`${API_BASE}/api/stripe/config`);
  if (!res.ok) throw new Error(`Could not load Stripe config (${res.status})`);
  return res.json();
}

function getBuyerIdentity() {
  const email = (document.getElementById("buyer-email")?.value ?? "").trim().toLowerCase();
  const username = (document.getElementById("buyer-username")?.value ?? "").trim().toLowerCase();
  return { email, username };
}

function getCodes() {
  const promoCode = (document.getElementById("promo-code")?.value ?? "").trim().toUpperCase();
  const giftCardCode = (document.getElementById("gift-card-code")?.value ?? "")
    .trim()
    .toUpperCase();
  return { promoCode, giftCardCode };
}

function setPaymentMessage(text, ok = false) {
  const root = document.querySelector("[data-payments-message]");
  if (!root) return;
  root.textContent = text;
  root.style.color = ok ? "#bdfcc6" : "var(--muted)";
}

function setPaymentMessageHtml(html, ok = false) {
  const root = document.querySelector("[data-payments-message]");
  if (!root) return;
  root.innerHTML = html;
  root.style.color = ok ? "#bdfcc6" : "var(--muted)";
}

function formatUsd(value) {
  return `$${Number(value).toFixed(2)}`;
}

/** ISO 4217 for Stripe (e.g. USD, EUR). Use data-currency on a product card to offer MB WAY (must be eur). */
function getCheckoutCurrencyFromCard(card) {
  const raw = (card && card.getAttribute("data-currency")) || "";
  const c = String(raw).trim().toLowerCase();
  if (c === "eur" || c === "euro") return "EUR";
  if (c === "usd" || c === "dollar" || c === "") return "USD";
  if (c.length === 3) return c.toUpperCase();
  return "USD";
}

/**
 * Mirrors config/store-products.json - used when markup omits data-product-name/data-product.
 * Avoids posting product: "Unknown" so Stripe resolves a real catalog row.
 */
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

/** Matches config/store-products.json ids */
function getCardProductSpec(card) {
  const productId = (card.getAttribute("data-product-id") ?? "").trim();
  const productName = (card.getAttribute("data-product-name") ?? "").trim();
  const legacy = (card.getAttribute("data-product") ?? "").trim();
  const price = card.getAttribute("data-price") ?? "9.99";
  const fromId = productId ? SITE_PRODUCT_NAME_BY_PRODUCT_ID[productId] : "";
  return {
    productId,
    product:
      productName ||
      legacy ||
      fromId ||
      (productId ? productId.replace(/-/g, " ") : "Store item"),
    price,
  };
}

function paymentRequestBody(card, extra = {}) {
  const spec = getCardProductSpec(card);
  const body = {
    amount: spec.price,
    product: spec.product,
    ...extra,
  };
  if (spec.productId) body.productId = spec.productId;
  return body;
}

function giftCardRejectMessage(reason) {
  switch (reason) {
    case "not_found":
      return "That gift card code was not found. Check spelling, or ask support to activate the code in the store database.";
    case "redeemed":
      return "This gift card has already been fully used.";
    case "wrong_product":
      return "This gift card is locked to another product. Open the correct game's page, or leave the gift field empty and pay full price.";
    case "zero_balance":
      return "This gift card has no balance left.";
    default:
      return "";
  }
}

function humanizePaymentError(text) {
  if (typeof text !== "string" || !text) return text;
  if (text.includes("card_declined") || text.includes("Your card was declined")) {
    return `${text} - try another card or contact your bank.`;
  }
  return text;
}

function describeStripeErrorPayload(p) {
  if (p == null) return "";
  if (typeof p === "string") return p;
  if (typeof p !== "object") return String(p);
  if (p.message) return String(p.message);
  if (p.type) return String(p.type);
  return "";
}

function createCheckoutErrorMessage(json) {
  if (!json || typeof json !== "object") return "Could not start payment.";
  const p = json.stripe;
  if (p && typeof p === "object") {
    const d = describeStripeErrorPayload(p);
    if (d) {
      return humanizePaymentError(d);
    }
  }
  if (typeof json.error === "string" && json.error) {
    return humanizePaymentError(json.error);
  }
  if (json.error && typeof json.error === "object" && json.error.message) {
    return String(json.error.message);
  }
  if (typeof json.message === "string" && json.message) return json.message;
  if (json.customPayment && json.customPaymentUrl) {
    return "This order total is $0 with your code(s). We will open the confirmation page. If you wanted to pay full price, clear the optional promo and gift fields and use checkout again.";
  }
  return "Could not start payment. Check STRIPE_SECRET_KEY and that the site is served over HTTPS in production.";
}

function verifySessionErrorMessage(json) {
  if (!json || typeof json !== "object") return "Could not complete payment.";
  if (json.orderId) return "";
  if (typeof json.error === "string" && json.error) return humanizePaymentError(json.error);
  if (json.error && typeof json.error === "object") {
    return describeStripeErrorPayload(json.error) || "Could not complete payment.";
  }
  return "Could not complete payment.";
}

function getLivePriceElement(card) {
  const explicit = card.querySelector("[data-live-price]");
  if (explicit) return explicit;
  const chips = [...card.querySelectorAll(".chip")];
  return (
    chips.find((chip) => /\$\s*\d+(\.\d+)?/.test(chip.textContent ?? "")) ?? null
  );
}

function productImagePath(product = "") {
  const p = String(product).toLowerCase();
  if (p.includes("fort")) return "/assets/images/fortnite-product.png";
  if (p.includes("apex") || p.includes("r5")) return "/assets/images/apex-product.png";
  if (p.includes("forza") || p.includes("fh5") || p.includes("horizon 5"))
    return "/assets/images/fh5-product.png";
  if (p.includes("lifetime lite")) return "/assets/images/lifetime-lite-product.png";
  if (p.includes("lifetime plus") || p.includes("lifetime+")) return "/assets/images/lifetime-plus-product.png";
  if (p.includes("all products") || p.includes("all-access"))
    return "/assets/images/all-access-product.png";
  if (p.includes("roblox") || p.includes("rblx")) return "/assets/images/roblox-product.png";
  if (p.includes("cs2") || p.includes("counter")) return "/assets/images/cs2-product.png";
  return "/assets/images/all-access-product.png";
}

/** One canonical storefront image per catalog id prefix (matches config/store-products.json ids). */
const CATALOG_IMAGE_BY_PREFIX = [
  ["all-products-lifetime-lite", "/assets/images/lifetime-lite-product.png"],
  ["all-products-lifetime-plus", "/assets/images/lifetime-plus-product.png"],
  ["fortnite", "/assets/images/fortnite-product.png"],
  ["apex", "/assets/images/apex-product.png"],
  ["forza5", "/assets/images/fh5-product.png"],
  ["roblox", "/assets/images/roblox-product.png"],
  ["cs2", "/assets/images/cs2-product.png"],
];

function productImagePathFromId(productId = "") {
  const x = String(productId || "")
    .toLowerCase()
    .trim();
  if (!x) return "";
  for (const [prefix, url] of CATALOG_IMAGE_BY_PREFIX) {
    if (x === prefix || x.startsWith(`${prefix}-`)) return url;
  }
  return "/assets/images/all-access-product.png";
}

function applyProductImage(card) {
  const productId = String(card.getAttribute("data-product-id") ?? "").trim();
  const product =
    card.getAttribute("data-product-name") ?? card.getAttribute("data-product") ?? "";
  const explicitSrc = (card.getAttribute("data-product-image") ?? "").trim();
  let img = card.querySelector(".product-image");
  if (!img) {
    img = document.createElement("img");
    img.className = "product-image";
    img.alt = "Product image";
    card.insertBefore(img, card.firstChild);
  }

  let resolved = "";
  if (productId) {
    resolved = productImagePathFromId(productId);
  } else {
    resolved = explicitSrc || productImagePath(product) || "";
  }
  if (resolved) {
    img.src = resolved;
    img.decoding = "async";
  }
}

function getCustomLinkWrap(card) {
  let wrap = card.querySelector("[data-custom-link-wrap]");
  if (wrap) return wrap;
  wrap = document.createElement("div");
  wrap.setAttribute("data-custom-link-wrap", "1");
  wrap.style.marginTop = "10px";
  card.appendChild(wrap);
  return wrap;
}

function setCustomPaymentLink(card, url) {
  const wrap = getCustomLinkWrap(card);
  if (!url) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = `
    <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener noreferrer" style="width:100%">
      Open $0 confirmation link
    </a>
  `;
}

async function refreshLivePrices(cards) {
  const { promoCode, giftCardCode } = getCodes();
  const hasAnyCode = Boolean(promoCode || giftCardCode);
  await Promise.all(
    cards.map(async (card) => {
      const priceEl = getLivePriceElement(card);
      if (!priceEl) return;
      const spec = getCardProductSpec(card);
      const basePrice = Number(spec.price ?? "0");
      if (!hasAnyCode) {
        priceEl.textContent = formatUsd(basePrice);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/api/payments/preview-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            paymentRequestBody(card, {
              amount: String(basePrice),
              promoCode,
              giftCardCode,
            })
          ),
        });
        const json = await response.json();
        if (!response.ok || !Number.isFinite(Number(json.finalAmount))) {
          priceEl.textContent = formatUsd(basePrice);
          return;
        }
        const finalAmount = Number(json.finalAmount);
        const discount = Number(json.discountAmount ?? 0);
        card.dataset.customPaymentEligible = json.customPaymentEligible ? "1" : "0";
        priceEl.textContent =
          discount > 0
            ? `${formatUsd(finalAmount)} (was ${formatUsd(basePrice)})`
            : formatUsd(basePrice);
      } catch {
        card.dataset.customPaymentEligible = "0";
        priceEl.textContent = formatUsd(basePrice);
      }
    })
  );
}

async function buildDiscountPaymentLinks(cards) {
  const { email, username } = getBuyerIdentity();
  const { promoCode, giftCardCode } = getCodes();
  if (!email || !username) {
    setPaymentMessage("Fill email + username before applying discount links.");
    return;
  }
  if (!promoCode && !giftCardCode) {
    setPaymentMessage(
      "To build $0 payment links, enter an optional promo or gift code above, or use the checkout button to pay the list price (no code required)."
    );
    return;
  }

  let builtAnyCustom = false;
  for (const card of cards) {
    const spec = getCardProductSpec(card);
    const price = spec.price ?? "9.99";
    try {
      const previewRes = await fetch(`${API_BASE}/api/payments/preview-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          paymentRequestBody(card, {
            amount: price,
            promoCode,
            giftCardCode,
          })
        ),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) {
        setCustomPaymentLink(card, null);
        continue;
      }

      if (preview.customPaymentEligible) {
        const createRes = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            paymentRequestBody(card, {
              amount: price,
              currency: getCheckoutCurrencyFromCard(card),
              email,
              username,
              promoCode,
              giftCardCode,
            })
          ),
        });
        const createJson = await createRes.json();
        if (createRes.ok && createJson.customPaymentUrl) {
          setCustomPaymentLink(card, createJson.customPaymentUrl);
          builtAnyCustom = true;
        } else {
          setCustomPaymentLink(card, null);
        }
      } else {
        setCustomPaymentLink(card, null);
      }
    } catch {
      setCustomPaymentLink(card, null);
    }
  }

  if (builtAnyCustom) {
    setPaymentMessage("Custom $0 links are ready on eligible products. Click the button in the card.", true);
  } else {
    setPaymentMessage("Discount applied. Use checkout for products that are not fully covered to $0.", true);
  }
}

async function applyGiftcardAndRedirect(card) {
  const { email, username } = getBuyerIdentity();
  const { promoCode, giftCardCode } = getCodes();
  if (!email || !username) {
    setPaymentMessage("Fill email + username before applying gift card.");
    return;
  }
  if (!giftCardCode) {
    setPaymentMessage(
      "Enter a gift card code in the optional field, or use the main checkout button to pay the full price without a gift card."
    );
    return;
  }

  const spec = getCardProductSpec(card);
  const price = Number(spec.price ?? "9.99");

  let preview = null;
  try {
    const previewRes = await fetch(`${API_BASE}/api/payments/preview-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        paymentRequestBody(card, {
          amount: String(price),
          promoCode,
          giftCardCode,
        })
      ),
    });
    preview = await previewRes.json();
    if (!previewRes.ok) {
      setPaymentMessage(
        preview.error ?? "Discount preview failed. Backend seems outdated. Payment blocked for safety."
      );
      return;
    }
  } catch {
    setPaymentMessage(
      "Could not verify gift card / discount (preview failed). You can still pay the full price with checkout, or try again."
    );
    return;
  }

  if (!preview.giftCardApplied) {
    const specific = giftCardRejectMessage(preview.giftCardRejectReason);
    setPaymentMessage(
      specific ||
        "That gift card was not applied (invalid, wrong product, or zero balance). You can still pay the full price with checkout, or check the code in the gift field above."
    );
    return;
  }

  const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      paymentRequestBody(card, {
        amount: String(price),
        currency: getCheckoutCurrencyFromCard(card),
        email,
        username,
        promoCode,
        giftCardCode,
      })
    ),
  });
  const json = await response.json();
  if (!response.ok) {
    setPaymentMessage(json.error ?? "Could not apply gift card.");
    return;
  }

  if (json.customPayment && json.customPaymentUrl) {
    setPaymentMessage("Redirecting to $0 confirmation link...", true);
    window.location.href = json.customPaymentUrl;
    return;
  }
  if (preview.customPaymentEligible) {
    setPaymentMessage("Expected a $0 custom link, but the server did not return it. Check deployment and try again.");
    return;
  }
  if (json.url) {
    setPaymentMessage(`Redirecting to secure checkout (total ${formatUsd(preview.finalAmount)}).`, true);
    window.location.href = json.url;
    return;
  }

  setPaymentMessage("Payment link could not be generated.");
}

function redirectToPaymentSuccess({
  orderId,
  licenseKey,
  product,
  productId,
  remainingGiftCardBalance,
}) {
  const u = new URL("payment-success.html", window.location.href);
  u.searchParams.set("orderId", orderId);
  u.searchParams.set("licenseKey", licenseKey ?? "");
  u.searchParams.set("product", product);
  if (productId && String(productId).trim()) {
    u.searchParams.set("productId", String(productId).trim());
  }
  if (remainingGiftCardBalance !== null && remainingGiftCardBalance !== undefined) {
    u.searchParams.set("giftRemaining", String(remainingGiftCardBalance));
  }
  window.location.replace(u.pathname + u.search);
}

async function startCheckoutForCard(card) {
  const { email, username } = getBuyerIdentity();
  const { promoCode, giftCardCode } = getCodes();
  if (!email || !username) {
    setPaymentMessage("Fill email + username before purchase.");
    return;
  }
  const spec = getCardProductSpec(card);
  const price = spec.price ?? "9.99";
  setPaymentMessage("Starting secure checkout...", true);
  const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      paymentRequestBody(card, {
        amount: price,
        currency: getCheckoutCurrencyFromCard(card),
        email,
        username,
        promoCode,
        giftCardCode,
      })
    ),
  });
  let json;
  try {
    json = await response.json();
  } catch {
    json = {};
  }
  if (json.customPayment && json.customPaymentUrl) {
    setPaymentMessage("Order total is $0 with your codes. Redirecting...", true);
    window.location.replace(json.customPaymentUrl);
    return;
  }
  if (!response.ok || !json.url) {
    const msg = createCheckoutErrorMessage(json);
    setPaymentMessage(msg);
    return;
  }
  window.location.href = json.url;
}

function mountCheckoutButton(mount, card) {
  mount.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary";
  btn.style.width = "100%";
  btn.style.marginTop = "4px";
  btn.textContent = "Pay with card (Stripe)";
  btn.addEventListener("click", async () => {
    try {
      await startCheckoutForCard(card);
    } catch (e) {
      setPaymentMessage(e.message || "Checkout failed.");
    }
  });
  mount.appendChild(btn);
}

async function renderButtons() {
  const cards = [...document.querySelectorAll("[data-product-card]")];
  cards.forEach((card) => applyProductImage(card));

  cards.forEach((card) => {
    const redeemBtn = card.querySelector("[data-gift-redeem]");
    if (!redeemBtn || redeemBtn.dataset.bound === "1") return;
    redeemBtn.dataset.bound = "1";
    redeemBtn.textContent = "Apply Gift Card (Auto Redirect)";
    redeemBtn.addEventListener("click", async () => {
      try {
        await applyGiftcardAndRedirect(card);
      } catch (error) {
        setPaymentMessage(`Gift card apply failed: ${error.message}`);
      }
    });
  });

  const promoInput = document.getElementById("promo-code");
  const giftInput = document.getElementById("gift-card-code");
  let priceTimer = null;
  const schedulePriceRefresh = () => {
    if (priceTimer) window.clearTimeout(priceTimer);
    priceTimer = window.setTimeout(() => {
      refreshLivePrices(cards).catch(() => null);
    }, 220);
  };
  if (promoInput) promoInput.addEventListener("input", schedulePriceRefresh);
  if (giftInput) giftInput.addEventListener("input", schedulePriceRefresh);
  await refreshLivePrices(cards);

  const config = await getStripeConfig();
  if (!config.enabled) {
    setPaymentMessage("Stripe is not configured yet (STRIPE_SECRET_KEY).");
    return;
  }

  cards.forEach((card) => {
    const mount = card.querySelector("[data-stripe-button]");
    if (!mount) return;
    mountCheckoutButton(mount, card);
  });
}

renderButtons().catch((err) => {
  const hint =
    window.location.protocol === "file:"
      ? " Start backend with: npm run start:web and open http://localhost:8787/products.html"
      : "";
  setPaymentMessage(`Payments unavailable: ${err.message}.${hint}`);
});
