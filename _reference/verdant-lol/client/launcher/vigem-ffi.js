/**
 * Verdant remap engine via koffi (FFI) + ViGEmClient.dll (no separate C++ exe).
 * Requires ViGEmBus + ViGEmClient.dll on PATH or VIGEM_CLIENT_DLL / bundled path.
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const XUSB = {
  DPAD_UP: 0x0001,
  DPAD_DOWN: 0x0002,
  DPAD_LEFT: 0x0004,
  DPAD_RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LEFT_THUMB: 0x0040,
  RIGHT_THUMB: 0x0080,
  LB: 0x0100,
  RB: 0x0200,
  A: 0x1000,
  B: 0x2000,
  X: 0x4000,
  Y: 0x8000,
};

const VK = {
  END: 0x23,
  INSERT: 0x2d,
  SHIFT: 0x10,
  LSHIFT: 0xa0,
  RSHIFT: 0xa1,
  CONTROL: 0x11,
  LCONTROL: 0xa2,
  RCONTROL: 0xa3,
  SPACE: 0x20,
  TAB: 0x09,
  RETURN: 0x0d,
  LBUTTON: 0x01,
  RBUTTON: 0x02,
  UP: 0x26,
  DOWN: 0x28,
  LEFT: 0x25,
  RIGHT: 0x27,
  A: 0x41,
  D: 0x44,
  E: 0x45,
  F: 0x46,
  G: 0x47,
  Q: 0x51,
  R: 0x52,
  S: 0x53,
  W: 0x57,
  /** Top-row digits (Aura Emerald: 1/2 → LB/RB) */
  N1: 0x31,
  N2: 0x32,
  C: 0x43,
  X: 0x58,
  V: 0x56,
};

function isKoffiAvailable() {
  try {
    require("koffi");
    return true;
  } catch {
    return false;
  }
}

/** @returns {string[]} absolute paths, ordered by preference */
function listVigemClientDllCandidates() {
  const out = [];
  const add = (p) => {
    if (!p) return;
    const abs = path.isAbsolute(p) ? path.normalize(p) : path.resolve(p);
    if (!out.includes(abs)) out.push(abs);
  };
  if (process.env.VIGEM_CLIENT_DLL) {
    add(process.env.VIGEM_CLIENT_DLL);
  }
  add(path.join(__dirname, "vigem", "ViGEmClient.dll"));
  add(path.join(__dirname, "..", "vigem", "ViGEmClient.dll"));
  add(path.join(process.cwd(), "ViGEmClient.dll"));
  add(path.join(os.homedir(), "vigem", "ViGEmClient.dll"));
  if (process.env.LOCALAPPDATA) {
    add(path.join(process.env.LOCALAPPDATA, "vigem", "ViGEmClient.dll"));
  }
  for (const root of [process.env.ProgramW6432, process.env["ProgramFiles(x86)"], process.env.ProgramFiles]) {
    if (!root) continue;
    add(path.join(root, "Nefarius Software Solutions", "ViGEm", "ViGEmClient.dll"));
    add(path.join(root, "Nefarius Software Solutions", "ViGEmBus", "ViGEmClient.dll"));
  }
  if (fs.existsSync("C:\\Program Files\\Nefarius Software Solutions")) {
    const base = "C:\\Program Files\\Nefarius Software Solutions";
    try {
      for (const name of fs.readdirSync(base, { withFileTypes: true })) {
        if (name.isDirectory()) {
          const p = path.join(base, name.name, "ViGEmClient.dll");
          if (fs.existsSync(p)) add(p);
        }
      }
    } catch {
      // ignore
    }
  }
  add("ViGEmClient.dll");
  return out;
}

/**
 * @returns {string | null} absolute path to the DLL, or null if not found
 */
function findVigemClientDll() {
  for (const p of listVigemClientDllCandidates()) {
    if (p.endsWith("ViGEmClient.dll") && fs.existsSync(p)) {
      return path.isAbsolute(p) ? path.normalize(p) : path.resolve(p);
    }
  }
  return null;
}

