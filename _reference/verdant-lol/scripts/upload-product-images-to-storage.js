/**
 * Optional: upload web/assets/images/*-product.png to Supabase Storage bucket "product-images".
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (or env).
 * Site can keep serving static /assets/images/; this is for public CDN URLs if you want them in DB.
 */
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "product-images";
const IMAGES = path.join(__dirname, "..", "web", "assets", "images");

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      "Skip: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to upload to Storage. Static files remain in web/assets/images/."
    );
    process.exit(0);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (bucketErr && !String(bucketErr.message).includes("already exists")) {
    console.error("createBucket:", bucketErr.message);
    process.exit(1);
  }

  const files = fs
    .readdirSync(IMAGES)
    .filter((n) => n.endsWith("-product.png") && n.includes("product"));

  for (const name of files) {
    const p = path.join(IMAGES, name);
    const buf = fs.readFileSync(p);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(name, buf, { contentType: "image/png", upsert: true });
    if (upErr) {
      console.error("upload", name, upErr.message);
      process.exit(1);
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(name);
    console.log(name, "->", pub.publicUrl);
  }
  console.log("Done. Public URLs are under", `${url}/storage/v1/object/public/${BUCKET}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
