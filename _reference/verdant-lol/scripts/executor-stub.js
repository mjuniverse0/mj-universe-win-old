#!/usr/bin/env node
/**
 * Minimal local executor daemon for testing Verdant's POST /execute proxy.
 *
 *   node scripts/executor-stub.js
 *   # default port 6969 - matches VERDANT_EXECUTOR_UPSTREAM / VERDANT_EXECUTOR_URL examples
 *
 * Endpoints:
 *   GET  /          → 200 text "ok"
 *   POST /execute   → 200, logs body length (replace with real Roblox bridge if you build one)
 */
const http = require("node:http");

const PORT = Number(process.env.EXECUTOR_STUB_PORT ?? process.env.PORT ?? 6969);

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0] || "/";

  if (req.method === "GET" && (url === "/" || url === "")) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && url === "/execute") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      console.log(`[executor-stub] POST /execute - ${body.length} bytes`);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
    });
    req.on("error", (err) => {
      console.error("[executor-stub]", err);
      res.writeHead(400);
      res.end();
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[executor-stub] listening on http://127.0.0.1:${PORT} (GET /, POST /execute)`);
});
