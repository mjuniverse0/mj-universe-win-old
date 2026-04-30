/**
 * Windows WH_KEYBOARD_LL + WH_MOUSE_LL in a Node worker (same message pump as before).
 * When capture is on: remapped VKeys, mouse move deltas → parent, and LMB/RMB are swallowed for other apps.
 * INJECTED input passes through. END key passes. Physical mouse state still queryable (GetAsyncKeyState) in the main process.
 */
const { parentPort } = require("node:worker_threads");
const koffi = require("koffi");

const WH_KEYBOARD_LL = 13;
const WH_MOUSE_LL = 14;
const PM_REMOVE = 0x0001;
const LLKHF_INJECTED = 0x10;
const LLMHF_INJECTED = 0x01;

const WM_MOUSEMOVE = 0x0200;
const WM_LBUTTONDOWN = 0x0201;
const WM_LBUTTONUP = 0x0202;
const WM_RBUTTONDOWN = 0x0204;
const WM_RBUTTONUP = 0x0205;

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

koffi.alias("LRESULT", "intptr");
koffi.alias("HHOOK", "void *");
koffi.alias("HINSTANCE", "void *");
koffi.alias("HWND", "void *");

koffi.struct("VerdantHookKbdLow", {
  vkCode: "uint32",
  scanCode: "uint32",
  flags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr",
});

// MSLLHOOKSTRUCT (Win64): POINT (LONG x,y), DWORDs, then padding before ULONG_PTR at 8-byte align
koffi.struct("VerdantHookMousLow", {
  x: "int32",
  y: "int32",
  mouseData: "uint32",
  flags: "uint32",
  time: "uint32",
  _padAlign: "uint32",
  dwExtraInfo: "uintptr",
});

koffi.struct("VerdantHookPoint", { x: "long", y: "long" });

koffi.struct("VerdantHookMsg", {
  hwnd: "uintptr",
  message: "uint32",
  wParam: "uintptr",
  lParam: "intptr",
  time: "uint32",
  pt: "VerdantHookPoint",
});

// Same C signature for WH_KEYBOARD_LL and WH_MOUSE_LL hook procs; one proto keeps SetWindowsHookExW happy.
const LlkProto = koffi.proto("LRESULT __stdcall VerdantLlkProc(int nCode, uintptr wParam, intptr lParam)");

const SetWindowsHookExW = user32.func(
  "HHOOK __stdcall SetWindowsHookExW(int idHook, VerdantLlkProc *lpfn, HINSTANCE hMod, uint32_t dwThreadId)"
);
const UnhookWindowsHookEx = user32.func("bool __stdcall UnhookWindowsHookEx(HHOOK hhk)");
const CallNextHookEx = user32.func(
  "LRESULT __stdcall CallNextHookEx(HHOOK hhk, int nCode, uintptr wParam, intptr lParam)"
);
const GetModuleHandleW = kernel32.func("HINSTANCE __stdcall GetModuleHandleW(const uint16 *lpModuleName)");
const PeekMessageW = user32.func(
  "int32_t __stdcall PeekMessageW(_Out_ VerdantHookMsg *lpMsg, HWND hWnd, uint32 wMsgFilterMin, uint32 wMsgFilterMax, uint32 wRemoveMsg)"
);
const TranslateMessage = user32.func("bool __stdcall TranslateMessage(VerdantHookMsg *lpMsg)");
const DispatchMessageW = user32.func("LRESULT __stdcall DispatchMessageW(VerdantHookMsg *lpMsg)");

let remapVkeys = new Set([
  0x0d, 0x10, 0x11, 0x20, 0x09, 0x2d, 0x25, 0x26, 0x27, 0x28,
  0x41, 0x44, 0x45, 0x46, 0x47, 0x51, 0x52, 0x53, 0x57,
]);

let hKbd = null;
let regKbd = null;
let hMouse = null;
let regMouse = null;
let pump = null;
let callNext = null;
/** False = pass everything (like reWASD off / desktop). */
let captureEnabled = true;
let useMouseHook = true;

let lastMouseX = null;
let lastMouseY = null;

function asPtrAddr(v) {
  if (v == null) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  return v;
}

function toNumU(w) {
  if (typeof w === "bigint") return Number(w);
  return Number(w);
}

function sendLog(text) {
  try {
    parentPort.postMessage({ t: "log", text: String(text) });
  } catch {
    // ignore
  }
}

function postMouseDelta(dx, dy) {
  try {
    parentPort.postMessage({ t: "md", dx, dy });
  } catch {
    // ignore
  }
}

function onKbd(nCode, wParam, lParam) {
  if (!hKbd || !callNext) {
    return 0n;
  }
  if (nCode < 0 || lParam == null) {
    return callNext(hKbd, nCode, wParam, lParam);
  }
  if (!captureEnabled) {
    return callNext(hKbd, nCode, wParam, lParam);
  }
  let rec;
  try {
    rec = koffi.decode(asPtrAddr(lParam), VerdantHookKbdLow);
  } catch {
    return callNext(hKbd, nCode, wParam, lParam);
  }
  const vk = (rec.vkCode >>> 0) & 0xff;
  const flags = (rec.flags >>> 0) & 0xff;
  if (flags & LLKHF_INJECTED) {
    return callNext(hKbd, nCode, wParam, lParam);
  }
  if (vk === 0x23) {
    return callNext(hKbd, nCode, wParam, lParam);
  }
  if (remapVkeys.has(vk)) {
    return 1n;
  }
  return callNext(hKbd, nCode, wParam, lParam);
}

