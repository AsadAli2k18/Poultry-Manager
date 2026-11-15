// Run 3: the restored data is what the backup held; the safety copy of the replaced data exists.
const out = { checks: {} };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
ok('restored data', Store.s.invoices.length === 2, Store.s.invoices.length);
ok('restored balance', Store.balance('customer', Store.s.customers[0].id) === 14750);
const h = Store.backupHistory();
ok('restore logged', h[0].kind === 'restore' && h[0].ok, h[0]);
ok('safety copy logged', h.some((x) => x.kind === 'safety' && x.ok && /restore/i.test(x.note)));
// erase all, then load sample data (both take safety copies first)
await Store.eraseAll();
ok('erase all', Store.s.invoices.length === 0 && Store.s.customers.length === 0);
await Store.loadSample();
ok('sample data', Store.s.invoices.length > 100 && Store.s.settings.sample === true);
out.failed = Object.entries(out.checks).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
out.safetyCopies = Store.backupHistory().filter((x) => x.kind === 'safety').length;
return out;
