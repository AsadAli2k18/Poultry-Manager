// Poultry Manager — SQLite database (main process only).
// One file on the PC: Documents\PoultryManager\data\poultry.db
// Every record keeps its full JSON in `data`; the key fields are also real columns so the
// database can be queried, checked and exported without the app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 3; // 2: drafts, 3: CNIC column + fingerprints

// table -> extra columns: [name, SQL type, (record) => value]
const num = (v) => (v == null || v === '' ? null : +v);
const docTotal = (r) => Math.round((r.lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0));
const TABLES = {
  items: [['name_ur', 'TEXT', (r) => r.name_ur], ['name_en', 'TEXT', (r) => r.name_en], ['unit', 'TEXT', (r) => r.unit], ['rate', 'REAL', (r) => num(r.rate)], ['opening', 'REAL', (r) => num(r.opening)], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  customers: [['code', 'TEXT', (r) => r.code], ['name_ur', 'TEXT', (r) => r.name_ur], ['name_en', 'TEXT', (r) => r.name_en], ['phone', 'TEXT', (r) => r.phone], ['cnic', 'TEXT', (r) => (r.cnic || '').replace(/\D/g, '') || null], ['opening', 'REAL', (r) => num(r.opening)], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  vendors: [['code', 'TEXT', (r) => r.code], ['name_ur', 'TEXT', (r) => r.name_ur], ['name_en', 'TEXT', (r) => r.name_en], ['phone', 'TEXT', (r) => r.phone], ['cnic', 'TEXT', (r) => (r.cnic || '').replace(/\D/g, '') || null], ['opening', 'REAL', (r) => num(r.opening)], ['own_farm', 'INTEGER', (r) => (r.own_farm ? 1 : 0)], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  categories: [['name_ur', 'TEXT', (r) => r.name_ur], ['name_en', 'TEXT', (r) => r.name_en], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  methods: [['name_ur', 'TEXT', (r) => r.name_ur], ['name_en', 'TEXT', (r) => r.name_en], ['is_cash', 'INTEGER', (r) => (r.cash ? 1 : 0)], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  invoices: [['no', 'INTEGER', (r) => r.no], ['date', 'TEXT', (r) => r.date], ['party_id', 'TEXT', (r) => r.customerId], ['total', 'REAL', docTotal], ['status', 'TEXT', (r) => r.status], ['replaces', 'TEXT', (r) => r.replaces || null]],
  receipts: [['no', 'INTEGER', (r) => r.no], ['date', 'TEXT', (r) => r.date], ['party_id', 'TEXT', (r) => r.vendorId], ['total', 'REAL', docTotal], ['status', 'TEXT', (r) => r.status], ['replaces', 'TEXT', (r) => r.replaces || null]],
  payments: [['no', 'INTEGER', (r) => r.no], ['dir', 'TEXT', (r) => r.dir], ['date', 'TEXT', (r) => r.date], ['party_id', 'TEXT', (r) => r.partyId], ['amount', 'REAL', (r) => num(r.amount)], ['method', 'TEXT', (r) => r.method], ['ref', 'TEXT', (r) => r.ref], ['doc_id', 'TEXT', (r) => r.docId || null], ['status', 'TEXT', (r) => r.status]],
  adjustments: [['date', 'TEXT', (r) => r.date], ['item_id', 'TEXT', (r) => r.itemId], ['qty', 'REAL', (r) => num(r.qty)], ['reason', 'TEXT', (r) => r.reason], ['status', 'TEXT', (r) => r.status || 'active']],
  expenses: [['no', 'INTEGER', (r) => r.no], ['date', 'TEXT', (r) => r.date], ['category_id', 'TEXT', (r) => r.categoryId], ['amount', 'REAL', (r) => num(r.amount)], ['method', 'TEXT', (r) => r.method], ['status', 'TEXT', (r) => r.status]],
  // unfinished bills: no number, no effect on stock or balances until saved as a real bill
  drafts: [['kind', 'TEXT', (r) => r.kind], ['date', 'TEXT', (r) => r.date], ['party_id', 'TEXT', (r) => r.partyId || null], ['total', 'REAL', docTotal], ['saved_at', 'TEXT', (r) => r.savedAt]],
  // fingerprint templates (never pictures), one record per enrolled finger; removing one keeps it as inactive
  biometrics: [['party_id', 'TEXT', (r) => r.partyId], ['finger', 'TEXT', (r) => r.finger], ['sdk', 'TEXT', (r) => r.sdk], ['quality', 'INTEGER', (r) => num(r.quality)], ['enrolled_at', 'TEXT', (r) => r.enrolledAt], ['active', 'INTEGER', (r) => (r.active ? 1 : 0)]],
  audit: [['at', 'TEXT', (r) => r.at], ['action', 'TEXT', (r) => r.action], ['ref', 'TEXT', (r) => r.ref]],
};
const DOC_TABLES = { invoices: 'customerId', receipts: 'vendorId' };
const AUDIT_LOAD = 1000; // the app shows the latest entries; all stay in the database

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const h = crypto.scryptSync(String(pw), stored.salt, 32);
  const want = Buffer.from(stored.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.open();
  }

  open() {
    this.db = new Database(this.file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL'); // a power cut must not lose a saved bill
    this.db.pragma('foreign_keys = OFF');
    this.migrate();
    this.prepare();
  }

  close() { if (this.db) { try { this.db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ } this.db.close(); this.db = null; } }

  migrate() {
    const db = this.db;
    db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const v = +(this.getMeta('schema_version') || 0);
    if (v < 1) {
      db.transaction(() => {
        for (const [t, cols] of Object.entries(TABLES)) {
          const extra = cols.map(([n, ty]) => `${n} ${ty}`).join(', ');
          db.exec(`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, ${extra}, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        }
        db.exec(`CREATE TABLE IF NOT EXISTS doc_lines (doc_table TEXT NOT NULL, doc_id TEXT NOT NULL, line INTEGER NOT NULL, item_id TEXT, qty REAL, rate REAL, amount REAL, PRIMARY KEY (doc_table, doc_id, line))`);
        db.exec('CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)');
        db.exec(`CREATE INDEX IF NOT EXISTS ix_inv_party ON invoices(party_id, date);
          CREATE INDEX IF NOT EXISTS ix_rec_party ON receipts(party_id, date);
          CREATE INDEX IF NOT EXISTS ix_pay_party ON payments(party_id, date);
          CREATE INDEX IF NOT EXISTS ix_exp_date ON expenses(date);
          CREATE INDEX IF NOT EXISTS ix_audit_at ON audit(at);
          CREATE INDEX IF NOT EXISTS ix_lines_item ON doc_lines(item_id)`);
        this.setMeta('schema_version', String(SCHEMA_VERSION));
        this.setMeta('created_at', new Date().toISOString());
      })();
    }
    if (v < 2) {
      const extra = TABLES.drafts.map(([n, ty]) => `${n} ${ty}`).join(', ');
      db.exec(`CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, ${extra}, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      this.setMeta('schema_version', '2');
    }
    if (v < 3) {
      db.transaction(() => {
        for (const t of ['customers', 'vendors']) if (!db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'cnic')) db.exec(`ALTER TABLE ${t} ADD COLUMN cnic TEXT`);
        const extra = TABLES.biometrics.map(([n, ty]) => `${n} ${ty}`).join(', ');
        db.exec(`CREATE TABLE IF NOT EXISTS biometrics (id TEXT PRIMARY KEY, ${extra}, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        db.exec('CREATE INDEX IF NOT EXISTS ix_bio_party ON biometrics(party_id)');
        this.setMeta('schema_version', '3');
      })();
    }
    // later schema changes go here: if (v < 4) { ... }
  }

  prepare() {
    this.st = {};
    for (const [t, cols] of Object.entries(TABLES)) {
      const names = ['id', ...cols.map((c) => c[0]), 'data', 'updated_at'];
      this.st[t] = {
        upsert: this.db.prepare(`INSERT INTO ${t} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})
          ON CONFLICT(id) DO UPDATE SET ${names.slice(1).map((n) => `${n}=excluded.${n}`).join(',')}`),
        del: this.db.prepare(`DELETE FROM ${t} WHERE id = ?`),
      };
    }
    this.st.lineDel = this.db.prepare('DELETE FROM doc_lines WHERE doc_table = ? AND doc_id = ?');
    this.st.lineIns = this.db.prepare('INSERT INTO doc_lines (doc_table, doc_id, line, item_id, qty, rate, amount) VALUES (?,?,?,?,?,?,?)');
  }

  getMeta(k) { const r = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(k); return r ? r.value : null; }
  setMeta(k, v) { this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v); }
  getJSON(k) { const v = this.getMeta(k); return v == null ? null : JSON.parse(v); }
  setJSON(k, v) { this.setMeta(k, JSON.stringify(v)); }

  isEmpty() { return this.getMeta('settings') == null; }

  // Whole state for the screens. Audit: newest entries only.
  load() {
    if (this.isEmpty()) return null;
    const state = { version: 1, settings: this.getJSON('settings'), counters: this.getJSON('counters') || {} };
    for (const t of Object.keys(TABLES)) {
      const sql = t === 'audit' ? `SELECT data FROM audit ORDER BY at DESC, rowid DESC LIMIT ${AUDIT_LOAD}` : `SELECT data FROM ${t} ORDER BY rowid`;
      state[t] = this.db.prepare(sql).all().map((r) => JSON.parse(r.data));
    }
    return state;
  }

  writeRecord(t, rec, now) {
    const cols = TABLES[t];
    if (!cols) throw new Error('Unknown table ' + t);
    if (!rec || !rec.id) throw new Error('Record without id in ' + t);
    this.st[t].upsert.run(rec.id, ...cols.map((c) => { const v = c[2](rec); return v === undefined ? null : v; }), JSON.stringify(rec), now);
    if (DOC_TABLES[t]) {
      this.st.lineDel.run(t, rec.id);
      (rec.lines || []).forEach((l, i) => this.st.lineIns.run(t, rec.id, i + 1, l.itemId, +l.qty || 0, +l.rate || 0, Math.round((+l.qty || 0) * (+l.rate || 0))));
    }
  }

  // changes = { upserts: {table: [rec]}, deletes: {table: [id]}, settings?, counters? }
  commit(changes) {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      for (const [t, list] of Object.entries(changes.upserts || {})) list.forEach((rec) => this.writeRecord(t, rec, now));
      for (const [t, ids] of Object.entries(changes.deletes || {})) {
        if (!TABLES[t]) throw new Error('Unknown table ' + t);
        ids.forEach((id) => { this.st[t].del.run(id); if (DOC_TABLES[t]) this.st.lineDel.run(t, id); });
      }
      if (changes.settings) this.setJSON('settings', changes.settings);
      if (changes.counters) this.setJSON('counters', changes.counters);
    })();
    return true;
  }

  // Replace every record (first run, load sample data, erase all). Password and photos are kept.
  replaceAll(state) {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      for (const t of Object.keys(TABLES)) this.db.exec(`DELETE FROM ${t}`);
      this.db.exec('DELETE FROM doc_lines');
      for (const t of Object.keys(TABLES)) (state[t] || []).forEach((rec) => this.writeRecord(t, rec, now));
      this.setJSON('settings', state.settings);
      this.setJSON('counters', state.counters || {});
    })();
  }

  // enrolled fingers of active customers, for matching a scan
  biometricGallery() {
    const active = new Set(this.db.prepare('SELECT id FROM customers WHERE active = 1').all().map((r) => r.id));
    return this.db.prepare('SELECT data FROM biometrics WHERE active = 1').all().map((r) => JSON.parse(r.data)).filter((b) => active.has(b.partyId))
      .map((b) => ({ partyId: b.partyId, finger: b.finger, templates: b.templates || [] }));
  }

  putPhoto(id, data) { this.db.prepare('INSERT OR REPLACE INTO photos (id, data, created_at) VALUES (?, ?, ?)').run(id, data, new Date().toISOString()); }
  getPhoto(id) { const r = this.db.prepare('SELECT data FROM photos WHERE id = ?').get(id); return r ? r.data : ''; }

  // owner password (hashed with scrypt; never stored as plain text)
  authInfo() { const a = this.getJSON('auth'); return { isDefault: !a || !!a.isDefault }; }
  ensureAuth() { if (!this.getJSON('auth')) this.setJSON('auth', { ...hashPassword('1234'), isDefault: true }); }
  checkPassword(pw) { this.ensureAuth(); return checkPassword(pw, this.getJSON('auth')); }
  setPassword(oldPw, newPw) {
    if (!this.checkPassword(oldPw)) return { ok: false, error: 'wrong' };
    if (String(newPw).length < 4) return { ok: false, error: 'short' };
    this.setJSON('auth', { ...hashPassword(newPw), isDefault: false });
    return { ok: true };
  }

  // safe copy of the live database (works while the app is running)
  backupTo(dest) { return this.db.backup(dest); }

  counts() {
    const out = {};
    for (const t of ['invoices', 'receipts', 'payments', 'expenses', 'customers', 'vendors']) out[t] = this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
    return out;
  }
}

// Checks that a file is a Poultry Manager database before it is restored.
function inspectBackup(file) {
  let db;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const ok = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('meta','invoices','payments')").all().length === 3;
    if (!ok) return { ok: false };
    const v = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get();
    const s = db.prepare("SELECT value FROM meta WHERE key='settings'").get();
    const n = db.prepare('SELECT (SELECT COUNT(*) FROM invoices) AS inv, (SELECT COUNT(*) FROM payments) AS pay').get();
    const integrity = db.pragma('integrity_check', { simple: true });
    return { ok: !!v && !!s && integrity === 'ok', version: v ? +v.value : 0, invoices: n.inv, payments: n.pay, integrity };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally { if (db) db.close(); }
}

module.exports = { Store, inspectBackup, SCHEMA_VERSION, TABLES };
