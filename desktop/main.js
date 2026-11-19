// Poultry Manager — desktop shell (Electron). Runs as its own Windows program: no browser, no XAMPP, no internet needed.
// Data: one SQLite file in Documents\PoultryManager\data. Backups: Documents\PoultryManager\Backups (or the folder set in Settings).
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Store } = require('./db');
const { Backups } = require('./backup');
const APP_VERSION = require('../package.json').version; // app.getVersion() is Electron's own number when run from source
const { Biometrics } = require('./biometric');
const { setupUpdates } = require('./updater');

// one window only: two windows writing the same data would overwrite each other
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

let win = null;
let store = null;
let backups = null;
let dirs = null;
let bio = null; // fingerprint scanner (optional)
let updates = null; // automatic updates from GitHub Releases

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
  onSync('db:load', () => ({ state: store.load(), info: { dataFile: store.file, root: dirs.root, defaultBackupFolder: dirs.backups, version: APP_VERSION } }));
  onSync('db:commit', (changes) => store.commit(changes));
  onSync('db:replaceAll', (state) => { store.replaceAll(state); return true; });
  onSync('db:putPhoto', (id, data) => { store.putPhoto(id, data); return true; });
  onSync('db:getPhoto', (id) => store.getPhoto(id));
  onSync('auth:info', () => store.authInfo());
  onSync('auth:check', (pw) => store.checkPassword(pw));
  onSync('auth:set', (o, n) => store.setPassword(o, n));
  onSync('backup:log', () => backups.log());
  onSync('app:info', () => ({ dataFile: store.file, root: dirs.root, defaultBackupFolder: dirs.backups, version: APP_VERSION }));

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

  // Fingerprint scanner (optional): status, captures for enrolment, matching. Matches arrive as 'bio:event'.
  bio = new Biometrics({ gallery: () => { try { return store.biometricGallery(); } catch (e) { return []; } } });
  bio.on('event', (ev) => { if (win && !win.isDestroyed()) win.webContents.send('bio:event', ev); });
  ipcMain.handle('bio:configure', (_e, cfg) => bio.configure(cfg));
  ipcMain.handle('bio:status', () => bio.status());
  ipcMain.handle('bio:capture', (_e, opts) => bio.capture(opts));
  ipcMain.handle('bio:identify', (_e, template, exceptParty) => bio.identify(template, exceptParty));
  ipcMain.handle('bio:match', (_e, a, b) => bio.match(a, b));
  ipcMain.handle('bio:pause', (_e, on) => bio.pause(on));
  ipcMain.handle('bio:sim', (_e, what, v) => (what === 'plug' ? bio.simPlug(v) : bio.simPut(v)));

  // Updates: status for the screens, check on request, restart to install
  ipcMain.handle('update:status', () => (updates ? updates.status() : { state: 'off' }));
  ipcMain.handle('update:check', () => (updates ? updates.check() : { state: 'off' }));
  ipcMain.handle('update:install', () => updates && updates.install());

  // Printing. The page is written to a temp file so fonts and styles load offline, then printed from a hidden window.
  // Page size comes from the design's @page (a thermal bill is one page exactly as tall as the bill).
  async function withPage(html, fn) {
    const file = path.join(os.tmpdir(), 'poultry-print-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.html');
    fs.writeFileSync(file, html, 'utf8');
    const thermal = /\/\*THERMAL:([\d.]+)\*\//.exec(html);
    // scripts stay off, except for a thermal bill: its height is measured in this same window, after the fonts load
    const pw = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: !!thermal } });
    try {
      await pw.loadFile(file);
      await new Promise((r) => setTimeout(r, 400)); // let the Urdu font finish loading
      let size = null;
      if (thermal) {
        const px = await pw.webContents.executeJavaScript("document.fonts.ready.then(() => document.querySelector('.rc').getBoundingClientRect().height)");
        let h = Math.ceil(px * 25.4 / 96 * 1.02) + 4; // print layout runs a little taller than screen on long Urdu bills
        if (h > 5000) h = 297; // extremely long bill: normal pages, rows never split
        size = { width: +thermal[1], height: h };
        await pw.webContents.insertCSS('@page{size:' + size.width + 'mm ' + h + 'mm;margin:0}');
      }
      return await fn(pw, size);
    } finally {
      pw.destroy(); fs.unlink(file, () => {});
    }
  }
  ipcMain.handle('print:printers', async () => {
    try { return (await win.webContents.getPrintersAsync()).map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault })); } catch (e) { return []; }
  });
  ipcMain.handle('print:html', async (_e, html, opts = {}) => withPage(html, (pw, size) => new Promise((resolve) => {
    const paper = size ? { width: Math.round(size.width * 1000), height: Math.round(size.height * 1000) } : opts.paper || 'A4';
    const o = { silent: !!opts.silent, printBackground: true, pageSize: paper, margins: { marginType: opts.thermal ? 'none' : 'default' } };
    if (opts.printer) o.deviceName = opts.printer; // empty: Windows' default printer
    pw.webContents.print(o, (ok, reason) => resolve({ ok, reason }));
  })));
  // Receipt printers: the bill as a picture in the printer's own language (ESC/POS), sent straight to it. See escpos.js.
  ipcMain.handle('print:receipt', async (_e, html, opts = {}) => {
    try {
      let printer = opts.printer;
      if (!printer) printer = ((await win.webContents.getPrintersAsync()).find((p) => p.isDefault) || {}).name;
      if (!printer) return { ok: false, reason: 'No printer selected' };
      return await require('./escpos').printReceipt(html, { printer, cut: opts.cut !== false, contentMm: +opts.contentMm || 72 });
    } catch (e) { return { ok: false, reason: e.message || String(e) }; }
  });
  // Save as PDF at the design's exact page size. PM_PDF_DIR (checks only) saves without asking.
  ipcMain.handle('print:pdf', async (_e, html, opts = {}) => {
    const name = String(opts.name || 'Bill').replace(/[^\w\- .]+/g, '_') + '.pdf';
    let file;
    if (process.env.PM_PDF_DIR) file = path.join(process.env.PM_PDF_DIR, name);
    else {
      const r = await dialog.showSaveDialog(win, { title: 'Save as PDF', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (r.canceled || !r.filePath) return { ok: false, reason: 'cancelled' };
      file = r.filePath;
    }
    try {
      const data = await withPage(html, (pw) => pw.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } }));
      fs.writeFileSync(file, data);
      return { ok: true, file };
    } catch (e) { return { ok: false, reason: e.message || String(e) }; }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1024, minHeight: 640,
    title: 'Poultry Manager', backgroundColor: '#F4F6FA', show: false, icon: path.join(__dirname, 'icon.ico'), // own icon in the title bar and taskbar
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  win.once('ready-to-show', () => { if (!process.env.PM_NO_MAXIMIZE) win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
// Windows groups the taskbar button by this id; it matches the installer's appId so the pinned/shortcut icon is ours, not Electron's
if (process.platform === 'win32') app.setAppUserModelId('pk.poultrymanager.app');
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
  if (!process.env.PM_NO_UPDATE) updates = setupUpdates({ send: (st) => { if (win && !win.isDestroyed()) win.webContents.send('update:event', st); }, backup: (note) => backups.run('safety', note) });
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { if (bio) bio.stop(); if (backups) backups.stop(); if (store) store.close(); });
