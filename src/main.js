const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");

const store = require("./store");

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f5f1e8",
    title: "SyncPad",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("app:status", async () => ({
  ...(await store.getStatus()),
  sync: "Local only"
}));

ipcMain.handle("notes:list", () => store.listNotes());
ipcMain.handle("notes:get", (_, noteId) => store.getNote(noteId));
ipcMain.handle("notes:create", (_, title) => store.createNote(title));
ipcMain.handle("notes:duplicate", (_, noteId) => store.duplicateNote(noteId));
ipcMain.handle("notes:save", (_, noteId, updates) => store.saveNote(noteId, updates));
ipcMain.handle("notes:delete", (_, noteId) => store.deleteNote(noteId));

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
