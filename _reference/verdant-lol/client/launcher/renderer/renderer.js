function setLaunchStatus(text, ok = false) {
  const root = document.getElementById("launch-status");
  if (!root) return;
  root.textContent = text;
  root.style.color = ok ? "#bdfcc6" : "#c8c8c8";
}

function renderUpdaterState(state) {
  if (!state) return;
  const currentVersion = document.getElementById("current-version");
  const latestVersion = document.getElementById("latest-version");
  const updateState = document.getElementById("update-state");
  const updatePhase = document.getElementById("update-phase");
  const updateProgress = document.getElementById("update-progress");
  const updateNotes = document.getElementById("update-notes");

  if (currentVersion) currentVersion.textContent = state.currentVersion || "-";
  if (latestVersion) latestVersion.textContent = state.latestVersion || "-";
  if (updateState) {
    if (state.error) {
      updateState.textContent = "Error";
    } else if (state.updateAvailable) {
      updateState.textContent = state.hasDownloadedArtifact ? "Ready to install" : "Update available";
    } else {
      updateState.textContent = "Up to date";
    }
  }
  if (updatePhase) updatePhase.textContent = state.phase || "idle";
  if (updateProgress) {
    const pct = Math.round(((Number(state.progress) || 0) * 100));
    if (state.phase === "downloading") {
      const filePart =
        Number(state.totalFiles) > 0
          ? ` (${Number(state.downloadedFiles || 0)}/${Number(state.totalFiles)} files)`
          : "";
      updateProgress.textContent = `${pct}%${filePart}`;
    } else {
      updateProgress.textContent = `${pct}%`;
    }
  }
  if (updateNotes) {
    updateNotes.textContent = state.error || state.message || state.releaseNotes || "";
  }

  const btnDownload = document.getElementById("btn-update-download");
  const btnInstall = document.getElementById("btn-update-install");
  if (btnDownload) {
    btnDownload.disabled = !(state.updateAvailable && !state.hasDownloadedArtifact && !state.error);
  }
  if (btnInstall) {
    btnInstall.disabled = !state.hasDownloadedArtifact;
  }
}

function formatUptime(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${seconds}s`;
}

function renderClientStatus(status) {
  const running = document.getElementById("launch-running");
  const pid = document.getElementById("launch-pid");
  const uptime = document.getElementById("launch-uptime");
  if (running) running.textContent = status?.running ? "Running" : "Stopped";
  if (pid) pid.textContent = status?.pid ?? "-";
  if (uptime) uptime.textContent = formatUptime(status?.uptimeMs);
}

async function boot() {
  const unsubscribeUpdater = window.verdantLauncher.onUpdaterState?.((state) => {
    renderUpdaterState(state);
  });
  const unsubscribeStatus = window.verdantLauncher.onClientStatus?.((status) => {
    renderClientStatus(status);
  });
  window.addEventListener(
    "beforeunload",
    () => {
      unsubscribeUpdater?.();
      unsubscribeStatus?.();
    },
    { once: true }
  );
  try {
    const initial = await window.verdantLauncher.getUpdaterState();
    renderUpdaterState(initial);
  } catch {
    document.getElementById("update-state").textContent = "Check failed";
  }
  await window.verdantLauncher.checkUpdates();

  document.getElementById("btn-update-check")?.addEventListener("click", async () => {
    await window.verdantLauncher.checkUpdates();
  });
  document.getElementById("btn-update-download")?.addEventListener("click", async () => {
    await window.verdantLauncher.downloadUpdate();
  });
  document.getElementById("btn-update-install")?.addEventListener("click", async () => {
    await window.verdantLauncher.installUpdate();
  });

  try {
    const currentStatus = await window.verdantLauncher.getClientStatus();
    renderClientStatus(currentStatus);
  } catch {
    renderClientStatus({ running: false, pid: "-", uptimeMs: 0 });
  }

  document.getElementById("btn-launch")?.addEventListener("click", async () => {
    setLaunchStatus("Starter klient...");
    const res = await window.verdantLauncher.startClient({
      product: "Roblox",
      profileName: "Default",
    });
    if (!res?.ok) {
      setLaunchStatus(res?.error ?? "Launch feilet.");
      return;
    }
    setLaunchStatus("Klient startet.", true);
  });

  document.getElementById("btn-stop")?.addEventListener("click", async () => {
    const res = await window.verdantLauncher.stopClient();
    if (!res?.ok) {
      setLaunchStatus(res?.error ?? "Stop feilet.");
      return;
    }
    setLaunchStatus("Klient stoppet.", true);
  });
}

boot().catch((error) => {
  setLaunchStatus(`Feil ved oppstart: ${error.message}`);
});
