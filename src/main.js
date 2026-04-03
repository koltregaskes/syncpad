const path = require("path");
const fs = require("fs/promises");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");

const store = require("./store");

app.disableHardwareAcceleration();

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
ipcMain.handle("backup:export", async () => {
  const backup = await store.exportBackup();
  const defaultPath = path.join(app.getPath("documents"), `syncpad-backup-${new Date().toISOString().slice(0, 10)}.json`);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export SyncPad backup",
    defaultPath,
    filters: [{ name: "JSON backup", extensions: ["json"] }]
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await fs.writeFile(filePath, JSON.stringify(backup, null, 2), "utf-8");
  return {
    canceled: false,
    filePath,
    noteCount: backup.noteCount
  };
});
ipcMain.handle("backup:import", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import SyncPad backup",
    properties: ["openFile"],
    filters: [{ name: "JSON backup", extensions: ["json"] }]
  });

  if (canceled || !filePaths.length) {
    return { canceled: true };
  }

  const raw = await fs.readFile(filePaths[0], "utf-8");
  const parsed = JSON.parse(raw);
  const result = await store.importBackup(parsed);

  return {
    canceled: false,
    filePath: filePaths[0],
    ...result
  };
});

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
