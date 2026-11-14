const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'syncpad-electron-42-'));
  fs.mkdirSync(path.join(root, 'SyncPad'));
  fs.writeFileSync(path.join(root, 'SyncPad/config.json'), JSON.stringify({
    mode: 'host', host: '127.0.0.1', port: 3299, setupComplete: true
  }));
  const launchEnv = { ...process.env, MYDATA_DIR: root };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(__dirname, 'fixtures/desktop-smoke.cjs')],
    env: launchEnv, timeout: 30000
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForFunction(() => typeof window.syncPad?.createNote === 'function');
    const id = await page.evaluate(async () => {
      const note = await window.syncPad.createNote('Electron 42 smoke');
      await window.syncPad.saveNote(note.id, { title: 'Electron 42 smoke', content: 'Persisted through isolated preload' });
      return note.id;
    });
    await page.reload();
    await page.waitForFunction(() => typeof window.syncPad?.getNote === 'function');
    const saved = await page.evaluate(id => window.syncPad.getNote(id), id);
    assert.equal(saved.content, 'Persisted through isolated preload');
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ electron: await app.evaluate(() => process.versions.electron), saveReload: 'PASS', isolation: 'PASS', pageErrors: errors }));
  } finally { app.process().kill(); await app.close().catch(() => {}); }
})().catch(e => { console.error(e); process.exitCode = 1; });
