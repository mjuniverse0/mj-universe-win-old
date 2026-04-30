#!/usr/bin/env node
/**
 * Verdant executor daemon.
 *
 * Replaces scripts/executor-stub.js as the upstream behind
 * `${LAUNCHER_API_BASE}/api/executor/*` (which server.js proxies to
 * VERDANT_EXECUTOR_UPSTREAM, default http://127.0.0.1:6969).
 *
 * Purpose
 *   The launcher posts Lua / rblxscripts payloads to verdant.lol; this
 *   daemon enqueues them per-HWID. A local C++ agent
 *   (client/executor/verdant_executor.exe) long-polls /pull?hwid=X to fetch
 *   the next script and runs it locally against Roblox via the kernel
 *   driver bridge. /ack reports execution outcome back.
 *
 *   Without a local agent the daemon still accepts uploads so the editor
 *   round-trip works; jobs simply stay queued (or expire) until an agent
 *   connects.
 *
 * Endpoints
 *   GET  /                     -> 200 "ok"
 *   GET  /health               -> 200 JSON {ok, queues:{[hwid]:size}, agents, uptimeMs}
 *   POST /execute              -> 200 JSON {ok, queued, queue_id, queue_size}
 *                                 Body: text/plain Lua, OR application/json
 *                                       {script, type?:"lua"|"rblxscript", hwid?, name?}
 *                                 Headers: X-Verdant-HWID, X-Verdant-License,
 *                                          X-Verdant-Author
 *   GET  /pull?hwid=X[&wait=N] -> Long-poll up to N seconds (default 25, max 55).
 *                                 200 JSON job on delivery, 204 on timeout.
 *   POST /ack                  -> 200 {ok}.  Body JSON {queue_id, hwid,
 *                                 success:bool, output?, error?}
 *
 * Configuration
 *   EXECUTOR_DAEMON_PORT  (default 6969)
 *   EXECUTOR_QUEUE_LIMIT  (per-HWID cap, default 50)
 *   EXECUTOR_JOB_TTL_MS   (drop unclaimed jobs older than this; default 1h)
 */

const http = require("node:http");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.EXECUTOR_DAEMON_PORT ?? process.env.PORT ?? 6969);
const QUEUE_LIMIT = Number(process.env.EXECUTOR_QUEUE_LIMIT ?? 50);
const JOB_TTL_MS = Number(process.env.EXECUTOR_JOB_TTL_MS ?? 60 * 60 * 1000);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_HWID = "broadcast";

const startedAt = Date.now();

/** @type {Map<string, Array<Job>>} */
const queues = new Map();
/** @type {Map<string, Set<{resolve: (j: Job|null) => void, timer: NodeJS.Timeout}>>} */
const waiters = new Map();
/** @type {Map<string, number>} agent hwid -> last seen ms */
const agentsSeen = new Map();

/**
 * @typedef {Object} Job
 * @property {string} queue_id
 * @property {string} hwid
 * @property {string} type
 * @property {string} script
 * @property {string=} name
 * @property {string=} license
 * @property {string=} author
 * @property {number} enqueued_at
 */

function newQueueId() {
  return crypto.randomUUID();
}

function getQueue(hwid) {
  let q = queues.get(hwid);
  if (!q) {
    q = [];
    queues.set(hwid, q);
  }
  return q;
}

function pruneExpired() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [hwid, q] of queues) {
    while (q.length && q[0].enqueued_at < cutoff) q.shift();
    if (q.length === 0) queues.delete(hwid);
  }
}
setInterval(pruneExpired, 60 * 1000).unref();

function notifyWaiters(hwid) {
  const set = waiters.get(hwid);
  if (!set || set.size === 0) return;
  const q = queues.get(hwid);
  if (!q || q.length === 0) return;
  const job = q.shift();
  if (q.length === 0) queues.delete(hwid);
  const w = set.values().next().value;
  set.delete(w);
  clearTimeout(w.timer);
  w.resolve(job);
}

