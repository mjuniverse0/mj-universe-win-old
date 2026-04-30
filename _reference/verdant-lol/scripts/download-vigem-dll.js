/**
 * Re-download x64 ViGEmClient.dll into client/launcher/vigem/
 * Source: jangxx/node-ViGEmClient (same binary as common Node bindings use)
 */
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const url =
  "https://raw.githubusercontent.com/jangxx/node-ViGEmClient/master/native/x64/ViGEmClient.dll";
const out = path.join(__dirname, "..", "client", "launcher", "vigem", "ViGEmClient.dll");

fs.mkdirSync(path.dirname(out), { recursive: true });

https
  .get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error("HTTP", res.statusCode);
      process.exit(1);
    }
    const f = fs.createWriteStream(out);
    res.pipe(f);
    f.on("finish", () => {
      f.close();
      console.log("Wrote", out, fs.statSync(out).size, "bytes");
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  });
