// Bridge between the screens and the database. Only these functions are exposed to the page.
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, ...a) => {
  const r = ipcRenderer.sendSync(ch, ...a);
  if (r && r.__error) throw new Error(r.__error);
  return r;
};

contextBridge.exposeInMainWorld('PM', {
  desktop: true,
  // data (synchronous: every save is on disk before the screen moves on)
  load: () => call('db:load'),
  commit: (changes) => call('db:commit', changes),
  replaceAll: (state) => call('db:replaceAll', state),
  putPhoto: (id, data) => call('db:putPhoto', id, data),
  getPhoto: (id) => call('db:getPhoto', id),
  // password
  authInfo: () => call('auth:info'),
  checkPassword: (pw) => call('auth:check', pw),
  setPassword: (oldPw, newPw) => call('auth:set', oldPw, newPw),
  // backups
  backupLog: () => call('backup:log'),
  backupNow: (kind, note) => ipcRenderer.invoke('backup:now', kind, note),
  chooseFolder: (current) => ipcRenderer.invoke('backup:chooseFolder', current),
  pickBackup: () => ipcRenderer.invoke('backup:pick'),
  restore: (file) => ipcRenderer.invoke('backup:restore', file),
  openFolder: (p) => ipcRenderer.invoke('app:openFolder', p),
  usbDrives: () => ipcRenderer.invoke('backup:usb'),
  onBackup: (fn) => { const h = (_e, entry) => fn(entry); ipcRenderer.on('backup:done', h); return () => ipcRenderer.removeListener('backup:done', h); },
  // printing
  print: (html, opts) => ipcRenderer.invoke('print:html', html, opts),
  savePdf: (html, opts) => ipcRenderer.invoke('print:pdf', html, opts),
  printers: () => ipcRenderer.invoke('print:printers'),
  info: () => call('app:info'),
});