function onMouse(nCode, wParam, lParam) {
  if (!hMouse || !callNext) {
    return 0n;
  }
  if (nCode < 0 || lParam == null) {
    return callNext(hMouse, nCode, wParam, lParam);
  }
  if (!captureEnabled || !useMouseHook) {
    return callNext(hMouse, nCode, wParam, lParam);
  }
  let r;
  try {
    r = koffi.decode(asPtrAddr(lParam), VerdantHookMousLow);
  } catch {
    return callNext(hMouse, nCode, wParam, lParam);
  }
  const f = (r.flags >>> 0) & 0xff;
  if (f & LLMHF_INJECTED) {
    return callNext(hMouse, nCode, wParam, lParam);
  }
  const wx = toNumU(wParam);
  if (wx === WM_MOUSEMOVE) {
    const x = r.x;
    const y = r.y;
    if (lastMouseX != null && lastMouseY != null) {
      postMouseDelta(x - lastMouseX, y - lastMouseY);
    }
    lastMouseX = x;
    lastMouseY = y;
    return 1n;
  }
  if (
    wx === WM_LBUTTONDOWN ||
    wx === WM_LBUTTONUP ||
    wx === WM_RBUTTONDOWN ||
    wx === WM_RBUTTONUP
  ) {
    return 1n;
  }
  return callNext(hMouse, nCode, wParam, lParam);
}

function onePump() {
  if (!hKbd && !hMouse) return;
  const msg = {};
  if (PeekMessageW(msg, null, 0, 0, PM_REMOVE)) {
    TranslateMessage(msg);
    DispatchMessageW(msg);
  }
}

function isHookFailed(h) {
  if (h == null) return true;
  if (typeof h === "bigint" && h === 0n) return true;
  if (h === 0) return true;
  return false;
}

function install() {
  if (hKbd) return;
  const hMod = GetModuleHandleW(null);

  const fnK = (n, w, l) => onKbd(n, w, l);
  regKbd = koffi.register(fnK, koffi.pointer(LlkProto));
  hKbd = SetWindowsHookExW(WH_KEYBOARD_LL, regKbd, hMod, 0);
  if (isHookFailed(hKbd)) {
    hKbd = null;
    try {
      koffi.unregister(regKbd);
    } catch {
      // ignore
    }
    regKbd = null;
    sendLog("[input-hook] SetWindowsHookExW(WH_KEYBOARD_LL) failed. Try VERDANT_INPUT_HOOK=0.");
    return;
  }

  const fnM = (n, w, l) => onMouse(n, w, l);
  regMouse = koffi.register(fnM, koffi.pointer(LlkProto));
  hMouse = SetWindowsHookExW(WH_MOUSE_LL, regMouse, hMod, 0);
  if (isHookFailed(hMouse)) {
    hMouse = null;
    useMouseHook = false;
    try {
      koffi.unregister(regMouse);
    } catch {
      // ignore
    }
    regMouse = null;
    lastMouseX = null;
    lastMouseY = null;
    sendLog(
      "[input-hook] SetWindowsHookExW(WH_MOUSE_LL) failed - no mouse unmap; keyboard block still on."
    );
  } else {
    useMouseHook = true;
    lastMouseX = null;
    lastMouseY = null;
  }

  callNext = (hh, nCode, wParam, lParam) => CallNextHookEx(hh, nCode, wParam, lParam);
  pump = setInterval(() => {
    for (let i = 0; i < 32; i += 1) onePump();
  }, 2);
  sendLog(
    "[input-hook] Low-level kbd" +
      (hMouse ? " + mouse" : "") +
      " active when capture=on (mute to games like reWASD unmap). VERDANT_INPUT_HOOK=0 disables hooks."
  );
}

function uninstall() {
  if (pump) {
    clearInterval(pump);
    pump = null;
  }
  if (hMouse) {
    try {
      UnhookWindowsHookEx(hMouse);
    } catch (e) {
      sendLog(`[input-hook] Unhook mouse: ${e?.message ?? e}`);
    }
    hMouse = null;
  }
  if (regMouse) {
    try {
      koffi.unregister(regMouse);
    } catch {
      // ignore
    }
    regMouse = null;
  }
  if (hKbd) {
    try {
      UnhookWindowsHookEx(hKbd);
    } catch (e) {
      sendLog(`[input-hook] Unhook kbd: ${e?.message ?? e}`);
    }
    hKbd = null;
  }
  if (regKbd) {
    try {
      koffi.unregister(regKbd);
    } catch {
      // ignore
    }
    regKbd = null;
  }
  callNext = null;
  lastMouseX = null;
  lastMouseY = null;
  useMouseHook = true;
}

parentPort.on("message", (m) => {
  if (m && m.cmd === "setCapture" && "value" in m) {
    const v = Boolean(m.value);
    captureEnabled = v;
    if (!v) {
      lastMouseX = null;
      lastMouseY = null;
    }
  } else if (m && m.cmd === "setRemapVkeys" && Array.isArray(m.vkeys)) {
    remapVkeys = new Set(m.vkeys);
  } else if (m && m.cmd === "start") {
    captureEnabled = true;
    if (Array.isArray(m.vkeys)) remapVkeys = new Set(m.vkeys);
    install();
    parentPort.postMessage({ t: "started", mouseHook: Boolean(hMouse) });
  } else if (m && m.cmd === "stop") {
    uninstall();
    parentPort.postMessage({ t: "stopped" });
  }
});
