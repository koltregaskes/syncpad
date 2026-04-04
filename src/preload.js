const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("syncPad", {
  exportBackup: () => ipcRenderer.invoke("backup:export"),
  importBackup: () => ipcRenderer.invoke("backup:import"),
  createNote: (title) => ipcRenderer.invoke("notes:create", title),
  deleteNote: (noteId) => ipcRenderer.invoke("notes:delete", noteId),
  duplicateNote: (noteId) => ipcRenderer.invoke("notes:duplicate", noteId),
  getNote: (noteId) => ipcRenderer.invoke("notes:get", noteId),
  getStatus: () => ipcRenderer.invoke("app:status"),
  listNotes: () => ipcRenderer.invoke("notes:list"),
  saveNote: (noteId, updates) => ipcRenderer.invoke("notes:save", noteId, updates),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (updates) => ipcRenderer.invoke("config:save", updates),
  copyText: (value) => ipcRenderer.invoke("app:copyText", value),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  onOpenSettings: (callback) => {
    ipcRenderer.removeAllListeners("settings:open");
    ipcRenderer.on("settings:open", callback);
  },
  onShowOnboarding: (callback) => {
    ipcRenderer.removeAllListeners("onboarding:open");
    ipcRenderer.on("onboarding:open", callback);
  }
});
