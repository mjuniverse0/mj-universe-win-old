#!/usr/bin/env node
/**
 * List all orders for an email (service role). Use for support when purchases "disappear".
 *
 *   node scripts/list-orders-by-email.js --email=mjuniverse0607@gmail.com
 */

require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TABLE = process.env.SUPABASE_ORDERS_TABLE ?? "orders";

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function parseEmail(argv) {
  for (const a of argv) {
    if (a.startsWith("--email=")) return normEmail(a.slice("--email=".length));
  }
  return "";
}

async function main() {
  const email = parseEmail(process.argv.slice(2));
  if (!email) {
    console.error('Usage: node scripts/list-orders-by-email.js --email=user@gmail.com');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from(TABLE).select("*").eq("email", email).order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`Orders for ${email}: ${(data || []).length} row(s)\n`);
  for (const row of data || []) {
    console.log(JSON.stringify(row, null, 2));
    console.log("---");
  }
}

main();
