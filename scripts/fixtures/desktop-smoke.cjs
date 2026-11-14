const path = require('node:path');
const { app, BrowserWindow } = require('electron');
app.setPath('userData', path.join(process.env.MYDATA_DIR, 'electron-profile'));
// Hide before the first native show so the smoke test stays unobtrusive.
BrowserWindow.prototype.show = function () {};
app.on('browser-window-created', (_, window) => window.hide());
require('../../src/main');
