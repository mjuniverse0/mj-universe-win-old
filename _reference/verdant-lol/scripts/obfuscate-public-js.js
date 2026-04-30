/**
 * Obfuscates selected browser JS under web/assets/js → web/assets/js-obfuscated/
 * Client-side obfuscation only deters casual reading; it does not secure secrets.
 *
 *   npm run build:obfuscate-web
 *
 * Deploy: point static hosting at js-obfuscated or replace files intentionally after backup.
 */
const fs = require("node:fs");
const path = require("node:path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "web", "assets", "js");
const OUT_DIR = path.join(ROOT, "web", "assets", "js-obfuscated");

const FILES = [
  "main.js",
  "payments.js",
  "dashboard.js",
  "notifications-bell.js",
  "client-area.js",
  "client-data.js",
  "client-pages.js",
  "autologin.js",
];

const OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: "function",
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const file of FILES) {
    const from = path.join(SRC_DIR, file);
    if (!fs.existsSync(from)) {
      console.warn("Skip missing:", from);
      continue;
    }
    const code = fs.readFileSync(from, "utf8");
    const out = JavaScriptObfuscator.obfuscate(code, OPTIONS).getObfuscatedCode();
    fs.writeFileSync(path.join(OUT_DIR, file), out);
    console.log("Obfuscated:", file);
  }
  console.log("Output:", OUT_DIR);
}

main();
