/**
 * Persisted payment/ops alerts for the shop dashboard (admin-only API).
 * JSON file on disk - set VERDANT_NOTIFICATIONS_FILE to override path.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_ITEMS = 100;

function storePath() {
  return (
    process.env.VERDANT_NOTIFICATIONS_FILE || path.join(process.cwd(), "data", "verdant-notifications.json")
  );
}

function readAll() {
  const p = storePath();
  try {
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(items.slice(0, MAX_ITEMS), null, 2), "utf8");
}

/**
 * Skip duplicate alerts with same dedupeKey within windowMs (default 15 min).
 */
function append(item, opts = {}) {
  const { dedupeKey, windowMs = 15 * 60 * 1000 } = opts;
  if (dedupeKey) {
    const cutoff = Date.now() - windowMs;
    const existing = readAll();
    const dup = existing.some(
      (x) =>
        x.dedupeKey === dedupeKey &&
        x.createdAt &&
        new Date(x.createdAt).getTime() > cutoff
    );
    if (dup) return null;
  }
  const row = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
    ...item,
    ...(dedupeKey ? { dedupeKey } : {}),
  };
  const all = readAll();
  all.unshift(row);
  writeAll(all);
  return row;
}

function markRead(id) {
  const all = readAll();
  const hit = all.find((x) => x.id === id);
  if (hit) hit.read = true;
  writeAll(all);
  return Boolean(hit);
}

function markAllRead() {
  const all = readAll().map((x) => ({ ...x, read: true }));
  writeAll(all);
}

module.exports = {
  readAll,
  append,
  markRead,
  markAllRead,
};
