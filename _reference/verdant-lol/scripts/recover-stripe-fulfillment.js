/**
 * Emergency: fulfill a paid Stripe Checkout session from CLI (e.g. webhook missed).
 *
 *   node scripts/recover-stripe-fulfillment.js --session=cs_...
 *   node scripts/recover-stripe-fulfillment.js --pi=pi_...
 *
 * Requires STRIPE_SECRET_KEY in .env
 */
require("dotenv").config();

const Stripe = require("stripe");

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Missing STRIPE_SECRET_KEY");
    process.exit(1);
  }
  const stripe = new Stripe(key);

  let sessionId = "";
  let piArg = "";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--session=")) sessionId = a.slice("--session=".length).trim();
    if (a.startsWith("--pi=")) piArg = a.slice("--pi=".length).trim();
  }

  if (!sessionId && !piArg) {
    console.error("Usage: node scripts/recover-stripe-fulfillment.js --session=cs_... | --pi=pi_...");
    process.exit(1);
  }

  let sid = sessionId;
  if (!sid && piArg) {
    const list = await stripe.checkout.sessions.list({ payment_intent: piArg, limit: 5 });
    if (!list.data.length) {
      console.error("No Checkout Session found for this PaymentIntent.");
      process.exit(1);
    }
    sid = list.data[0].id;
    console.log("Resolved session:", sid);
  }

  const base = String(process.env.PUBLIC_APP_URL || `http://127.0.0.1:${process.env.WEB_PORT ?? 8787}`).replace(
    /\/$/,
    ""
  );
  const res = await fetch(`${base}/api/stripe/verify-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid }),
    });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Fulfillment failed:", json.error || res.statusText);
    process.exit(1);
  }
  console.log("OK:", JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
