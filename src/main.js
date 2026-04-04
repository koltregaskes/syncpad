const path = require("path");
const fs = require("fs/promises");
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  clipboard
} = require("electron");

const store = require("./store");
const { readConfig, writeConfig, getConfigFile } = require("./config");
const { createSyncPadServer, getClientOrigin } = require("./server");

app.disableHardwareAcceleration();

let embeddedServerHandle = null;
let runtimeConfig = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function isHostMode() {
  return runtimeConfig?.mode !== "client";
}

function getLaunchOrigin() {
  if (!runtimeConfig) {
    return "about:blank";
  }

  if (isHostMode()) {
    return getClientOrigin(runtimeConfig.host, embeddedServerHandle?.port || runtimeConfig.port);
  }

  return runtimeConfig.remoteOrigin;
}

function createWindow(origin) {
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

  window.loadURL(origin);
  return window;
}

async function restartServerIfNeeded() {
  if (embeddedServerHandle) {
    const activeHandle = embeddedServerHandle;
    embeddedServerHandle = null;
    await activeHandle.stop();
  }

  if (isHostMode()) {
    try {
      embeddedServerHandle = await createSyncPadServer({
        host: runtimeConfig.host,
        port: runtimeConfig.port
      }).start();
    } catch (error) {
      await dialog.showErrorBox(
        "SyncPad host could not start",
        `SyncPad could not bind to ${runtimeConfig.host}:${runtimeConfig.port}.\n\nThis usually means another app or an older SyncPad server is already using that address.\n\nClose the other copy or change the SyncPad settings and try again.`
      );
      throw error;
    }
  }
}

async function reloadAllWindows() {
  const origin = getLaunchOrigin();
  const windows = BrowserWindow.getAllWindows();

  if (!windows.length) {
    createWindow(origin);
    return;
  }

  await Promise.all(windows.map((window) => window.loadURL(origin)));
}

function buildMenu() {
  const networkAddress = runtimeConfig
    ? (isHostMode() ? getLaunchOrigin() : runtimeConfig.remoteOrigin)
    : "";

  const template = [
    {
      label: "SyncPad",
      submenu: [
        {
          label: "Open Settings",
          click: () => {
            BrowserWindow.getAllWindows()[0]?.webContents.send("settings:open");
          }
        },
        {
          label: "Show Quick Setup",
          click: () => {
            BrowserWindow.getAllWindows()[0]?.webContents.send("onboarding:open");
          }
        },
        {
          label: "Copy Access Address",
          enabled: Boolean(networkAddress),
          click: () => {
            clipboard.writeText(networkAddress);
          }
        },
        {
          label: "Open In Browser",
          enabled: Boolean(networkAddress),
          click: () => {
            shell.openExternal(networkAddress);
          }
        },
        {
          label: "Open Data Folder",
          click: async () => {
            shell.openPath(path.dirname(store.getStoreFile()));
          }
        },
        {
          label: "Open Config File",
          click: async () => {
            shell.openPath(getConfigFile());
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("app:status", async () => ({
  ...(await store.getStatus()),
  configFile: getConfigFile(),
  mode: runtimeConfig?.mode || "host",
  bindHost: runtimeConfig?.host || "127.0.0.1",
  bindPort: runtimeConfig?.port || 3210,
  remoteOrigin: runtimeConfig?.remoteOrigin || "",
  setupComplete: runtimeConfig?.setupComplete === true,
  sync: isHostMode() ? "Private Tailscale sync app" : "Remote SyncPad client"
}));

ipcMain.handle("app:openExternal", async (_, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("app:copyText", async (_, value) => {
  clipboard.writeText(String(value || ""));
  return true;
});

ipcMain.handle("config:get", async () => ({
  ...(await readConfig()),
  configFile: getConfigFile()
}));

ipcMain.handle("config:save", async (_, updates) => {
  runtimeConfig = await writeConfig(updates);
  await restartServerIfNeeded();
  buildMenu();
  await reloadAllWindows();
  return {
    ...runtimeConfig,
    configFile: getConfigFile(),
    launchOrigin: getLaunchOrigin()
  };
});

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

app.whenReady().then(async () => {
  runtimeConfig = await readConfig();
  await restartServerIfNeeded();
  buildMenu();
  createWindow(getLaunchOrigin());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(getLaunchOrigin());
    }
  });
});

app.on("second-instance", () => {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!embeddedServerHandle) {
    return;
  }

  event.preventDefault();
  const activeHandle = embeddedServerHandle;
  embeddedServerHandle = null;
  await activeHandle.stop();
  app.quit();
});
