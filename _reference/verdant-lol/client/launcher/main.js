const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const dotenv = require("dotenv");
const vigemFfi = require(path.join(__dirname, "vigem-ffi.js"));
const llKbInput = require(path.join(__dirname, "ll-kb-input-hook.js"));

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

let mainWindow = null;
let clientProcess = null;
let overlayProcess = null;
let executorProcess = null;
let startedAt = null;
const EXECUTOR_PORT = Number(process.env.VERDANT_EXECUTOR_PORT ?? 6969);
/** Last successful startClient payload; used by restart-with-mapping / session. */
let lastEnginePayload = null;
const API_PORT = process.env.WEB_PORT ?? "8788";
const API_BASE =
  process.env.LAUNCHER_API_BASE ??
  process.env.PUBLIC_API_BASE ??
  "https://verdant.lol";
const UPDATER_STATE_CHANNEL = "launcher:updater-state";
const RUNTIME_ROOT = path.join(app.getPath("userData"), "runtime");
const RUNTIME_CURRENT_DIR = path.join(RUNTIME_ROOT, "current");
const RUNTIME_STAGING_DIR = path.join(RUNTIME_ROOT, "staging");
let updaterState = {
  phase: "idle",
  message: "Idle",
  currentVersion: "",
  latestVersion: "",
  updateAvailable: false,
  releaseNotes: "",
  progress: 0,
  totalBytes: 0,
  downloadedBytes: 0,
  totalFiles: 0,
  downloadedFiles: 0,
  hasDownloadedArtifact: false,
  error: null,
};
let latestUpdateInfo = null;
let downloadedBundlePath = "";

/** Optional: full path to MA_FH5Trainer.exe. Otherwise we search under the repo / install. */
function resolveFh5TrainerExe() {
  const envPath = process.env.FH5_TRAINER_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const roots = [
    path.join(__dirname, "..", "..", "mod-menu", "MA_FH5Trainer", "bin", "x64", "Release", "net8.0-windows"),
    path.join(__dirname, "..", "..", "mod-menu", "MA_FH5Trainer", "bin", "x64", "Debug", "net8.0-windows"),
  ];
  for (const dir of roots) {
    const p = path.join(dir, "MA_FH5Trainer.exe");
    if (fs.existsSync(p)) return p;
  }
  return "";
}

