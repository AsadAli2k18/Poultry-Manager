// Run 4: thermal sale invoice (80 / 58 mm, Urdu / English, balance on / off). Balance figures must match the customer ledger,
// also for a reprint after later entries and for a corrected bill. PDFs go to PM_PDF_DIR (set by the runner).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { checks: {}, pdfs: [] };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
I18N.setLang('en');

Store.setSettings('shop', { ...Store.s.settings.shop, name_ur: 'النور پولٹری شاپ', name_en: 'Al-Noor Poultry Shop', addr_ur: 'مین بازار، جہلم', addr_en: 'Main Bazar, Jhelum',
  owners: [{ name_ur: 'احمد علی', name_en: 'Ahmed Ali', phone: '0300-0000001' }, { name_ur: 'حسن رضا', name_en: 'Hassan Raza', phone: '0300-0000002' }] });
const chicken = Store.s.items[0];
Store.saveItem({ ...chicken, opening: 5000 });
if (Store.s.items.length < 3) {
  Store.saveItem({ name_ur: 'گوشت', name_en: 'Chicken meat', unit: 'kg', rate: 640, opening: 500, active: true });
  Store.saveItem({ name_ur: 'کلیجی', name_en: 'Liver', unit: 'kg', rate: 700, opening: 500, active: true });
}
const cust = Store.saveParty('customer', { name_en: 'Thermal Check', name_ur: 'تھرمل چیک گاہک', phone: '0300-7777777', opening: 1250000 });
// an earlier bill on credit, then the bill under test: 3 lines, partial payment
Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 10, rate: 400 }], paidNow: 0 });
const lines = [{ itemId: chicken.id, qty: 152.35, rate: 412 }, { itemId: Store.s.items[1].id, qty: 20.5, rate: 640 }, { itemId: Store.s.items[2].id, qty: 7.25, rate: 700 }];
const inv = Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines, paidNow: 25000, payment: { method: 'cash' } });
const bb = Store.billBalance('customer', inv);
const lg = Store.ledger('customer', cust.id);
const iDoc = lg.rows.findIndex((r) => r.kind === 'doc' && r.doc.id === inv.id);
const rowDoc = lg.rows[iDoc]; const rowPay = lg.rows[iDoc + 1];
out.figures = bb;
ok('prev = ledger balance before the bill', bb.prev === rowDoc.balance - rowDoc.debit && bb.prev === 1254000, [bb.prev, rowDoc.balance - rowDoc.debit]);
ok('bill total = ledger debit', bb.total === rowDoc.debit && bb.total === Math.round(152.35 * 412 + 20.5 * 640 + 7.25 * 700), [bb.total, rowDoc.debit]);
ok('received = ledger credit of its payment', rowPay && rowPay.kind === 'pay' && rowPay.credit === bb.received && bb.received === 25000, rowPay && rowPay.credit);
ok('current balance = ledger balance after payment', bb.after === rowPay.balance && bb.after === Store.balance('customer', cust.id), [bb.after, rowPay.balance]);

const html80 = Print.build('sale', inv, { paper: 'T80', lang: 'ur', showBalance: true });
ok('80mm html has balance figures', [bb.prev, bb.total, bb.received, bb.after].every((n) => html80.includes(I18N.money(n))) && html80.includes('/*THERMAL:80*/'));
ok('balance off hides it', !Print.build('sale', inv, { paper: 'T80', showBalance: false }).includes(I18N.money(bb.prev)));
ok('Pakistani grouping', I18N.money(bb.after) === '12,93,' + String(bb.after).slice(-3) || /^\d{1,2},\d\d,\d\d,\d{3}$|^\d{1,2},\d\d,\d{3}$/.test(I18N.money(bb.after)), I18N.money(bb.after));
const fitted = await Print.fitHeight(html80);
const h = +/@page{size:80mm ([\d.]+)mm/.exec(fitted)[1];
ok('80mm page height fitted to the bill', h > 60 && h < 400, h);

// later activity must not change a reprint of this bill
Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: 5, rate: 400 }], paidNow: 0 });
Store.savePayment('in', { partyId: cust.id, amount: 100000, method: 'cash' });
const bb2 = Store.billBalance('customer', inv);
ok('reprint shows balance as of the bill', JSON.stringify(bb2) === JSON.stringify(bb), [bb, bb2]);

