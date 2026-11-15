// Poultry Manager — backups (main process).
// A backup is a complete, verified copy of the SQLite database file.
// Schedule: daily / weekly / monthly at a set time. If the PC was off at that time,
// the backup runs as soon as the app is opened again.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { inspectBackup } = require('./db');

const PREFIX = 'PoultryManager-';
const pad = (n) => String(n).padStart(2, '0');
// Shop time (Pakistan), same clock the screens use
const shopNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// A backup must be one self-contained file (no -wal / -shm side files), so it can be copied anywhere.
function singleFile(file) {
  const Database = require('better-sqlite3');
  const db = new Database(file);
  try { db.pragma('journal_mode = DELETE'); } finally { db.close(); }
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(file + ext); } catch (e) { /* none */ } }
}

class Backups {
  constructor({ store, dirs, onChange }) {
    this.store = store; // db.Store
    this.dirs = dirs; // { root, data, backups, safety }
    this.onChange = onChange || (() => {});
    this.logFile = path.join(dirs.root, 'backup-log.json');
    this.running = null;
    this.timer = null;
  }

  log() { try { return JSON.parse(fs.readFileSync(this.logFile, 'utf8')); } catch (e) { return []; } }
  writeLog(list) { fs.writeFileSync(this.logFile, JSON.stringify(list.slice(0, 300), null, 1)); }
  addLog(entry) { const l = this.log(); l.unshift(entry); this.writeLog(l); this.onChange(entry); }

  settings() {
    const s = this.store.getJSON('settings');
    const b = (s && s.backup) || {};
    return { enabled: b.enabled !== false, frequency: b.frequency || 'weekly', day: b.day == null ? 0 : +b.day, time: b.time || '22:00', folder: b.folder || this.dirs.backups, usb: !!b.usb, keep: +b.keep || 12 };
  }

  // most recent scheduled time at or before now
  lastSlot(b, now = shopNow()) {
    const [hh, mm] = String(b.time).split(':').map(Number);
    for (let i = 0; i < 62; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(hh || 0, mm || 0, 0, 0);
      if (d > now) continue;
      if (b.frequency === 'daily') return d;
      if (b.frequency === 'weekly' && d.getDay() === b.day) return d;
      if (b.frequency === 'monthly' && d.getDate() === 1) return d;
    }
    return null;
  }

  isDue() {
    const b = this.settings();
    if (!b.enabled || this.store.isEmpty()) return false;
    const slot = this.lastSlot(b); if (!slot) return false;
    const s = stamp(slot);
    return !this.log().some((e) => e.ok && e.kind === 'auto' && e.at >= s);
  }

  start() {
    const tick = () => { if (this.isDue() && !this.running) this.run('auto').catch(() => {}); };
    setTimeout(tick, 8000); // catch-up shortly after the app opens
    this.timer = setInterval(tick, 60 * 1000);
  }
  stop() { clearInterval(this.timer); }

  usbDrives() {
    if (process.platform !== 'win32') return Promise.resolve([]);
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' | ForEach-Object { $_.DeviceID }"],
        { timeout: 15000, windowsHide: true }, (err, out) => resolve(err ? [] : String(out).split(/\r?\n/).map((x) => x.trim()).filter((x) => /^[A-Z]:$/.test(x))));
    });
  }

  prune(folder, keep) {
    try {
      fs.readdirSync(folder).filter((f) => f.startsWith(PREFIX) && /-(auto|manual)\.db$/.test(f)).sort().reverse()
        .slice(keep).forEach((f) => { try { fs.unlinkSync(path.join(folder, f)); } catch (e) { /* in use */ } });
    } catch (e) { /* folder gone */ }
  }

  // Make one backup. kind: auto | manual | safety
  run(kind = 'manual', note = '') {
    if (this.running) return this.running;
    this.running = (async () => {
      const b = this.settings();
      const now = shopNow();
      let folder = kind === 'safety' ? this.dirs.safety : b.folder;
      const base = `${PREFIX}${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      let name = `${base}-${kind}.db`;
      for (let n = 2; fs.existsSync(path.join(folder, name)); n++) name = `${base}${String.fromCharCode(96 + n)}-${kind}.db`; // never overwrite a backup
      const entry = { id: Date.now().toString(36), at: stamp(now), kind, note, file: name, where: folder, size: 0, usb: false, ok: false };
      try {
        try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {
          entry.warning = 'Folder not available, saved to the default folder instead: ' + folder;
          folder = this.dirs.backups; fs.mkdirSync(folder, { recursive: true }); entry.where = folder;
        }
        const dest = path.join(folder, name);
        const tmp = dest + '.part';
        await this.store.backupTo(tmp);
        singleFile(tmp);
        const check = inspectBackup(tmp);
        if (!check.ok) { try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ } throw new Error('Backup copy failed its check'); }
        fs.renameSync(tmp, dest);
        entry.size = Math.max(1, Math.round(fs.statSync(dest).size / 1024));
        entry.path = dest; entry.ok = true;
        if (kind === 'safety') this.pruneSafety(); else this.prune(folder, b.keep);
        if (b.usb && kind !== 'safety') {
          const drives = await this.usbDrives();
          for (const d of drives) {
            try {
              const uf = path.join(d + '\\', 'PoultryManager-Backups');
              fs.mkdirSync(uf, { recursive: true }); fs.copyFileSync(dest, path.join(uf, name)); this.prune(uf, b.keep);
              entry.usb = true; entry.usbPath = uf; break;
            } catch (e) { entry.usbError = e.message; }
          }
          if (!drives.length) entry.usbNote = 'No USB drive plugged in';
        }
      } catch (e) {
        entry.error = e.message;
      }
      this.addLog(entry);
      return entry;
    })();
    return this.running.finally(() => { this.running = null; });
  }

  pruneSafety() { this.prune(this.dirs.safety, 1000); try { fs.readdirSync(this.dirs.safety).filter((f) => f.endsWith('-safety.db')).sort().reverse().slice(10).forEach((f) => fs.unlinkSync(path.join(this.dirs.safety, f))); } catch (e) { /* ignore */ } }

  inspect(file) { return { ...inspectBackup(file), file, name: path.basename(file), size: Math.round(fs.statSync(file).size / 1024) }; }

  // Replace the live database with a backup. A safety copy of the current data is taken first.
  async restore(file) {
    const info = inspectBackup(file);
    if (!info.ok) return { ok: false, error: 'invalid' };
    const safety = await this.run('safety', 'Before restore');
    if (!safety.ok) return { ok: false, error: 'safety', detail: safety.error };
    const live = this.store.file;
    const staged = live + '.restore';
    fs.copyFileSync(file, staged);
    this.store.close();
    try {
      for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(live + ext); } catch (e) { /* none */ } }
      fs.renameSync(staged, live);
    } finally {
      this.store.open();
    }
    this.addLog({ id: Date.now().toString(36), at: stamp(shopNow()), kind: 'restore', file: path.basename(file), where: path.dirname(file), size: Math.round(fs.statSync(file).size / 1024), ok: true, safety: safety.path });
    return { ok: true, safety: safety.path };
  }
}

module.exports = { Backups, shopNow, stamp };
