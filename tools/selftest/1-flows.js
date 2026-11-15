// Run 1: fresh database, every kind of entry, corrections, cancels, backup, password.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const btn = (txt) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === txt); if (!b) throw new Error('No button "' + txt + '" at ' + location.hash + ' | ' + JSON.stringify(out.checks) + ' | ' + document.body.innerText.slice(0, 300)); return b; };
const typeIn = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const out = { checks: {} };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
I18N.setLang('en');

ok('desktop mode', Store.desktop === true);
ok('fresh: no customers', Store.s.customers.length === 0);
ok('fresh: own farm vendor', Store.s.vendors.length === 1 && Store.s.vendors[0].own_farm);
ok('fresh: first-time password', Store.defaultPassword() === true && Store.checkPassword('1234') && !Store.checkPassword('9999'));

// login through the screen
typeIn(document.querySelector('.login input[type=password]'), '1234'); await wait(150);
document.querySelector('.login form, form.login-card').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await wait(300);
ok('login opens the app', !!document.querySelector('.sidebar'));

// setup: item rate, customer, vendor (with opening balances)
const chicken = Store.s.items[0];
Store.saveItem({ ...chicken, rate: 400, opening: 50 });
const cust = Store.saveParty('customer', { name_en: 'Test Customer', name_ur: 'ٹیسٹ گاہک', phone: '0300-1', opening: 10000 });
const vend = Store.saveParty('vendor', { name_en: 'Test Vendor', name_ur: 'ٹیسٹ سپلائر', opening: 20000, own_farm: false });
ok('codes', cust.code === 'C-001' && vend.code === 'V-002', [cust.code, vend.code]);

// stock in from vendor 100 kg @ 300 = 30000, paid 5000 now
Store.saveDoc('vendor', { partyId: vend.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 100, rate: 300 }], vendorBillNo: 'VB-1', paidNow: 5000, payment: { method: 'cash' } });
ok('stock after receipt', Store.stockOf(chicken.id) === 150, Store.stockOf(chicken.id));
ok('vendor balance', Store.balance('vendor', vend.id) === 45000, Store.balance('vendor', vend.id));

// sale 20 kg @ 410 = 8200, received 2000
const inv = Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 20, rate: 410 }], paidNow: 2000, payment: { method: 'cash' } });
ok('customer balance', Store.balance('customer', cust.id) === 16200, Store.balance('customer', cust.id));

// --- correction through the screens: change 20 kg to 25 kg
App.nav('sales-view', { id: inv.id }); await wait(300);
btn('Correct').click(); await wait(300);
typeIn(document.querySelector('.lines input[type=number]'), '25'); await wait(150);
btn('Save').click(); await wait(300);
const dlg = document.querySelector('.modal');
typeIn(dlg.querySelector('input'), 'Weighed again'); await wait(100);
btn('Save correction').click(); await wait(400);
const oldInv = Store.s.invoices.find((x) => x.id === inv.id);
const newInv = Store.s.invoices.find((x) => x.replaces === inv.id);
ok('correction: old cancelled', oldInv.status === 'cancelled' && /Weighed again/.test(oldInv.cancelReason), oldInv.cancelReason);
ok('correction: new bill', newInv && newInv.lines[0].qty === 25 && newInv.no === inv.no + 1);
ok('correction: payment moved to new bill', Store.s.payments.some((p) => p.docId === newInv.id && p.amount === 2000));
ok('correction: balance', Store.balance('customer', cust.id) === 10000 + 25 * 410 - 2000, Store.balance('customer', cust.id));
ok('correction: stock', Store.stockOf(chicken.id) === 125, Store.stockOf(chicken.id));
ok('correction: screen moved to new bill', decodeURIComponent(location.hash).includes(newInv.id));

// --- cancel a receipt (vendor bill) and check stock and balance reverse
const rec2 = Store.saveDoc('vendor', { partyId: vend.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 10, rate: 300 }] });
Store.cancelDoc('vendor', rec2.id, 'Entered twice');
ok('cancel receipt: stock back', Store.stockOf(chicken.id) === 125);
ok('cancel receipt: balance back', Store.balance('vendor', vend.id) === 45000);

// --- recovery, then correct it (wrong amount)
const rc = Store.savePayment('in', { partyId: cust.id, amount: 3000, method: 'easypaisa', ref: 'TID123' });
const rc2 = Store.savePayment('in', { partyId: cust.id, amount: 3500, method: 'easypaisa', ref: 'TID123', replaces: rc.id, reason: 'Amount typed wrong' });
ok('payment correction', Store.s.payments.find((p) => p.id === rc.id).status === 'cancelled' && rc2.replaces === rc.id);
ok('payment correction: balance', Store.balance('customer', cust.id) === 10000 + 25 * 410 - 2000 - 3500, Store.balance('customer', cust.id));

// --- expense, correct it, cancel another
const ex = Store.saveExpense({ date: Store.today(), categoryId: Store.s.categories[1].id, amount: 1500, method: 'cash', desc: 'Loader' });
Store.saveExpense({ date: Store.today(), categoryId: Store.s.categories[1].id, amount: 1200, method: 'cash', desc: 'Loader', replaces: ex.id, reason: 'Wrong amount' });
const ex3 = Store.saveExpense({ date: Store.today(), categoryId: Store.s.categories[0].id, amount: 900, method: 'cash', desc: 'x' });
Store.cancelExpense(ex3.id, 'Not ours');
ok('expenses total', Store.summary(Store.today(), Store.today()).expTotal === 1200, Store.summary(Store.today(), Store.today()).expTotal);

// --- stock correction and cancelling it
const adj = Store.saveAdjustment({ itemId: chicken.id, date: Store.today(), qty: -5, reason: 'Mortality' });
ok('adjustment', Store.stockOf(chicken.id) === 120);
Store.cancelAdjustment(adj.id, 'Birds were fine');
ok('adjustment cancelled', Store.stockOf(chicken.id) === 125);

// --- photo is stored apart from the bill
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const rec3 = Store.saveDoc('vendor', { partyId: vend.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 1, rate: 300 }], photo: px });
ok('photo stored separately', rec3.photo.startsWith('db:') && Store.photoSrc(rec3.photo) === px);
Store.cancelDoc('vendor', rec3.id, 'test');

// --- password
const pw1 = Store.changePassword('wrong', 'abcd');
const pw2 = Store.changePassword('1234', 'abcd');
ok('password change', !pw1.ok && pw2.ok && Store.checkPassword('abcd') && !Store.checkPassword('1234') && !Store.defaultPassword());

// --- backup screen + Backup now
App.nav('settings', { tab: 'backup' }); await wait(300);
const e = await Store.backupNow('manual');
ok('backup ok', e.ok && e.size > 0, e);
await wait(300);
ok('backup in history', Store.backupHistory()[0].file === e.file);
ok('backup screen lists it', document.querySelector('.main').textContent.includes(e.file));

ok('print builds', Print.build('sale', newInv).includes('<!doctype html>'));

out.summary = {
  customerBalance: Store.balance('customer', cust.id), vendorBalance: Store.balance('vendor', vend.id), stock: Store.stockOf(chicken.id),
  invoices: Store.s.invoices.length, payments: Store.s.payments.length, audit: Store.s.audit.length, backup: e.path,
};
out.failed = Object.entries(out.checks).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
return out;
