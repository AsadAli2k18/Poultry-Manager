// Run 2: after a restart the data is all there, the missed weekly backup has run, then restore the run-1 backup.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { checks: {} };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
const cust = Store.s.customers[0]; const vend = Store.s.vendors.find((v) => !v.own_farm); const chicken = Store.s.items[0];
ok('data kept after restart', Store.s.invoices.length === 2 && Store.s.payments.length === 4);
ok('balances kept', Store.balance('customer', cust.id) === 14750 && Store.balance('vendor', vend.id) === 45000);
ok('stock kept', Store.stockOf(chicken.id) === 125);
ok('new password kept', Store.checkPassword('abcd') && !Store.checkPassword('1234'));
ok('activity log kept', Store.s.audit.some((a) => a.action === 'correct'));
ok('photo kept', Store.s.receipts.some((r) => r.photo && Store.photoSrc(r.photo).startsWith('data:image')));

// the weekly slot (Sunday 22:00) already passed with no automatic backup, so one must run shortly after start
await wait(11000);
const auto = Store.backupHistory().find((h) => h.kind === 'auto');
ok('missed backup ran on start', auto && auto.ok, Store.backupHistory().slice(0, 2));

// add a bill, then restore the run-1 backup: the bill must disappear
Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 3, rate: 400 }] });
ok('bill added', Store.s.invoices.length === 3);
const manual = Store.backupHistory().find((h) => h.kind === 'manual' && h.ok);
const r = await PM.restore(manual.path);
ok('restore ok', r.ok && r.safety, r);
out.failed = Object.entries(out.checks).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
return out;
