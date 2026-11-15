// Poultry Manager — desktop shell (Electron). Runs as its own Windows program: no browser, no XAMPP, no internet needed.
// Data: one SQLite file in Documents\PoultryManager\data. Backups: Documents\PoultryManager\Backups (or the folder set in Settings).
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Store } = require('./db');
const { Backups } = require('./backup');

// one window only: two windows writing the same data would overwrite each other
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

let win = null;
let store = null;
let backups = null;
let dirs = null;

function setupData() {
  const root = process.env.PM_DATA_DIR || path.join(app.getPath('documents'), 'PoultryManager');
  dirs = { root, data: path.join(root, 'data'), backups: path.join(root, 'Backups'), safety: path.join(root, 'data', 'safety') };
  Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));
  store = new Store(path.join(dirs.data, 'poultry.db'));
  store.ensureAuth();
  backups = new Backups({ store, dirs, onChange: (entry) => { if (win && !win.isDestroyed()) win.webContents.send('backup:done', entry); } });
}

// sync handlers return { __error } instead of throwing so the screen can show the problem
function onSync(ch, fn) {
  ipcMain.on(ch, (e, ...a) => {
    try { const r = fn(...a); e.returnValue = r === undefined ? null : r; } catch (err) { console.error(ch, err); e.returnValue = { __error: err.message || String(err) }; }
  });
}

function registerIpc() {
  onSync('db:load', () => ({ state: store.load(), info: { dataFile: store.file, root: dirs.root, defaultBackupFolder: dirs.backups, version: app.getVersion() } }));
  onSync('db:commit', (changes) => store.commit(changes));
  onSync('db:replaceAll', (state) => { store.replaceAll(state); return true; });
  onSync('db:putPhoto', (id, data) => { store.putPhoto(id, data); return true; });
  onSync('db:getPhoto', (id) => store.getPhoto(id));
  onSync('auth:info', () => store.authInfo());
  onSync('auth:check', (pw) => store.checkPassword(pw));
  onSync('auth:set', (o, n) => store.setPassword(o, n));
  onSync('backup:log', () => backups.log());
  onSync('app:info', () => ({ dataFile: store.file, root: dirs.root, defaultBackupFolder: dirs.backups, version: app.getVersion() }));

  ipcMain.handle('backup:now', (_e, kind, note) => backups.run(kind === 'safety' ? 'safety' : 'manual', note || ''));
  ipcMain.handle('backup:usb', () => backups.usbDrives());
  ipcMain.handle('backup:chooseFolder', async (_e, current) => {
    const r = await dialog.showOpenDialog(win, { title: 'Backup folder', defaultPath: current || dirs.backups, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('backup:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose backup file', defaultPath: backups.settings().folder, properties: ['openFile'], filters: [{ name: 'Poultry Manager backup', extensions: ['db'] }] });
    if (r.canceled) return null;
    return backups.inspect(r.filePaths[0]);
  });
  ipcMain.handle('backup:restore', async (_e, file) => {
    const r = await backups.restore(file);
    if (r.ok) setTimeout(() => win && win.webContents.reload(), 300); // screens reload the restored data
    return r;
  });
  ipcMain.handle('app:openFolder', (_e, p) => shell.openPath(p || dirs.root));

  // Print through Windows' own print dialog. The page is written to a temp file so fonts and styles load offline.
  ipcMain.handle('print:html', async (_e, html, opts = {}) => {
    const file = path.join(os.tmpdir(), 'poultry-print-' + Date.now() + '.html');
    fs.writeFileSync(file, html, 'utf8');
    const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
    try {
      await pw.loadFile(file);
      await new Promise((r) => setTimeout(r, 400)); // let the Urdu font finish loading
      return await new Promise((resolve) => {
        pw.webContents.print({ silent: false, printBackground: true, pageSize: opts.paper || 'A4', margins: { marginType: 'default' } }, (ok, reason) => resolve({ ok, reason }));
      });
    } finally {
      pw.destroy(); fs.unlink(file, () => {});
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1024, minHeight: 640,
    title: 'Poultry Manager', backgroundColor: '#F4F6FA', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  win.once('ready-to-show', () => { if (!process.env.PM_NO_MAXIMIZE) win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  if (!primary) return; // the app is already open: that window was brought to the front
  try { setupData(); } catch (err) {
    dialog.showErrorBox('Poultry Manager', 'The data file could not be opened.\n\n' + err.message);
    app.quit(); return;
  }
  registerIpc();
  createWindow();
  backups.start();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { if (backups) backups.stop(); if (store) store.close(); });