function enqueue(job) {
  const q = getQueue(job.hwid);
  q.push(job);
  while (q.length > QUEUE_LIMIT) q.shift();
  notifyWaiters(job.hwid);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function jsonResponse(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function textResponse(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

async function handleExecute(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return jsonResponse(res, 413, { ok: false, error: e.message });
  }
  let script = body;
  let type = "lua";
  let name;
  let hwid =
    String(req.headers["x-verdant-hwid"] ?? "").trim() || DEFAULT_HWID;
  const license = String(req.headers["x-verdant-license"] ?? "").trim();
  const author = String(req.headers["x-verdant-author"] ?? "").trim();

  const ct = String(req.headers["content-type"] ?? "");
  if (ct.includes("application/json")) {
    try {
      const j = JSON.parse(body);
      if (typeof j.script === "string") script = j.script;
      else if (typeof j.code === "string") script = j.code;
      if (typeof j.type === "string") type = j.type;
      if (typeof j.name === "string") name = j.name;
      if (typeof j.hwid === "string" && j.hwid.trim()) hwid = j.hwid.trim();
    } catch {
      // treat raw body as script
    }
  }

  if (!script || typeof script !== "string") {
    return jsonResponse(res, 400, { ok: false, error: "Empty script." });
  }
  if (script.length > MAX_BODY_BYTES) {
    return jsonResponse(res, 413, { ok: false, error: "Script too large." });
  }

  const job = {
    queue_id: newQueueId(),
    hwid,
    type,
    script,
    name,
    license: license || undefined,
    author: author || undefined,
    enqueued_at: Date.now(),
  };
  enqueue(job);
  jsonResponse(res, 200, {
    ok: true,
    queued: true,
    queue_id: job.queue_id,
    queue_size: (queues.get(hwid)?.length ?? 0),
    agents_listening: (waiters.get(hwid)?.size ?? 0),
  });
  console.log(
    `[executor] enqueue hwid=${hwid.slice(0, 16)} type=${type} bytes=${script.length} id=${job.queue_id}`
  );
}

function handlePull(req, urlObj, res) {
  const hwid = String(urlObj.searchParams.get("hwid") ?? "").trim();
  if (!hwid) return jsonResponse(res, 400, { ok: false, error: "Missing ?hwid=" });
  agentsSeen.set(hwid, Date.now());

  const q = queues.get(hwid);
  if (q && q.length > 0) {
    const job = q.shift();
    if (q.length === 0) queues.delete(hwid);
    return jsonResponse(res, 200, job);
  }
  // No job: long-poll.
  const wait = Math.max(
    1,
    Math.min(55, Number(urlObj.searchParams.get("wait") ?? 25) || 25)
  );
  const set = waiters.get(hwid) ?? new Set();
  if (!waiters.has(hwid)) waiters.set(hwid, set);
  const waiter = {
    resolve: (job) => {
      if (res.writableEnded) return;
      if (job) {
        jsonResponse(res, 200, job);
      } else {
        res.writeHead(204);
        res.end();
      }
    },
    timer: null,
  };
  waiter.timer = setTimeout(() => {
    set.delete(waiter);
    if (set.size === 0) waiters.delete(hwid);
    waiter.resolve(null);
  }, wait * 1000);
  set.add(waiter);

  req.on("close", () => {
    clearTimeout(waiter.timer);
    set.delete(waiter);
    if (set.size === 0) waiters.delete(hwid);
  });
}

async function handleAck(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return jsonResponse(res, 413, { ok: false, error: e.message });
  }
  let payload = {};
  try {
    payload = JSON.parse(body || "{}");
  } catch {
    // ignore
  }
  console.log(
    `[executor] ack id=${payload.queue_id ?? "?"} hwid=${(payload.hwid ?? "").slice(0, 16)} success=${payload.success === true} ${
      payload.error ? `error="${String(payload.error).slice(0, 120)}"` : ""
    }`
  );
  return jsonResponse(res, 200, { ok: true });
}

function handleHealth(_req, res) {
  const queueSizes = {};
  for (const [hwid, q] of queues) queueSizes[hwid] = q.length;
  const agents = {};
  const cutoff = Date.now() - 60 * 1000;
  for (const [hwid, lastSeen] of agentsSeen) {
    if (lastSeen >= cutoff) agents[hwid] = lastSeen;
  }
  jsonResponse(res, 200, {
    ok: true,
    server: "verdant-executor",
    uptimeMs: Date.now() - startedAt,
    queues: queueSizes,
    agents,
    waiters: Object.fromEntries(
      Array.from(waiters.entries()).map(([h, s]) => [h, s.size])
    ),
  });
}

const server = http.createServer((req, res) => {
  let urlObj;
  try {
    urlObj = new URL(req.url, "http://127.0.0.1");
  } catch {
    return textResponse(res, 400, "bad url");
  }
  const pathname = urlObj.pathname;

  if (req.method === "GET" && (pathname === "/" || pathname === "")) {
    return textResponse(res, 200, "ok");
  }
  if (req.method === "GET" && pathname === "/health") {
    return handleHealth(req, res);
  }
  if (req.method === "POST" && pathname === "/execute") {
    return handleExecute(req, res);
  }
  if (req.method === "GET" && pathname === "/pull") {
    return handlePull(req, urlObj, res);
  }
  if (req.method === "POST" && pathname === "/ack") {
    return handleAck(req, res);
  }
  textResponse(res, 404, "not found");
});

server.requestTimeout = 0;
server.headersTimeout = 65 * 1000;
server.keepAliveTimeout = 65 * 1000;

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[executor] listening on http://127.0.0.1:${PORT} (GET /, /health, POST /execute, GET /pull?hwid=, POST /ack)`
  );
});

const shutdown = (sig) => {
  console.log(`[executor] ${sig} - shutting down`);
  for (const set of waiters.values()) {
    for (const w of set) {
      clearTimeout(w.timer);
      w.resolve(null);
    }
  }
  waiters.clear();
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
