/**
 * Spawns the low-level keyboard + mouse hook worker. Muted = capture on (reWASD unmap).
 */
const path = require("node:path");
const { Worker } = require("node:worker_threads");

/**
 * @param {{ onLog?: (s: string) => void }} opts
 * @returns {{
 *   setCaptureActive: (yn: boolean) => void;
 *   setBlockActive: (yn: boolean) => void;
 *   drainMouseDelta: () => { dx: number; dy: number };
 *   getMouseUnmapFailed: () => boolean;
 *   stop: (cb?: () => void) => void;
 * }}
 */
function startLowLevelKeyboardBlock(opts) {
  const onLog = typeof opts.onLog === "function" ? opts.onLog : () => {};
  const acc = { dx: 0, dy: 0 };
  /** true until started + WH_MOUSE_LL ok: use GetCursorPos; false = use hook deltas only (cursor does not move when muted). */
  let mouseUnmapFailed = true;

  if (process.env.VERDANT_INPUT_HOOK === "0") {
    onLog("[FFI] Input hook: off (VERDANT_INPUT_HOOK=0).");
    return {
      setCaptureActive: () => {},
      setBlockActive: () => {},
      drainMouseDelta: () => ({ dx: 0, dy: 0 }),
      getMouseUnmapFailed: () => true,
      stop: () => {},
    };
  }
  if (process.platform !== "win32") {
    return {
      setCaptureActive: () => {},
      setBlockActive: () => {},
      drainMouseDelta: () => ({ dx: 0, dy: 0 }),
      getMouseUnmapFailed: () => true,
      stop: () => {},
    };
  }
  const workerPath = path.join(__dirname, "ll-kb-hook-worker.js");
  let w;
  try {
    w = new Worker(workerPath, { type: "commonjs" });
  } catch (e) {
    onLog(`[input-hook] could not start worker: ${e?.message ?? e}`);
    return {
      setCaptureActive: () => {},
      setBlockActive: () => {},
      drainMouseDelta: () => ({ dx: 0, dy: 0 }),
      getMouseUnmapFailed: () => true,
      stop: () => {},
    };
  }
  w.on("message", (m) => {
    if (m && m.t === "log" && m.text) onLog(m.text);
    if (m && m.t === "md" && typeof m.dx === "number" && typeof m.dy === "number") {
      acc.dx += m.dx;
      acc.dy += m.dy;
    }
    if (m && m.t === "started") {
      if (m.mouseHook === false) {
        mouseUnmapFailed = true;
      } else {
        mouseUnmapFailed = false;
      }
    }
  });
  w.on("error", (e) => onLog(`[input-hook] ${e?.message ?? e}`));
  let startVkeys = undefined;
  if (opts.remapVkeys) startVkeys = opts.remapVkeys;
  w.postMessage({ cmd: "start", vkeys: startVkeys });
  return {
    setCaptureActive: (yn) => {
      try {
        w.postMessage({ cmd: "setCapture", value: !!yn });
      } catch (e) {
        onLog(`[input-hook] setCapture: ${e?.message ?? e}`);
      }
    },
    setBlockActive: (yn) => {
      try {
        w.postMessage({ cmd: "setCapture", value: !!yn });
      } catch (e) {
        onLog(`[input-hook] setBlock: ${e?.message ?? e}`);
      }
    },
    setRemapVkeys: (vkeys) => {
      try {
        w.postMessage({ cmd: "setRemapVkeys", vkeys });
      } catch (e) {
        onLog(`[input-hook] setRemapVkeys: ${e?.message ?? e}`);
      }
    },
    drainMouseDelta: () => {
      const o = { dx: acc.dx, dy: acc.dy };
      acc.dx = 0;
      acc.dy = 0;
      return o;
    },
    getMouseUnmapFailed: () => mouseUnmapFailed,
    stop: (cb) => {
      try {
        w.postMessage({ cmd: "stop" });
      } catch (e) {
        onLog(`[input-hook] stop: ${e?.message ?? e}`);
      }
      setTimeout(() => {
        try {
          w.terminate();
        } catch {
          // ignore
        }
        if (typeof cb === "function") cb();
      }, 200);
    },
  };
}

module.exports = { startLowLevelKeyboardBlock };