function prependPathWithDllDir(dllFileAbs) {
  const dir = path.dirname(dllFileAbs);
  if (!dir || dir === ".") return;
  const sep = path.delimiter;
  const cur = process.env.PATH || "";
  const parts = cur.split(sep).map((s) => s.toLowerCase());
  if (parts.includes(dir.toLowerCase())) return;
  process.env.PATH = `${dir}${sep}${cur}`;
}

/** Koffi struct names are global - use unique names and register only once per process. */
let koffiTypesRegistered = false;
/** @type {{ GetCursorPos: Function, GetAsyncKeyState: Function } | null} */
let cachedUser32Api = null;
/** @type {Map<string, object>} */
const cachedVigemApiByDll = new Map();

function ensureKoffiTypes(koffi) {
  if (koffiTypesRegistered) return;
  koffi.struct("VerdantPOINT", { x: "long", y: "long" });
  koffi.struct("VerdantXUSB_REPORT", {
    wButtons: "uint16",
    bLeftTrigger: "uint8",
    bRightTrigger: "uint8",
    sThumbLX: "int16",
    sThumbLY: "int16",
    sThumbRX: "int16",
    sThumbRY: "int16",
  });
  koffiTypesRegistered = true;
}

function getUser32Api(koffi) {
  if (cachedUser32Api) return cachedUser32Api;
  ensureKoffiTypes(koffi);
  const user32 = koffi.load("user32.dll");
  const GetCursorPos = user32.func("int __stdcall GetCursorPos(_Out_ VerdantPOINT *pos)");
  const GetAsyncKeyState = user32.func("int16 __stdcall GetAsyncKeyState(int nVirtKey)");
  cachedUser32Api = { GetCursorPos, GetAsyncKeyState };
  return cachedUser32Api;
}

function getVigemApi(koffi, absDllPath) {
  if (cachedVigemApiByDll.has(absDllPath)) {
    return cachedVigemApiByDll.get(absDllPath);
  }
  ensureKoffiTypes(koffi);
  const vigem = koffi.load(absDllPath);
  const api = {
    vigem_alloc: vigem.func("void * vigem_alloc(void)"),
    vigem_free: vigem.func("void vigem_free(void *arg1)"),
    vigem_connect: vigem.func("uint32 __stdcall vigem_connect(void *arg1)"),
    vigem_disconnect: vigem.func("void vigem_disconnect(void *arg1)"),
    vigem_target_x360_alloc: vigem.func("void * vigem_target_x360_alloc(void)"),
    vigem_target_free: vigem.func("void vigem_target_free(void *arg1)"),
    vigem_target_add: vigem.func("uint32 __stdcall vigem_target_add(void *a, void *b)"),
    vigem_target_remove: vigem.func("void vigem_target_remove(void *a, void *b)"),
    vigem_target_x360_update: vigem.func(
      "uint32 __stdcall vigem_target_x360_update(void *c, void *t, VerdantXUSB_REPORT r)"
    ),
  };
  cachedVigemApiByDll.set(absDllPath, api);
  return api;
}

function isVigemOk(code) {
  const u = Number(code) >>> 0;
  return u === 0 || u === 0x20000000;
}

function floatToStick(v) {
  const t = Math.max(-1, Math.min(1, v));
  return Math.max(-32767, Math.min(32767, Math.round(t * 32767)));
}

/**
 * Comma-separated exe base names, e.g. `FortniteClient-Win64-Shipping.exe` or `r5apex.exe` (Apex).
 * When `VERDANT_FOCUS_EXES` is unset, `fallbackWhenEnvEmpty` applies (e.g. Roblox → RobloxPlayerBeta.exe).
 */
function parseVerdantFocusExes(fallbackWhenEnvEmpty = "") {
  const hasEnv = Object.prototype.hasOwnProperty.call(process.env, "VERDANT_FOCUS_EXES");
  const env = String(process.env.VERDANT_FOCUS_EXES ?? "").trim();
  const raw = hasEnv ? env : String(fallbackWhenEnvEmpty || "").trim();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.includes("/") || s.includes("\\") ? path.basename(s).toLowerCase() : s));
}

/**
 * @param {import("koffi")} koffi
 * @param {(s: string) => void} onLog
 * @returns {() => boolean}
 */
