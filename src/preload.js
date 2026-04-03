const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("syncPad", {
  createNote: (title) => ipcRenderer.invoke("notes:create", title),
  deleteNote: (noteId) => ipcRenderer.invoke("notes:delete", noteId),
  duplicateNote: (noteId) => ipcRenderer.invoke("notes:duplicate", noteId),
  getNote: (noteId) => ipcRenderer.invoke("notes:get", noteId),
  getStatus: () => ipcRenderer.invoke("app:status"),
  listNotes: () => ipcRenderer.invoke("notes:list"),
  saveNote: (noteId, updates) => ipcRenderer.invoke("notes:save", noteId, updates)
});