// PDFs: every combination
for (const paper of ['T80', 'T58']) for (const lang of ['ur', 'en']) for (const bal of [true, false]) {
  const name = 'bill-' + inv.no + '-' + paper.slice(1) + 'mm-' + lang + '-' + (bal ? 'balance' : 'nobalance');
  const r = await Print.savePdf(Print.build('sale', inv, { paper, lang, showBalance: bal }), name);
  out.pdfs.push(r && r.file); ok('pdf ' + name, r && r.ok, r);
}
// long bill: 60 lines on 58 mm stays one page
const long = Store.saveDoc('customer', { partyId: cust.id, date: Store.today(), lines: Array.from({ length: 60 }, (_, i) => ({ itemId: Store.s.items[i % 3].id, qty: 1 + i / 4, rate: 300 + i })), paidNow: 0 });
const rl = await Print.savePdf(Print.build('sale', long, { paper: 'T58', lang: 'ur' }), 'bill-' + long.no + '-58mm-long');
out.pdfs.push(rl && rl.file); ok('pdf long bill', rl && rl.ok, rl);

// corrected bill: the original's cancellation sits just before the replacement, payment carried over
const fix = Store.saveDoc('customer', { partyId: cust.id, date: inv.date, lines: lines.map((l) => ({ ...l, qty: l.qty + 1 })), replaces: inv.id, reason: 'check', paidNow: 0 });
const bf = Store.billBalance('customer', fix);
const lf = Store.ledger('customer', cust.id).rows; const iF = lf.findIndex((r) => r.kind === 'doc' && r.doc.id === fix.id);
ok('corrected bill: original reversed just before it', lf[iF - 1].kind === 'docCancel' && lf[iF - 1].doc.id === inv.id);
// previous = ledger balance before the reversal + the carried payment (it was taken with the original bill)
ok('corrected bill: previous balance from ledger', bf.prev === lf[iF - 1].balance - lf[iF - 1].debit + lf[iF - 1].credit - Store.total(inv) + 25000, [bf.prev, lf[iF - 1].balance]);
ok('corrected bill: current balance = ledger now', bf.after === Store.balance('customer', cust.id), [bf.after, Store.balance('customer', cust.id)]);
ok('corrected bill: payment carried', bf.received === 25000, bf.received);
ok('corrected bill: current = prev + bill - received', bf.after === bf.prev + bf.total - bf.received);
const rf = await Print.savePdf(Print.build('sale', fix, { paper: 'T80', lang: 'en' }), 'bill-' + fix.no + '-80mm-en-corrected');
out.pdfs.push(rf && rf.file);

// screens: designer in thermal mode and the print dialog checkbox
const pwIn = document.querySelector('.login input[type=password]');
if (pwIn) { pwIn.value = '1234'; pwIn.dispatchEvent(new Event('input', { bubbles: true })); await wait(150);
  document.querySelector('.login form, form.login-card').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(300); }
Store.setSettings('print.sale.paper', 'T80');
App.nav('settings', { tab: 'print' }); await wait(600);
ok('designer shows thermal options', /Bill number prefix|Columns/.test(document.body.innerText), document.body.innerText.slice(0, 200));
App.nav('sales-view', { id: inv.id }); await wait(300);
const pb = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Print'); if (pb) pb.click(); await wait(500);
ok('print dialog has per-bill balance checkbox', /Show balance on this bill/.test(document.body.innerText));
ok('print dialog has Save as PDF', /Save as PDF/.test(document.body.innerText));
out.failed = Object.keys(out.checks).filter((k) => out.checks[k] !== "ok").map((k) => k + ": " + out.checks[k]);
return out;