function makeFocusExeMatcher(koffi, onLog, fallbackWhenEnvEmpty = "") {
  const want = parseVerdantFocusExes(fallbackWhenEnvEmpty);
  if (want.length === 0) {
    return () => true;
  }
  onLog(`[FFI] Fokus-sjekk: krever aktivt vindu fra én av: ${want.join(", ")}`);

  let user32;
  let kernel32;
  let GetForegroundWindow;
  let GetWindowThreadProcessId;
  let OpenProcess;
  let QueryFullProcessImageNameW;
  let CloseHandle;
  let loaded = false;
  try {
    user32 = koffi.load("user32.dll");
    kernel32 = koffi.load("kernel32.dll");
    GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow(void)");
    GetWindowThreadProcessId = user32.func(
      "uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *pidOut)"
    );
    OpenProcess = kernel32.func("void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)");
    QueryFullProcessImageNameW = kernel32.func(
      "int32_t __stdcall QueryFullProcessImageNameW(void *h, uint32_t flags, _Out_ void *buf, _Inout_ uint32 *nChars)"
    );
    CloseHandle = kernel32.func("int32_t __stdcall CloseHandle(void *h)");
    loaded = true;
  } catch (e) {
    onLog(`[FFI] Fokus-sjekk: kunne ikke laste API (${e?.message ?? e}) - ignorerer filter.`);
    return () => true;
  }
  const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

  let lastOk = true;
  let lastT = 0;
  return function isForegroundInList() {
    if (!loaded) return true;
    const now = Date.now();
    if (now - lastT < 90) {
      return lastOk;
    }
    lastT = now;
    lastOk = false;
    try {
      const hwnd = GetForegroundWindow();
      if (!hwnd || (typeof hwnd === "bigint" && hwnd === 0n)) {
        return lastOk;
      }
      const ptr = [0];
      GetWindowThreadProcessId(hwnd, ptr);
      const pid = Number(ptr[0] || 0);
      if (!pid) {
        return lastOk;
      }
      const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
      if (!h || (typeof h === "bigint" && h === 0n)) {
        return lastOk;
      }
      try {
        const buf = Buffer.alloc(1024, 0);
        const nChars = [buf.length / 2];
        const okQ = QueryFullProcessImageNameW(h, 0, buf, nChars);
        if (!okQ) {
          return lastOk;
        }
        const n = Math.min(512, Number(nChars[0] || 0));
        const full = buf.toString("utf16le", 0, n * 2).replace(/\0/g, "");
        const base = path.basename(full).toLowerCase();
        lastOk = want.some(
          (w) => w === base || w === full.toLowerCase() || full.toLowerCase().endsWith("\\" + w)
        );
        return lastOk;
      } finally {
        try {
          CloseHandle(h);
        } catch {
          // ignore
        }
      }
    } catch {
      return false;
    }
  };
}

/**
 * @param {object} opts
 * @param {number} opts.deadzone
 * @param {number} opts.sensitivity
 * @param {number} opts.responseCurve
 * @param {(s: string) => void} [opts.onLog]
 * @param {() => void} [opts.onExit]
 * @param {(remapOn: boolean) => void} [opts.onRemapState] when Insert toggles - toast only
 * @param {(captureOn: boolean) => void} [opts.onInputCapture] kbd+mouse unmap to games (true when Insert on && focus exes)
 * @param {() => { dx: number; dy: number }} [opts.getMouseDelta] WH_MOUSE_LL deltas when unmap works
 * @param {() => boolean} [opts.getMouseUnmapFailed] if true, fall back to GetCursorPos for look
 * @returns {{ ok: true, stop: () => void } | { ok: false, error: string }}
 */