function computeHwid() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.release(),
    (os.cpus()?.[0]?.model ?? "cpu").slice(0, 64),
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function semverCompare(a, b) {
  const pa = String(a).split(".").map((v) => Number(v) || 0);
  const pb = String(b).split(".").map((v) => Number(v) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function getClientStatusPayload() {
  const now = Date.now();
  return {
    running: Boolean(clientProcess),
    pid: clientProcess?.type === "ffi" ? "koffi" : (clientProcess?.pid ?? null),
    startedAt,
    uptimeMs: startedAt ? now - startedAt : 0,
  };
}

function broadcastToRenderers(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
}

function emitUpdaterState(patch) {
  updaterState = {
    ...updaterState,
    ...patch,
  };
  broadcastToRenderers(UPDATER_STATE_CHANNEL, updaterState);
  return updaterState;
}

function normalizeUpdateInfo(payload, currentVersion) {
  const update = payload?.update ?? {};
  const latestVersion = String(payload?.latestVersion ?? update.latestVersion ?? currentVersion).trim();
  const minCompatibleVersion = String(update.minCompatibleVersion ?? "0.0.0").trim() || "0.0.0";
  const downloadUrl = String(update.downloadUrl ?? "").trim();
  const releaseNotes = String(payload?.notes ?? update.notes ?? "").trim();
  const updateAvailable = semverCompare(latestVersion, currentVersion) > 0;
  return {
    currentVersion,
    latestVersion,
    minCompatibleVersion,
    updateAvailable,
    releaseNotes,
    channel: String(update.channel ?? "stable"),
    downloadUrl,
    sha256: String(update.sha256 ?? "").trim().toLowerCase(),
    signature: String(update.signature ?? "").trim(),
    hasUpdateArtifact: Boolean(downloadUrl),
    installMode: String(update.installMode ?? "runtime_bundle").trim(),
    runtimeFiles: Array.isArray(update?.runtime?.files) ? update.runtime.files : [],
  };
}

function cleanRelativePath(rel) {
  const normalized = path.normalize(String(rel ?? "").replace(/\\/g, "/")).replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  return normalized;
}

function currentRuntimePath(...parts) {
  return path.join(RUNTIME_CURRENT_DIR, ...parts);
}

function resolveRuntimeFileCandidates(relativePath) {
  const safeRel = cleanRelativePath(relativePath);
  if (!safeRel) return [];
  return [currentRuntimePath(safeRel)];
}

async function ensureRuntimeDirs() {
  await fs.promises.mkdir(RUNTIME_ROOT, { recursive: true });
  await fs.promises.mkdir(RUNTIME_STAGING_DIR, { recursive: true });
}

async function downloadFileToPath(entry, destinationPath, onChunk) {
  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${entry.path}`);
  const hash = crypto.createHash("sha256");
  const file = fs.createWriteStream(destinationPath);
  const reader = response.body?.getReader?.();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      hash.update(chunk);
      file.write(chunk);
      onChunk(chunk.length);
    }
    file.end();
    await new Promise((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });
  } else {
    const buffer = Buffer.from(await response.arrayBuffer());
    hash.update(buffer);
    await fs.promises.writeFile(destinationPath, buffer);
    file.destroy();
    onChunk(buffer.length);
  }

  const digest = hash.digest("hex").toLowerCase();
  if (entry.sha256 && digest !== entry.sha256) {
    throw new Error(`Checksum mismatch for ${entry.path}`);
  }
}

function stopAllRuntimeChildren() {
  stopClient();
  stopOverlay();
  stopExecutor();
}

/** Resolve the verdant_overlay.exe path; returns "" if not built yet. */
function resolveOverlayExe() {
  const managed = resolveRuntimeFileCandidates("overlay/verdant_overlay.exe");
  const candidates =
    process.platform === "win32"
      ? [
          ...managed,
          path.join(__dirname, "..", "overlay", "build-win", "Release", "verdant_overlay.exe"),
          path.join(__dirname, "..", "overlay", "build", "Release", "verdant_overlay.exe"),
        ]
      : [];
  return candidates.find((p) => fs.existsSync(p)) ?? "";
}

function startOverlayIfAvailable() {
  if (overlayProcess) return;
  if (process.platform !== "win32") return;
  const exe = resolveOverlayExe();
  if (!exe) return;
  try {
    overlayProcess = spawn(exe, [], {
      stdio: "ignore",
      detached: false,
      env: {
        ...process.env,
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_PUBLISHABLE_KEY:
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
        VERDANT_CHAT_ROOM_ID: process.env.VERDANT_CHAT_ROOM_ID ?? "",
        VERDANT_CHAT_AUTHOR_ID: process.env.VERDANT_CHAT_AUTHOR_ID ?? "",
        VERDANT_CHAT_AUTHOR_NAME: process.env.VERDANT_CHAT_AUTHOR_NAME ?? "",
      },
    });
    broadcastToRenderers("client:log", "[Overlay] Verdant chat overlay startet.");
    overlayProcess.on("close", (code) => {
      broadcastToRenderers("client:log", `[Overlay] avsluttet (kode ${code}).`);
      overlayProcess = null;
    });
  } catch (err) {
    broadcastToRenderers("client:log", `[Overlay] kunne ikke starte: ${err.message}`);
    overlayProcess = null;
  }
}

function stopOverlay() {
  if (!overlayProcess) return;
  try {
    overlayProcess.kill();
  } catch {
    // ignore
  }
  overlayProcess = null;
}

/** Resolve the local kernel-backed executor binary; "" if not built yet. */
function resolveExecutorExe() {
  if (process.platform !== "win32") return "";
  const candidates = [
    ...resolveRuntimeFileCandidates("executor/verdant_executor.exe"),
    path.join(__dirname, "..", "executor", "build-win", "Release", "verdant_executor.exe"),
    path.join(__dirname, "..", "executor", "build", "Release", "verdant_executor.exe"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? "";
}

function startExecutorIfAvailable() {
  if (executorProcess) return;
  if (process.platform !== "win32") return;
  const exe = resolveExecutorExe();
  if (!exe) return;
  const explicit = String(process.env.VERDANT_EXECUTOR_URL ?? "").trim();
  const baseUrl =
    explicit.replace(/\/$/, "") || `${String(API_BASE).replace(/\/$/, "")}/api/executor`;
  let authorName = "anon";
  try {
    authorName = os.userInfo().username || os.hostname() || "anon";
  } catch {
    authorName = os.hostname() || "anon";
  }
  try {
    executorProcess = spawn(exe, [], {
      stdio: "pipe",
      detached: false,
      env: {
        ...process.env,
        VERDANT_EXECUTOR_PORT: String(EXECUTOR_PORT),
        VERDANT_EXECUTOR_BASE: baseUrl,
        VERDANT_EXECUTOR_HWID: computeHwid(),
        VERDANT_EXECUTOR_AUTHOR: authorName,
        VERDANT_EXECUTOR_LICENSE: String(lastEnginePayload?.licenseKey ?? ""),
      },
    });
    broadcastToRenderers(
      "client:log",
      `[Executor] daemon startet (pid ${executorProcess.pid}, port ${EXECUTOR_PORT}).`
    );
    executorProcess.stdout?.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) broadcastToRenderers("client:log", text);
    });
    executorProcess.stderr?.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) broadcastToRenderers("client:log", `[ERR] ${text}`);
    });
    executorProcess.on("close", (code) => {
      broadcastToRenderers("client:log", `[Executor] daemon avsluttet (kode ${code}).`);
      executorProcess = null;
    });
  } catch (err) {
    broadcastToRenderers("client:log", `[Executor] kunne ikke starte: ${err.message}`);
    executorProcess = null;
  }
}

function stopExecutor() {
  if (!executorProcess) return;
  try {
    executorProcess.kill();
  } catch {
    // ignore
  }
  executorProcess = null;
}

function sendStatus() {
  broadcastToRenderers("client:status", getClientStatusPayload());
}

function showRemapStateNotification(remapOn) {
  if (!Notification.isSupported()) return;
  try {
    const n = new Notification({
      title: "Verdant",
      body: remapOn ? "Mapping aktiv - virtuell kontroller på." : "Mapping av - Insert for å slå på igjen.",
      silent: true,
    });
    n.show();
  } catch {
    // ignore
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "VERDANT.LOL",
    backgroundColor: "#050505",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send(UPDATER_STATE_CHANNEL, updaterState);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* The "Remap engine" branding is preserved for the user-facing UI, but the
 * runtime no longer drives a virtual gamepad via ViGEm. Sessions are now
 * routed through the local kernel-backed executor daemon (client/executor/);
 * vigem-ffi.js / ll-kb-* are left in place but no longer wired into the
 * start/stop path; the cpp-client (ViGEm GUI binary) was removed. */
function startClient(payload) {
  if (clientProcess) {
    return { ok: false, error: "Client already running." };
  }
  lastEnginePayload = JSON.parse(JSON.stringify(payload));
  broadcastToRenderers("engine:session", lastEnginePayload);

  if (!executorProcess) startExecutorIfAvailable();

  const product = payload?.product ?? "Roblox";
  const profile = payload?.profileName ?? "Default";
  const backendUrl = resolveExecutorBaseUrl();
  const backendKind = executorProcess ? "lokal kernel-executor" : "remote executor";
  broadcastToRenderers(
    "client:log",
    `[Remap] Engine session startet for ${product} (${profile}) \u2014 ${backendKind} @ ${backendUrl}.`
  );

  clientProcess = {
    type: "executor",
    pid: executorProcess?.pid ?? null,
    stop: () => {},
    kill: () => {},
  };
  startedAt = Date.now();
  sendStatus();
  startOverlayIfAvailable();

  showRemapStateNotification(true);
  return { ok: true };
}

function stopClient() {
  if (!clientProcess) return { ok: false, error: "Client is not running." };
  stopOverlay();
  broadcastToRenderers("client:log", "[Remap] Engine session stoppet.");
  clientProcess = null;
  startedAt = null;
  showRemapStateNotification(false);
  sendStatus();
  return { ok: true };
}

function waitForEngineExit() {
  return new Promise((resolve) => {
    if (!clientProcess) {
      resolve();
      return;
    }
    if (clientProcess.type === "executor") {
      stopClient();
      resolve();
      return;
    }
    if (clientProcess.type === "ffi") {
      clientProcess.stop();
      resolve();
      return;
    }
    const p = clientProcess;
    p.once?.("close", () => resolve());
    try {
      p.kill();
    } catch {
      // ignore
    }
    setTimeout(resolve, 500);
  });
}

async function restartEngineWithMapping(newMapping) {
  if (!lastEnginePayload) {
    return { ok: false, error: "No active session. Start the engine from the main window first." };
  }
  if (clientProcess) {
    await waitForEngineExit();
  }
  if (clientProcess) {
    return { ok: false, error: "Could not stop the engine. Try again." };
  }
  const next = {
    ...lastEnginePayload,
    mapping: {
      ...lastEnginePayload.mapping,
      ...newMapping,
    },
  };
  return startClient(next);
}

async function fetchUpdateManifest() {
  const currentVersion = app.getVersion();
  try {
    const response = await fetch(`${API_BASE}/api/client/version`);
    if (!response.ok) throw new Error(`Update check failed (${response.status})`);
    const data = await response.json();
    const info = normalizeUpdateInfo(data, currentVersion);
    latestUpdateInfo = info;
    return { ...info, error: null };
  } catch (error) {
    latestUpdateInfo = null;
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseNotes: "",
      minCompatibleVersion: "0.0.0",
      channel: "stable",
      downloadUrl: "",
      sha256: "",
      signature: "",
      hasUpdateArtifact: false,
      installMode: "runtime_bundle",
      runtimeFiles: [],
      error: `Could not reach update API at ${API_BASE}`,
    };
  }
}

async function checkUpdates() {
  const currentVersion = app.getVersion();
  emitUpdaterState({
    phase: "checking",
    message: "Checking for updates...",
    currentVersion,
    error: null,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });
  const result = await fetchUpdateManifest();
  if (result.error) {
    return emitUpdaterState({
      phase: "error",
      message: result.error,
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
      updateAvailable: false,
      releaseNotes: "",
      hasDownloadedArtifact: false,
      error: result.error,
    });
  }

  const incompatible = semverCompare(result.currentVersion, result.minCompatibleVersion) < 0;
  if (incompatible) {
    const message =
      `Launcher ${result.currentVersion} is below minimum compatible ` +
      `${result.minCompatibleVersion}. Download the latest installer.`;
    return emitUpdaterState({
      phase: "incompatible",
      message,
      ...result,
      hasDownloadedArtifact: false,
      error: message,
    });
  }

  return emitUpdaterState({
    phase: result.updateAvailable ? "available" : "up-to-date",
    message: result.updateAvailable ? "Update available." : "Launcher is up to date.",
    ...result,
    hasDownloadedArtifact: false,
    error: null,
  });
}

async function downloadUpdate() {
  const info = latestUpdateInfo ?? (await fetchUpdateManifest());
  if (!info || !info.updateAvailable) {
    return emitUpdaterState({
      phase: "up-to-date",
      message: "No update available.",
      updateAvailable: false,
      hasDownloadedArtifact: false,
      error: null,
    });
  }
  const fallbackEntry = info.downloadUrl
    ? [{ path: "launcher/VERDANT.LOL.exe", url: info.downloadUrl, sha256: info.sha256 }]
    : [];
  const runtimeFiles = (Array.isArray(info.runtimeFiles) && info.runtimeFiles.length > 0
    ? info.runtimeFiles
    : fallbackEntry
  )
    .map((entry) => ({
      path: cleanRelativePath(entry?.path),
      url: String(entry?.url ?? "").trim(),
      sha256: String(entry?.sha256 ?? "").trim().toLowerCase(),
    }))
    .filter((entry) => entry.path && entry.url);
  if (runtimeFiles.length === 0) {
    const message = "Update has no runtime files (.exe/.dll) configured.";
    return emitUpdaterState({
      phase: "error",
      message,
      ...info,
      hasDownloadedArtifact: false,
      error: message,
    });
  }

  emitUpdaterState({
    phase: "downloading",
    message: "Downloading runtime files...",
    ...info,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    downloadedFiles: 0,
    totalFiles: runtimeFiles.length,
    hasDownloadedArtifact: false,
    error: null,
  });

  try {
    await ensureRuntimeDirs();
    const bundleDir = path.join(
      RUNTIME_STAGING_DIR,
      `${info.latestVersion}-${Date.now().toString(36)}`
    );
    await fs.promises.mkdir(bundleDir, { recursive: true });
    let downloadedBytes = 0;

    emitUpdaterState({
      totalBytes: 0,
      downloadedBytes: 0,
      downloadedFiles: 0,
      totalFiles: runtimeFiles.length,
      progress: 0,
    });
    for (let i = 0; i < runtimeFiles.length; i += 1) {
      const entry = runtimeFiles[i];
      const destination = path.join(bundleDir, entry.path);
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      await downloadFileToPath(entry, destination, (bytes) => {
        downloadedBytes += bytes;
      });
      emitUpdaterState({
        message: `Downloaded ${entry.path}`,
        downloadedBytes,
        totalBytes: 0,
        downloadedFiles: i + 1,
        totalFiles: runtimeFiles.length,
        progress: (i + 1) / runtimeFiles.length,
      });
    }
    await fs.promises.writeFile(
      path.join(bundleDir, "runtime-manifest.json"),
      JSON.stringify(
        {
          version: info.latestVersion,
          downloadedAt: new Date().toISOString(),
          files: runtimeFiles,
        },
        null,
        2
      ),
      "utf8"
    );
    downloadedBundlePath = bundleDir;
    return emitUpdaterState({
      phase: "ready",
      message: "Runtime files downloaded. Ready to install.",
      ...info,
      progress: 1,
      downloadedBytes,
      totalBytes: 0,
      downloadedFiles: runtimeFiles.length,
      totalFiles: runtimeFiles.length,
      hasDownloadedArtifact: true,
      error: null,
    });
  } catch (error) {
    if (downloadedBundlePath) {
      try {
        await fs.promises.rm(downloadedBundlePath, { recursive: true, force: true });
      } catch {
        // ignore
      }
      downloadedBundlePath = "";
    }
    const message = error?.message ?? "Unknown download error";
    return emitUpdaterState({
      phase: "error",
      message,
      ...info,
      hasDownloadedArtifact: false,
      error: message,
    });
  }
}

async function installDownloadedUpdate() {
  if (!downloadedBundlePath || !fs.existsSync(downloadedBundlePath)) {
    const message = "No downloaded runtime bundle found.";
    return emitUpdaterState({
      phase: "error",
      message,
      hasDownloadedArtifact: false,
      error: message,
    });
  }

  emitUpdaterState({
    phase: "installing",
    message: "Installing runtime bundle...",
    error: null,
  });
  stopAllRuntimeChildren();
  try {
    const backupDir = `${RUNTIME_CURRENT_DIR}.bak`;
    try {
      await fs.promises.rm(backupDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    if (fs.existsSync(RUNTIME_CURRENT_DIR)) {
      await fs.promises.rename(RUNTIME_CURRENT_DIR, backupDir);
    }
    await fs.promises.rename(downloadedBundlePath, RUNTIME_CURRENT_DIR);
    downloadedBundlePath = "";
    try {
      await fs.promises.rm(backupDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    return emitUpdaterState({
      phase: "installed",
      message: "Installed. Launch will use the new runtime folder.",
      hasDownloadedArtifact: false,
      error: null,
    });
  } catch (error) {
    const message = `Failed to install runtime bundle: ${error?.message ?? String(error)}`;
    return emitUpdaterState({
      phase: "error",
      message,
      error: message,
    });
  }
}

async function verifyLicense(payload) {
  try {
    const response = await fetch(`${API_BASE}/api/client/verify-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        hwid: computeHwid(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error ?? "License verification failed." };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: `Could not reach license API at ${API_BASE}. Ensure backend is running.`,
    };
  }
}

