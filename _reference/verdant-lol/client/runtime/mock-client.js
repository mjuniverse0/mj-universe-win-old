const product = process.env.VERDANT_PRODUCT ?? "Unknown";
const key = process.env.VERDANT_KEY ?? "N/A";
const profile = process.env.VERDANT_PROFILE ?? "Default";

console.log("Verdant client runtime booting...");
console.log(`Product: ${product}`);
console.log(`Profile: ${profile}`);
console.log(`License: ${key.slice(0, 6)}***`);
console.log("Runtime status: connected");

let tick = 0;
const timer = setInterval(() => {
  tick += 1;
  console.log(`Heartbeat ${tick}: input layer active`);
}, 2500);

process.on("SIGTERM", () => {
  clearInterval(timer);
  console.log("Runtime status: stopping (SIGTERM)");
  process.exit(0);
});

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("Runtime status: stopping (SIGINT)");
  process.exit(0);
});