function startVigemEngine(opts) {
  const onLog = typeof opts.onLog === "function" ? opts.onLog : () => {};
  const onExit = typeof opts.onExit === "function" ? opts.onExit : () => {};
  const onRemapState = typeof opts.onRemapState === "function" ? opts.onRemapState : () => {};
  const onInputCapture = typeof opts.onInputCapture === "function" ? opts.onInputCapture : () => {};
  const getMouseDelta = typeof opts.getMouseDelta === "function" ? opts.getMouseDelta : null;
  const getMouseUnmapFailed = typeof opts.getMouseUnmapFailed === "function" ? opts.getMouseUnmapFailed : () => true;

  if (process.platform !== "win32") {
    return { ok: false, error: "ViGEm FFI engine is Windows only." };
  }
  if (!isKoffiAvailable()) {
    return { ok: false, error: "koffi is not installed." };
  }

  const koffi = require("koffi");
  const foundDll = findVigemClientDll();
  if (!foundDll) {
    return {
      ok: false,
      error: `ViGEmClient.dll not found. Put it in client/launcher/vigem/ or set VIGEM_CLIENT_DLL to the full path. Get the SDK: https://github.com/nefarius/ViGEmClient/releases (copy the whole bin/ folder, not only one file). Also install Microsoft Visual C++ 2015-2022 (x64).`,
    };
  }
  prependPathWithDllDir(foundDll);

  let GetCursorPos;
  let GetAsyncKeyState;
  try {
    const u = getUser32Api(koffi);
    GetCursorPos = u.GetCursorPos;
    GetAsyncKeyState = u.GetAsyncKeyState;
  } catch (e) {
    return { ok: false, error: `user32: ${e.message}` };
  }

  let vigem_alloc;
  let vigem_free;
  let vigem_connect;
  let vigem_disconnect;
  let vigem_target_x360_alloc;
  let vigem_target_free;
  let vigem_target_add;
  let vigem_target_remove;
  let vigem_target_x360_update;
  try {
    const vg = getVigemApi(koffi, foundDll);
    vigem_alloc = vg.vigem_alloc;
    vigem_free = vg.vigem_free;
    vigem_connect = vg.vigem_connect;
    vigem_disconnect = vg.vigem_disconnect;
    vigem_target_x360_alloc = vg.vigem_target_x360_alloc;
    vigem_target_free = vg.vigem_target_free;
    vigem_target_add = vg.vigem_target_add;
    vigem_target_remove = vg.vigem_target_remove;
    vigem_target_x360_update = vg.vigem_target_x360_update;
  } catch (e) {
    const msg = e?.message ?? String(e);
    return {
      ok: false,
      error: `LoadLibrary failed for ${foundDll} (${msg}). If the file exists, Windows often means a missing *dependency* of that DLL. Copy all files from the ViGEmClient release bin/ into client/launcher/vigem/ next to ViGEmClient.dll, and install the VC++ x64 redist. See https://github.com/nefarius/ViGEmClient/releases`,
    };
  }

  const deadzone = Math.min(0.4, Math.max(0, Number(opts.deadzone) || 0.08));
  const mouseSensitivity = Math.min(6, Math.max(0.1, Number(opts.sensitivity) || 1));
  const responseCurve = Math.min(4, Math.max(0.5, Number(opts.responseCurve) || 1.2));
  const gameProfile = String(opts.profileName || "").toLowerCase();
  const productLower = String(opts.product || "").toLowerCase();
  /* Roblox-licenser skal alltid bruke Rivals-layout; profil kan være endret uten "rivals" i navnet. */
  const isRivals =
    gameProfile.includes("rivals") || productLower.includes("roblox");

  const client = vigem_alloc();
  if (!client) {
    return { ok: false, error: "vigem_alloc() returned null." };
  }

  const cr = vigem_connect(client);
  if (!isVigemOk(cr)) {
    onLog(`[FFI] vigem_connect failed: 0x${(cr >>> 0).toString(16)}`);
    try {
      vigem_free(client);
    } catch {
      // ignore
    }
    return { ok: false, error: "ViGEm bus not reachable. Is ViGEmBus installed and running?" };
  }

  const pad = vigem_target_x360_alloc();
  if (!pad) {
    onLog("[FFI] vigem_target_x360_alloc returned null.");
    try {
      vigem_disconnect(client);
    } catch {
      // ignore
    }
    try {
      vigem_free(client);
    } catch {
      // ignore
    }
    return { ok: false, error: "Could not allocate X360 target." };
  }

  const ar = vigem_target_add(client, pad);
  if (!isVigemOk(ar)) {
    onLog(`[FFI] vigem_target_add failed: 0x${(ar >>> 0).toString(16)}`);
    try {
      vigem_target_free(pad);
    } catch {
      // ignore
    }
    try {
      vigem_disconnect(client);
    } catch {
      // ignore
    }
    try {
      vigem_free(client);
    } catch {
      // ignore
    }
    return { ok: false, error: "Could not add virtual Xbox 360 device." };
  }

  onLog(isRivals
    ? "[FFI] Profil: Roblox Rivals (Aura Emerald). ALLTID PÅ. WASD venstre stick, mus høyre, 1/2 bumpere, Q/X/C/V/F D-pad, E tilbake, Shift L3. END eller Stop stopper."
    : "[FFI] Profil: Standard - mus → høyre stick, WASD, INSERT av/på, END = stopp.");
  onLog(
    "[FFI] reWASD-lignende: når «capture» er PÅ, svelges fysisk kbd+mus til andre apper. VERDANT_INPUT_HOOK=0 = ingen hook."
  );
  onLog(
    "[FFI] Fokus: standard er ALLTID PÅ (alle vinduer). Sett VERDANT_FOCUS_EXES=RobloxPlayerBeta.exe i .env kun hvis du vil begrense til spillvinduet."
  );
  onLog(`[FFI] Tuning: deadzone=${deadzone} sensitivity=${mouseSensitivity} curve=${responseCurve}`);

  /* Ingen automatisk Roblox-fokus: det blokkerte mapping fra Remap/launcher mens du justerer. */
  const matchFocus = makeFocusExeMatcher(koffi, onLog, "");
  const focusExesNonEmpty = parseVerdantFocusExes("").length > 0;
  let lastInputCapture = null;
  let lastFocusWarn = 0;

  function effectiveCapture() {
    if (!remapActive) return false;
    return matchFocus();
  }

  function syncInputCapture() {
    const c = effectiveCapture();
    if (c !== lastInputCapture) {
      lastInputCapture = c;
      onInputCapture(c);
    }
  }

  const report = { wButtons: 0, bLeftTrigger: 0, bRightTrigger: 0, sThumbLX: 0, sThumbLY: 0, sThumbRX: 0, sThumbRY: 0 };
  const debugFfi = String(process.env.VERDANT_FFI_DEBUG || "").toLowerCase() === "1";
  let lastDebugLog = 0;

  let prevX = 0;
  let prevY = 0;
  const posInit = {};
  try {
    if (GetCursorPos(posInit)) {
      prevX = posInit.x;
      prevY = posInit.y;
    }
  } catch {
    // leave 0,0
  }

  function keyDown(vk) {
    try {
      return (GetAsyncKeyState(vk) & 0x8000) !== 0;
    } catch {
      return false;
    }
  }

  /** Win32: VK_SHIFT/VK_CONTROL er upålitelige; bruk venstre/høyre. */
  function keyShiftDown() {
    return keyDown(VK.LSHIFT) || keyDown(VK.RSHIFT);
  }
  function keyCtrlDown() {
    return keyDown(VK.LCONTROL) || keyDown(VK.RCONTROL);
  }

  let interval = null;
  let stopped = false;
  let remapActive = true;
  let prevIns = false;

  function applyNeutral() {
    report.sThumbLX = 0;
    report.sThumbLY = 0;
    report.sThumbRX = 0;
    report.sThumbRY = 0;
    report.wButtons = 0;
    report.bLeftTrigger = 0;
    report.bRightTrigger = 0;
  }

  function tick() {
    if (stopped) return;
    if (keyDown(VK.END)) {
      stopInternal();
      return;
    }

    if (isRivals) {
      // Rivals: always on - INSERT has no effect, only END or UI stop can quit
      remapActive = true;
    } else {
      const insNow = keyDown(VK.INSERT);
      if (insNow && !prevIns) {
        remapActive = !remapActive;
        onRemapState(remapActive);
      }
      prevIns = insNow;
    }
    syncInputCapture();

    if (!remapActive) {
      if (getMouseDelta) {
        getMouseDelta();
      }
      const m0 = {};
      try {
        if (GetCursorPos(m0)) {
          prevX = m0.x;
          prevY = m0.y;
        }
      } catch {
        // keep prevX/Y
      }
      applyNeutral();
      try {
        const ur = vigem_target_x360_update(client, pad, report);
        if (debugFfi) {
          const t = Date.now();
          if (t - lastDebugLog > 2000) {
            lastDebugLog = t;
            onLog("[FFI:debug] remap OFF - neutral");
          }
        }
        if (!isVigemOk(ur) && Math.random() < 0.02) {
          onLog(`[FFI] vigem_target_x360_update warning: 0x${(ur >>> 0).toString(16)}`);
        }
      } catch (e) {
        onLog(`[FFI] update error: ${e.message}`);
        stopInternal();
      }
      return;
    }

    if (!effectiveCapture()) {
      if (focusExesNonEmpty) {
        const t = Date.now();
        if (t - lastFocusWarn > 8000) {
          lastFocusWarn = t;
          onLog(
            "[FFI] Ingen stick mot spillet nå: VERDANT_FOCUS_EXES matcher ikke forgrunnsvinduet. Fokuser spillet, eller fjern variabelen for alltid-på."
          );
        }
      }
      if (getMouseDelta) {
        getMouseDelta();
      }
      const m0 = {};
      try {
        if (GetCursorPos(m0)) {
          prevX = m0.x;
          prevY = m0.y;
        }
      } catch {
        // ignore
      }
      applyNeutral();
      try {
        vigem_target_x360_update(client, pad, report);
      } catch (e) {
        onLog(`[FFI] update error: ${e.message}`);
        stopInternal();
      }
      return;
    }

    /* Venstre stick: alltid WASD (alle profiler, inkl. Rivals / Aura). Kjøres før knappelogikk under. */
    let lx = 0;
    let ly = 0;
    if (keyDown(VK.A)) lx -= 1;
    if (keyDown(VK.D)) lx += 1;
    if (keyDown(VK.W)) ly += 1;
    if (keyDown(VK.S)) ly -= 1;
    if (lx !== 0 && ly !== 0) {
      lx *= 0.7071067;
      ly *= 0.7071067;
    }
    report.sThumbLX = floatToStick(lx);
    report.sThumbLY = floatToStick(ly);

    let dx = 0;
    let dy = 0;
    const unmapFailed = getMouseUnmapFailed();
    if (getMouseDelta && !unmapFailed) {
      const d = getMouseDelta();
      dx = d.dx;
      dy = d.dy;
    } else {
      const m = {};
      try {
        if (GetCursorPos(m)) {
          dx = m.x - prevX;
          dy = m.y - prevY;
          prevX = m.x;
          prevY = m.y;
        }
      } catch {
        // one failed read
      }
    }

    let rx = Math.max(-1, Math.min(1, dx * 0.016 * mouseSensitivity));
    let ry = Math.max(-1, Math.min(1, -dy * 0.016 * mouseSensitivity));
    const mag = Math.sqrt(rx * rx + ry * ry);
    if (mag < deadzone) {
      rx = 0;
      ry = 0;
    } else if (mag > 0.0001) {
      const curved = Math.min(1, mag) ** responseCurve;
      rx = (rx / mag) * curved;
      ry = (ry / mag) * curved;
    }
    report.sThumbRX = floatToStick(rx);
    report.sThumbRY = floatToStick(ry);

    report.wButtons = 0;
    report.bLeftTrigger = 0;
    report.bRightTrigger = 0;
    if (isRivals) {
      /*
       * Roblox - «Aura Emerald» (reWASD masks 30-46, 48-49): Rivals-optimalisert tast→pad.
       * 1/2→LB/RB, Q↓ X↑ C↓ V→ F←, E→Back, R→X, Ctrl→B, G→Y, Space→A, Shift→L3, LMB/RMB→RT/LT.
       * Tab veksler lag i reWASD - ikke mappet hit (unngå feil inndata).
       */
      if (keyDown(VK.N1)) report.wButtons |= XUSB.LB;
      if (keyDown(VK.N2)) report.wButtons |= XUSB.RB;
      if (keyDown(VK.Q)) report.wButtons |= XUSB.DPAD_DOWN;
      if (keyDown(VK.X)) report.wButtons |= XUSB.DPAD_UP;
      if (keyDown(VK.C)) report.wButtons |= XUSB.DPAD_DOWN;
      if (keyDown(VK.V)) report.wButtons |= XUSB.DPAD_RIGHT;
      if (keyDown(VK.F)) report.wButtons |= XUSB.DPAD_LEFT;
      if (keyDown(VK.E)) report.wButtons |= XUSB.BACK;
      if (keyDown(VK.R)) report.wButtons |= XUSB.X;
      if (keyCtrlDown()) report.wButtons |= XUSB.B;
      if (keyDown(VK.G)) report.wButtons |= XUSB.Y;
      if (keyDown(VK.SPACE)) report.wButtons |= XUSB.A;
      if (keyShiftDown()) report.wButtons |= XUSB.LEFT_THUMB;
      if (keyDown(VK.LBUTTON)) report.bRightTrigger = 255;
      if (keyDown(VK.RBUTTON)) report.bLeftTrigger = 255;
    } else {
      // Standard / Fortnite bindings
      if (keyDown(VK.SPACE))   report.wButtons |= XUSB.A;
      if (keyShiftDown())      report.wButtons |= XUSB.B;
      if (keyCtrlDown())       report.wButtons |= XUSB.X;
      if (keyDown(VK.E))       report.wButtons |= XUSB.Y;
      if (keyDown(VK.Q))       report.wButtons |= XUSB.LB;
      if (keyDown(VK.R))       report.wButtons |= XUSB.RB;
      if (keyDown(VK.TAB))     report.wButtons |= XUSB.BACK;
      if (keyDown(VK.RETURN))  report.wButtons |= XUSB.START;
      if (keyDown(VK.UP))      report.wButtons |= XUSB.DPAD_UP;
      if (keyDown(VK.DOWN))    report.wButtons |= XUSB.DPAD_DOWN;
      if (keyDown(VK.LEFT))    report.wButtons |= XUSB.DPAD_LEFT;
      if (keyDown(VK.RIGHT))   report.wButtons |= XUSB.DPAD_RIGHT;
      if (keyDown(VK.LBUTTON)) report.bRightTrigger = 255;
      if (keyDown(VK.RBUTTON)) report.bLeftTrigger = 255;
    }

    try {
      const ur = vigem_target_x360_update(client, pad, report);
      if (debugFfi) {
        const t = Date.now();
        if (t - lastDebugLog > 2000) {
          lastDebugLog = t;
          onLog(
            `[FFI:debug] L ${report.sThumbLX},${report.sThumbLY}  R ${report.sThumbRX},${report.sThumbRY}  btns=0x${(report.wButtons & 0xffff).toString(16)}`
          );
        }
      }
      if (!isVigemOk(ur) && Math.random() < 0.02) {
        onLog(`[FFI] vigem_target_x360_update warning: 0x${(ur >>> 0).toString(16)}`);
      }
    } catch (e) {
      onLog(`[FFI] update error: ${e.message}`);
      stopInternal();
    }
  }

  function cleanup() {
    try {
      vigem_target_remove(client, pad);
    } catch (e) {
      onLog(`[FFI] target_remove: ${e.message}`);
    }
    try {
      vigem_target_free(pad);
    } catch (e) {
      onLog(`[FFI] target_free: ${e.message}`);
    }
    try {
      vigem_disconnect(client);
    } catch (e) {
      onLog(`[FFI] disconnect: ${e.message}`);
    }
    try {
      vigem_free(client);
    } catch (e) {
      onLog(`[FFI] free: ${e.message}`);
    }
  }

  function stopInternal() {
    if (stopped) return;
    stopped = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    cleanup();
    onLog("[FFI] Remap engine stopped.");
    onExit();
  }

  function stop() {
    stopInternal();
  }

  interval = setInterval(tick, 4);
  return { ok: true, stop };
}

module.exports = {
  isKoffiAvailable,
  startVigemEngine,
  findVigemClientDll,
  listVigemClientDllCandidates,
};