ipcMain.handle("launcher:start-client", (_event, payload) => startClient(payload));
ipcMain.handle("launcher:stop-client", () => stopClient());
ipcMain.handle("launcher:check-updates", () => checkUpdates());
ipcMain.handle("launcher:download-update", () => downloadUpdate());
ipcMain.handle("launcher:install-update", () => installDownloadedUpdate());
ipcMain.handle("launcher:get-updater-state", () => updaterState);
ipcMain.handle("launcher:verify-license", (_event, payload) => verifyLicense(payload));
ipcMain.handle("launcher:get-client-status", () => getClientStatusPayload());
// ─── Executor (scripts) ───────────────────────────────────────────────────────
/* Architecture (since the ViGEm runtime was retired):
 *   1. The launcher posts scripts to https://verdant.lol/api/executor/execute
 *      (overridable with VERDANT_EXECUTOR_URL).
 *   2. The server (server.js + executor-daemon.js on port 6969) enqueues the
 *      script keyed by HWID.
 *   3. The local agent (client/executor/verdant_executor.exe) long-polls
 *      /api/executor/pull?hwid=<HWID>, runs the script against Roblox via the
 *      kernel driver bridge, and POSTs the outcome to /api/executor/ack.
 * The local agent is still spawned by the launcher but is now a *polling
 * client* rather than the destination of /execute.
 */
