const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("verdantLauncher", {
  startClient: (payload) => ipcRenderer.invoke("launcher:start-client", payload),
  stopClient: () => ipcRenderer.invoke("launcher:stop-client"),
  getClientStatus: () => ipcRenderer.invoke("launcher:get-client-status"),
  onClientStatus: (listener) => {
    if (typeof listener !== "function") return () => {};
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("client:status", wrapped);
    return () => ipcRenderer.removeListener("client:status", wrapped);
  },
  checkUpdates: () => ipcRenderer.invoke("launcher:check-updates"),
  downloadUpdate: () => ipcRenderer.invoke("launcher:download-update"),
  installUpdate: () => ipcRenderer.invoke("launcher:install-update"),
  getUpdaterState: () => ipcRenderer.invoke("launcher:get-updater-state"),
  onUpdaterState: (listener) => {
    if (typeof listener !== "function") return () => {};
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("launcher:updater-state", wrapped);
    return () => ipcRenderer.removeListener("launcher:updater-state", wrapped);
  },
  executorLoadDraft: () => ipcRenderer.invoke("executor:load-draft"),
  executorSaveDraft: (text) => ipcRenderer.invoke("executor:save-draft", text),
  executorGetBackendUrl: () => ipcRenderer.invoke("executor:get-backend-url"),
  executorAttach: () => ipcRenderer.invoke("executor:attach"),
  executorRun: (code) => ipcRenderer.invoke("executor:run", code),
  executorScriptbloxFetch: (q, page) => ipcRenderer.invoke("executor:scriptblox-fetch", q, page),
  executorGetScripts: () => ipcRenderer.invoke("executor:get-scripts"),
  executorSaveScript: (name, code) => ipcRenderer.invoke("executor:save-script", name, code),
  executorDeleteScript: (name) => ipcRenderer.invoke("executor:delete-script", name),
});
