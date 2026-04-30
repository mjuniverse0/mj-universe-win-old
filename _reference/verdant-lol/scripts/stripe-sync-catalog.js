/**
 * Syncs Stripe Products (with images), Prices, and Payment Links from config/store-products.json.
 * Upserts by metadata product_id - safe to run multiple times (updates images / reuses matching price).
 *
 *   node scripts/stripe-sync-catalog.js
 *
 * Requires STRIPE_SECRET_KEY. Uses PUBLIC_APP_URL for image URLs (default https://verdant.lol).
 * Output: config/stripe-sync-output.json (gitignored).
 */
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const Stripe = require("stripe");

const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(ROOT, "config", "store-products.json");
const OUT = path.join(ROOT, "config", "stripe-sync-output.json");
const { absoluteStorefrontImageUrls } = require(path.join(ROOT, "lib", "storefrontImageUrl.js"));

async function findProductByCatalogId(stripe, catalogId) {
  let starting_after;
  for (;;) {
    const page = await stripe.products.list({ limit: 100, starting_after });
    const hit = page.data.find((p) => p.metadata?.product_id === catalogId);
    if (hit) return hit;
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return null;
}

async function findMatchingOneTimePrice(stripe, productId, unitCents, currency) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return (
    prices.data.find(
      (p) =>
        p.unit_amount === unitCents &&
        p.currency === currency &&
        p.type === "one_time" &&
        !p.recurring
    ) || null
  );
}

function loadPreviousOutput() {
  try {
    const raw = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const map = Object.create(null);
    for (const row of raw.items || []) {
      if (row.productId) map[row.productId] = row;
    }
    return { generatedAt: raw.generatedAt, itemsByProductId: map };
  } catch {
    return { itemsByProductId: Object.create(null) };
  }
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Missing STRIPE_SECRET_KEY");
    process.exit(1);
  }
  const stripe = new Stripe(key);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const currency = (manifest.currency || "usd").toLowerCase();
  const baseUrl = (process.env.PUBLIC_APP_URL || "https://verdant.lol").replace(/\/$/, "");

  const { itemsByProductId: prevById } = loadPreviousOutput();
  const results = [];

  for (const item of manifest.items) {
    if (!item.id) {
      console.warn("Skip item without id:", item.siteProductName);
      continue;
    }
    const name = item.siteProductName;
    const unitCents = Math.round(Number(item.usd) * 100);
    if (!Number.isFinite(unitCents) || unitCents < 1) {
      console.warn("Skip invalid amount:", name);
      continue;
    }

    const durationMeta =
      item.durationDays === null || item.durationDays === undefined
        ? "lifetime"
        : String(item.durationDays);

    const images = absoluteStorefrontImageUrls(baseUrl, item.id, name);
    const meta = {
      site_product: name,
      product_id: item.id,
      duration_days: durationMeta,
    };

    let product = await findProductByCatalogId(stripe, item.id);
    if (product) {
      product = await stripe.products.update(product.id, {
        name,
        images,
        metadata: meta,
      });
      console.log("Updated product:", name, product.id);
    } else {
      product = await stripe.products.create({
        name,
        images,
        metadata: meta,
      });
      console.log("Created product:", name, product.id);
    }

    let price = await findMatchingOneTimePrice(stripe, product.id, unitCents, currency);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: unitCents,
        currency,
      });
      console.log("Created price:", price.id, unitCents, currency);
    }

    const prev = prevById[item.id];
    let paymentLinkUrl = "";
    let paymentLinkId = "";

    if (prev?.paymentLinkId && prev?.stripePriceId === price.id) {
      try {
        const pl = await stripe.paymentLinks.retrieve(prev.paymentLinkId);
        if (pl.active) {
          paymentLinkUrl = pl.url;
          paymentLinkId = pl.id;
          console.log("Reuse payment link:", name, paymentLinkUrl);
        }
      } catch {
        /* create new */
      }
    }

    if (!paymentLinkUrl) {
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          product: name,
          site_product: name,
          product_id: item.id,
        },
        after_completion: {
          type: "redirect",
          redirect: {
            url: `${baseUrl}/payment-return.html?session_id={CHECKOUT_SESSION_ID}`,
          },
        },
      });
      paymentLinkUrl = paymentLink.url;
      paymentLinkId = paymentLink.id;
      console.log("Created payment link:", name, "→", paymentLinkUrl);
    }

    results.push({
      productId: item.id,
      siteProductName: name,
      usd: item.usd,
      durationDays: item.durationDays,
      stripeProductId: product.id,
      stripePriceId: price.id,
      paymentLinkUrl,
      paymentLinkId,
    });
  }

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), currency, items: results }, null, 2));
  console.log("\nWrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