function resolveExecutorBaseUrl() {
  const explicit = String(process.env.VERDANT_EXECUTOR_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${String(API_BASE).replace(/\/$/, "")}/api/executor`;
}

function executorHeaders(extra = {}) {
  const headers = {
    "X-Verdant-HWID": computeHwid(),
    "X-Verdant-Author": (() => {
      try {
        return os.userInfo().username || os.hostname();
      } catch {
        return os.hostname();
      }
    })(),
    ...extra,
  };
  const lic = String(lastEnginePayload?.licenseKey ?? "").trim();
  if (lic) headers["X-Verdant-License"] = lic;
  return headers;
}

const scriptDraftPath = path.join(app.getPath("userData"), "executor-script-draft.txt");
const scriptStorePath = path.join(app.getPath("userData"), "executor-scripts.json");
const remapStudioProfilePath = path.join(app.getPath("userData"), "remap-studio-profile.json");
const remapperProfilesPath = path.join(app.getPath("userData"), "remapper-profiles.json");

function readScriptDraft() {
  try {
    return fs.readFileSync(scriptDraftPath, "utf8");
  } catch {
    try {
      const j = JSON.parse(fs.readFileSync(remapperProfilesPath, "utf8"));
      const sel = j.profiles?.find((p) => p.id === j.selectedId) ?? j.profiles?.[0];
      const script = typeof sel?.executorScript === "string" ? sel.executorScript : "";
      if (script) {
        fs.writeFileSync(scriptDraftPath, script, "utf8");
        return script;
      }
    } catch {
      // ignore
    }
    try {
      const old = JSON.parse(fs.readFileSync(remapStudioProfilePath, "utf8"));
      if (typeof old.executorScript === "string" && old.executorScript) {
        fs.writeFileSync(scriptDraftPath, old.executorScript, "utf8");
        return old.executorScript;
      }
    } catch {
      // ignore
    }
    return "";
  }
}

ipcMain.handle("executor:load-draft", () => readScriptDraft());

ipcMain.handle("executor:save-draft", (_e, text) => {
  if (typeof text !== "string") return { ok: false, error: "Invalid payload." };
  try {
    fs.writeFileSync(scriptDraftPath, text, "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});

function readScriptStore() {
  try {
    return JSON.parse(fs.readFileSync(scriptStorePath, "utf8"));
  } catch {
    return [];
  }
}

function writeScriptStore(scripts) {
  try {
    fs.writeFileSync(scriptStorePath, JSON.stringify(scripts, null, 2), "utf8");
  } catch {
    // ignore write errors
  }
}

ipcMain.handle("executor:get-backend-url", () => ({
  url: resolveExecutorBaseUrl(),
}));

ipcMain.handle("executor:attach", async () => {
  const base = resolveExecutorBaseUrl();
  try {
    const url = `${base}/health`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (res.status === 404) {
      const fallback = await fetch(`${base.replace(/\/$/, "")}/`, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      return { ok: fallback.status < 500 };
    }
    return { ok: res.ok };
  } catch (e) {
    return {
      ok: false,
      error: `Could not reach executor API at ${base}. Deploy server routes + VERDANT_EXECUTOR_UPSTREAM on VPS, or set VERDANT_EXECUTOR_URL=http://127.0.0.1:6969 - ${e.message}`,
    };
  }
});

ipcMain.handle("executor:run", async (_e, code) => {
  if (typeof code !== "string") return { ok: false, error: "Invalid script." };
  const base = resolveExecutorBaseUrl();
  const executeUrl = `${base.replace(/\/$/, "")}/execute`;
  try {
    const res = await fetch(executeUrl, {
      method: "POST",
      headers: executorHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      body: code,
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    if (!res.ok) {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
      let hint = "";
      if (res.status === 404) {
        hint =
          " 404 usually means nginx is not proxying /api/ to Node \u2014 open GET /api/executor/health in a browser; should return JSON.";
      } else if (res.status === 503) {
        hint =
          " 503: server has no VERDANT_EXECUTOR_UPSTREAM \u2014 set it on the VPS to your executor daemon (e.g. http://127.0.0.1:6969).";
      }
      return {
        ok: false,
        error: `Executor returned HTTP ${res.status} (${executeUrl})${snippet ? ` \u2014 ${snippet}` : ""}.${hint}`,
      };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // body might be plain text "ok"
    }
    return { ok: true, response: parsed ?? text };
  } catch (e) {
    return {
      ok: false,
      error: `Could not reach executor backend at ${executeUrl}. ${e.message}`,
    };
  }
});

ipcMain.handle("executor:scriptblox-fetch", async (_e, q, page) => {
  try {
    const params = new URLSearchParams({ max: "20", page: String(page ?? 1) });
    if (q) params.set("q", q);
    const url = `https://scriptblox.com/api/script/fetch?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `ScriptBlox API returned ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("executor:get-scripts", () => readScriptStore());

ipcMain.handle("executor:save-script", (_e, name, code) => {
  if (typeof name !== "string" || typeof code !== "string") return { ok: false };
  const scripts = readScriptStore().filter((s) => s.name !== name);
  scripts.unshift({ name, code, savedAt: Date.now() });
  writeScriptStore(scripts);
  return { ok: true };
});

ipcMain.handle("executor:delete-script", (_e, name) => {
  const scripts = readScriptStore().filter((s) => s.name !== name);
  writeScriptStore(scripts);
  return { ok: true };
});

ipcMain.handle("launcher:open-fh5-trainer", () => {
  if (process.platform !== "win32") {
    return { ok: false, error: "FH5 mod menu is only available on Windows." };
  }
  const exe = resolveFh5TrainerExe();
  if (!exe) {
    return {
      ok: false,
      error:
        "MA_FH5Trainer.exe not found. Build mod-menu/MA_FH5Trainer or set FH5_TRAINER_PATH to the full path of the exe.",
    };
  }
  try {
    const child = spawn(exe, [], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true, path: exe };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
});
ipcMain.handle("launcher:get-engine-session", () => lastEnginePayload);
ipcMain.handle("launcher:restart-with-mapping", async (_e, newMapping) => {
  if (!newMapping || typeof newMapping !== "object") {
    return { ok: false, error: "Invalid mapping payload." };
  }
  return restartEngineWithMapping(newMapping);
});

app.whenReady().then(() => {
  emitUpdaterState({
    currentVersion: app.getVersion(),
    latestVersion: app.getVersion(),
    message: "Idle",
  });
  if (process.platform === "win32") {
    try {
      app.setAppUserModelId("lol.verdant.launcher");
    } catch {
      // ignore
    }
  }
  startExecutorIfAvailable();
  createMainWindow();
  setInterval(sendStatus, 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopOverlay();
  stopExecutor();
  if (!clientProcess) return;
  if (clientProcess.type === "ffi") {
    try {
      clientProcess.stop();
    } catch {
      // ignore
    }
  } else if (clientProcess.type === "executor") {
    clientProcess = null;
  } else {
    try {
      clientProcess.kill();
    } catch {
      // ignore
    }
  }
});
