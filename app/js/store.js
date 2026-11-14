/* Poultry Manager — demo data store.
 * Holds all records in memory (persisted to localStorage for the demo) and
 * computes every balance, stock figure and status from the records, the same
 * way the real backend will. Nothing here is stored as a running total.
 */
(function () {
  'use strict';
  const LS_KEY = 'pm.demo.v4';
  const listeners = new Set();
  let S = null;

  /* ---------- helpers ---------- */
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  const nowTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
  const round = (n) => Math.round(n);
  const r2 = (n) => Math.round(n * 100) / 100;
  const sortKey = (o) => (o.date || '') + ' ' + (o.time || '00:00') + ' ' + String(o.seq || 0).padStart(6, '0');
  const lineTotal = (lines) => round((lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0));

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- seed (dummy data) ---------- */
  function seed() {
    const rnd = mulberry32(20261114);
    const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const tm = (h1, h2) => pad(ri(h1, h2)) + ':' + pad(ri(0, 11) * 5);
    const end = today();
    const goLive = addDays(end, -44);
    let seq = 0;

    const st = {
      version: 1,
      seededAt: end,
      settings: {
        goLive,
        password: '1234',
        theme: 'light',
        shop: {
          name_ur: 'النور مرغ منڈی', name_en: 'Al-Noor Murgh Mandi',
          sub_ur: 'اینڈ مچھلی منڈی', sub_en: '& Machhli Mandi',
          addr_ur: 'مین بازار، دکان نمبر 1', addr_en: 'Shop No. 1, Main Bazar',
          owners: [
            { name_ur: 'احمد علی', name_en: 'Ahmed Ali', phone: '0300-0000001' },
            { name_ur: 'حسن رضا', name_en: 'Hassan Raza', phone: '0300-0000002' },
          ],
          logo: '',
        },
        accounts: ['Meezan Bank ••4521', 'Easypaisa 0300-0000001', 'JazzCash 0300-0000002'],
        print: defaultPrint(),
        backup: {
          enabled: true, frequency: 'weekly', day: 0, time: '22:00',
          folder: 'D:\\PoultryManager\\Backups', usb: true, keep: 12,
          history: [],
        },
      },
      items: [
        { id: 'i1', name_ur: 'مرغی (زندہ)', name_en: 'Chicken (live)', unit: 'kg', rate: 330, cost: null, opening: 800, active: true },
        { id: 'i2', name_ur: 'گوشت', name_en: 'Chicken meat', unit: 'kg', rate: 520, cost: null, opening: 120, active: true },
        { id: 'i3', name_ur: 'ڈرم سٹک', name_en: 'Drumstick', unit: 'kg', rate: 600, cost: null, opening: 40, active: true },
        { id: 'i4', name_ur: 'کلیجی', name_en: 'Liver', unit: 'kg', rate: 770, cost: null, opening: 15, active: true },
        { id: 'i5', name_ur: 'مچھلی', name_en: 'Fish', unit: 'kg', rate: 650, cost: null, opening: 0, active: true },
      ],
      customers: [
        { id: 'c1', code: 'C-001', name_ur: 'رحمت پولٹری', name_en: 'Rehmat Poultry', phone: '0300-0000101', address: 'Railway Road', opening: 948641, note: '', active: true },
        { id: 'c2', code: 'C-002', name_ur: 'نادر حسین', name_en: 'Nadir Hussain', phone: '0300-0000102', address: 'Civil Lines', opening: 0, note: '', active: true },
        { id: 'c3', code: 'C-003', name_ur: 'حاجی رفیق ہوٹل', name_en: 'Haji Rafiq Hotel', phone: '0300-0000103', address: 'GT Road', opening: 45000, note: '', active: true },
        { id: 'c4', code: 'C-004', name_ur: 'المدینہ ریسٹورنٹ', name_en: 'Al-Madina Restaurant', phone: '0300-0000104', address: 'Main Bazar', opening: 0, note: '', active: true },
        { id: 'c5', code: 'C-005', name_ur: 'بلال چکن شاپ', name_en: 'Bilal Chicken Shop', phone: '0300-0000105', address: 'Chowk Bazar', opening: 120500, note: '', active: true },
        { id: 'c6', code: 'C-006', name_ur: 'ندیم کڑاہی', name_en: 'Nadeem Karahi', phone: '0300-0000106', address: 'Model Town', opening: 18000, note: '', active: true },
        { id: 'c7', code: 'C-007', name_ur: 'ظفر کیٹرنگ', name_en: 'Zafar Catering', phone: '0300-0000107', address: 'Sadar', opening: 0, note: '', active: true },
        { id: 'c8', code: 'C-008', name_ur: 'شاہد محمود', name_en: 'Shahid Mehmood', phone: '0300-0000108', address: 'Main Bazar', opening: 0, note: 'Pays cash', active: true },
      ],
      vendors: [
        { id: 'v1', code: 'V-001', name_ur: 'جاوید اقبال', name_en: 'Javed Iqbal', phone: '0300-0000201', address: 'Canal Road', opening: 657920, own_farm: false, note: 'Payments collected by Kamran', active: true },
        { id: 'v2', code: 'V-002', name_ur: 'اپنا فارم', name_en: 'Own Farm', phone: '', address: 'Sohawa Road', opening: 0, own_farm: true, note: '', active: true },
        { id: 'v3', code: 'V-003', name_ur: 'گرین ویلی پولٹری فارم', name_en: 'Green Valley Poultry Farm', phone: '0300-0000202', address: 'Village Road', opening: 150000, own_farm: false, note: '', active: true },
        { id: 'v4', code: 'V-004', name_ur: 'الرحمان فش ٹریڈرز', name_en: 'Al-Rehman Fish Traders', phone: '0300-0000203', address: 'River Side', opening: 0, own_farm: false, note: '', active: true },
      ],
      categories: [
        { id: 'e1', name_ur: 'بل', name_en: 'Bills', active: true },
        { id: 'e2', name_ur: 'ٹرانسپورٹ', name_en: 'Transport', active: true },
        { id: 'e3', name_ur: 'مزدوری', name_en: 'Labour', active: true },
        { id: 'e4', name_ur: 'دکان کا سامان', name_en: 'Shop supplies', active: true },
      ],
      methods: [
        { id: 'cash', name_ur: 'نقد', name_en: 'Cash', cash: true, active: true },
        { id: 'online', name_ur: 'آن لائن ٹرانسفر', name_en: 'Online transfer', active: true },
        { id: 'easypaisa', name_ur: 'ایزی پیسہ', name_en: 'Easypaisa', active: true },
        { id: 'jazzcash', name_ur: 'جاز کیش', name_en: 'JazzCash', active: true },
        { id: 'bank', name_ur: 'بینک جمع', name_en: 'Bank deposit', active: true },
        { id: 'cheque', name_ur: 'چیک', name_en: 'Cheque', active: true },
      ],
      invoices: [], receipts: [], payments: [], adjustments: [], expenses: [], audit: [],
      counters: { invoice: 1000, receipt: 200, in: 500, out: 300, expense: 0 },
    };

    const stock = {}; st.items.forEach((i) => (stock[i.id] = i.opening));
    const bal = {}; st.customers.concat(st.vendors).forEach((p) => (bal[p.id] = p.opening));
    const weekSales = {}; // customer -> amount since last recovery
    const tid = () => 'TID' + ri(10000000, 99999999);
    const addReceipt = (date, vendorId, lines, extra = {}) => {
      lines = lines.filter((l) => l.qty > 0);
      if (!lines.length) return;
      const r = { id: uid(), no: ++st.counters.receipt, date, time: tm(5, 9), seq: ++seq, vendorId, vendorBillNo: extra.bill || '', vehicle: extra.vehicle || '', note: '', lines, status: 'active' };
      st.receipts.push(r);
      lines.forEach((l) => (stock[l.itemId] = r2(stock[l.itemId] + l.qty)));
      bal[vendorId] += lineTotal(lines);
    };
    const addInvoice = (date, customerId, lines, received, pay) => {
      lines = lines.map((l) => ({ ...l, qty: r2(Math.min(l.qty, Math.max(0, stock[l.itemId] - 5))) })).filter((l) => l.qty >= 1);
      if (!lines.length) return;
      const inv = { id: uid(), no: ++st.counters.invoice, date, time: tm(7, 15), seq: ++seq, customerId, lines, note: '', status: 'active' };
      st.invoices.push(inv);
      lines.forEach((l) => (stock[l.itemId] = r2(stock[l.itemId] - l.qty)));
      const tot = lineTotal(lines);
      bal[customerId] += tot;
      weekSales[customerId] = (weekSales[customerId] || 0) + tot;
      if (received) {
        received = Math.min(received, tot);
        addPayment('in', date, customerId, received, { method: 'cash', ...pay, docId: inv.id, time: inv.time });
      }
    };
    const addPayment = (dir, date, partyId, amount, f = {}) => {
      if (amount <= 0) return;
      const p = {
        id: uid(), no: ++st.counters[dir], dir, date, time: f.time || tm(17, 21), seq: ++seq, partyId, amount: round(amount),
        method: f.method || 'cash', ref: f.ref || '', fromAcc: f.fromAcc || '', toAcc: f.toAcc || '',
        handledBy: f.handledBy || '', onBehalf: f.onBehalf || '', note: f.note || '', docId: f.docId || null, status: 'active',
      };
      st.payments.push(p);
      bal[partyId] -= p.amount;
    };

    let liveRate = 312;
    for (let k = 0; k <= 44; k++) {
      const d = addDays(goLive, k);
      liveRate = Math.max(285, Math.min(345, liveRate + ri(-6, 6)));
      const meat = Math.round(liveRate * 1.6 / 5) * 5;
      // --- stock in
      if (k % 4 === 0) addReceipt(d, 'v1', [{ itemId: 'i1', qty: ri(1000, 1500), rate: liveRate - ri(8, 14) }], { bill: String(3800 + k), vehicle: pick(['JLM-4471', 'JLM-2290', 'RIM-8812']) });
      if (k % 6 === 1) addReceipt(d, 'v2', [{ itemId: 'i1', qty: ri(300, 500), rate: 0 }]);
      addReceipt(d, 'v2', [
        { itemId: 'i2', qty: ri(95, 135), rate: 0 },
        { itemId: 'i3', qty: k % 2 ? ri(18, 34) : 0, rate: 0 },
        { itemId: 'i4', qty: k % 4 ? 0 : ri(4, 8), rate: 0 },
      ]);
      if (k % 12 === 5) addReceipt(d, 'v3', [{ itemId: 'i1', qty: ri(900, 1300), rate: liveRate - ri(10, 16) }], { bill: 'B-' + ri(100, 999) });
      if (k % 10 === 2) addReceipt(d, 'v4', [{ itemId: 'i5', qty: ri(40, 60), rate: ri(480, 520) }], { bill: String(ri(1000, 1999)) });
      // --- sales
      addInvoice(d, 'c1', [{ itemId: 'i1', qty: pick([200, 250, 300, 300, 350, 400]), rate: liveRate + ri(4, 10) }]);
      if (k % 6 !== 3) addInvoice(d, 'c5', [{ itemId: 'i1', qty: ri(110, 220), rate: liveRate + ri(8, 14) }]);
      if (k % 2 === 0) addInvoice(d, 'c3', [{ itemId: 'i1', qty: ri(30, 70), rate: liveRate + 15 }, { itemId: 'i2', qty: ri(10, 25), rate: meat + 10 }].concat(k % 4 === 0 ? [{ itemId: 'i5', qty: ri(6, 12), rate: 690 }] : []));
      addInvoice(d, 'c2', [{ itemId: 'i2', qty: ri(30, 95), rate: meat }].concat(k % 4 === 0 ? [{ itemId: 'i3', qty: ri(8, 16), rate: 600 }] : []));
      if (k % 2 === 1) addInvoice(d, 'c4', [{ itemId: 'i2', qty: ri(20, 55), rate: meat + 10 }, { itemId: 'i3', qty: ri(5, 12), rate: 610 }], k % 6 === 1 ? 20000 : 0, { method: 'cash' });
      if (k % 3 !== 2) addInvoice(d, 'c6', [{ itemId: 'i2', qty: ri(15, 40), rate: meat + 5 }].concat(k % 3 === 0 ? [{ itemId: 'i4', qty: ri(3, 6), rate: 770 }] : []));
      if (k % 11 === 6) addInvoice(d, 'c7', [{ itemId: 'i2', qty: ri(70, 110), rate: meat }, { itemId: 'i3', qty: ri(10, 20), rate: 600 }]);
      if (k % 2 === 0) {
        const lines = [{ itemId: pick(['i2', 'i2', 'i5']), qty: ri(2, 8), rate: 0 }];
        lines[0].rate = lines[0].itemId === 'i5' ? 680 : meat + 20;
        addInvoice(d, 'c8', lines, 999999, { method: 'cash' });
      }
      // --- money in (recoveries)
      if (dow(d) === 6 && weekSales.c1) { addPayment('in', d, 'c1', weekSales.c1, { method: 'online', ref: tid(), toAcc: 'Meezan Bank ••4521', fromAcc: 'UBL ••3307', note: 'Weekly settlement' }); weekSales.c1 = 0; }
      if (k % 5 === 4 && bal.c2 > 0) addPayment('in', d, 'c2', Math.floor(bal.c2 * 0.9 / 1000) * 1000, { method: pick(['cash', 'cash', 'easypaisa']), ref: '' });
      if (dow(d) === 1 && bal.c3 > 150000) addPayment('in', d, 'c3', 150000, { method: 'cash', handledBy: 'Waiter Akram' });
      if (k % 4 === 2 && bal.c5 > 0) addPayment('in', d, 'c5', Math.floor(bal.c5 * 0.6 / 1000) * 1000, { method: 'easypaisa', ref: tid(), fromAcc: '0300-0000105', toAcc: 'Easypaisa 0300-0000001' });
      if (dow(d) === 4 && bal.c6 > 0) addPayment('in', d, 'c6', Math.floor(bal.c6 * 0.8 / 500) * 500, { method: 'cash' });
      if (k % 11 === 9 && bal.c7 > 0) addPayment('in', d, 'c7', bal.c7, { method: 'bank', ref: 'DEP-' + ri(1000, 9999), toAcc: 'Meezan Bank ••4521', onBehalf: 'Zafar Marriage Hall' });
      if (dow(d) === 5 && bal.c4 > 0) addPayment('in', d, 'c4', Math.floor(bal.c4 * 0.7 / 1000) * 1000, { method: 'jazzcash', ref: tid(), fromAcc: '0300-0000104', toAcc: 'JazzCash 0300-0000002' });
      // --- money out (vendor payments)
      if (k % 4 === 3 && bal.v1 > 400000) addPayment('out', d, 'v1', Math.min(bal.v1 - 50000, pick([500000, 1000000, 1000000, 1500000])), { method: 'online', ref: tid(), fromAcc: 'Meezan Bank ••4521', toAcc: 'HBL ••7781 (Javed Iqbal)', handledBy: 'کامران' });
      if (k % 10 === 8 && bal.v3 > 0) addPayment('out', d, 'v3', Math.floor(bal.v3 * 0.75 / 10000) * 10000, { method: 'cash', handledBy: 'Farm owner' });
      if (k % 7 === 6 && bal.v4 > 0) addPayment('out', d, 'v4', bal.v4, { method: 'jazzcash', ref: tid(), fromAcc: 'JazzCash 0300-0000002' });
      // --- corrections
      if (k % 7 === 5) { const q = -ri(8, 25); st.adjustments.push({ id: uid(), date: d, time: '20:30', seq: ++seq, itemId: 'i1', qty: q, reason: 'Weight loss / mortality' }); stock.i1 = r2(stock.i1 + q); }
      // --- expenses
      if (k % 2 === 0) st.expenses.push({ id: uid(), no: ++st.counters.expense, date: d, time: tm(10, 18), categoryId: 'e2', amount: ri(15, 40) * 100, method: 'cash', desc: pick(['Pickup rent - Dina', 'Loader fare', 'Fuel for delivery van']), status: 'active' });
      if (dow(d) === 6) st.expenses.push({ id: uid(), no: ++st.counters.expense, date: d, time: '19:00', categoryId: 'e3', amount: 18000, method: 'cash', desc: 'Weekly wages (2 helpers)', status: 'active' });
      if (d.slice(8) === '05') st.expenses.push({ id: uid(), no: ++st.counters.expense, date: d, time: '12:00', categoryId: 'e1', amount: ri(160, 220) * 100, method: 'easypaisa', desc: 'Electricity bill', status: 'active' });
      if (k % 10 === 3) st.expenses.push({ id: uid(), no: ++st.counters.expense, date: d, time: '11:00', categoryId: 'e4', amount: ri(8, 30) * 100, method: 'cash', desc: pick(['Polythene bags', 'Knives sharpening', 'Ice blocks']), status: 'active' });
      // --- weekly backups (Sunday 22:00)
      if (dow(d) === 0 && d < end) st.settings.backup.history.unshift({ id: uid(), at: d + ' 22:00', kind: 'auto', size: 210 + k * 9, where: 'D:\\PoultryManager\\Backups', usb: k % 14 === 0, ok: true });
    }
    // one cancelled invoice and one correction to show the audit trail
    const victim = st.invoices.filter((i) => i.customerId === 'c6')[2];
    if (victim) { victim.status = 'cancelled'; victim.cancelDate = victim.date; victim.cancelReason = 'Wrong customer selected'; }
    st.settings.backup.history.splice(1, 0, { id: uid(), at: addDays(end, -3) + ' 13:10', kind: 'manual', size: 590, where: 'E:\\ (USB)', usb: true, ok: true });
    st.audit.push({ id: uid(), at: end + ' 08:00', action: 'login', ref: '', detail: 'Owner logged in' });
    return st;
  }

  function defaultPrint() {
    const base = { template: 'classic', paper: 'A5', lang: 'ur', font: 'm', accent: '#B4141F', showLogo: false,
      showBillNo: true, showRate: true, showPrev: true, showReceived: true, showNewBal: true, showPayDetails: true, showSignature: true,
      footer_ur: 'شکریہ! دوبارہ تشریف لائیں', footer_en: 'Thank you for your business' };
    return {
      sale: { ...base },
      receipt: { ...base, template: 'modern', paper: 'A5', accent: '#0E7C74', footer_ur: 'مال وصول کیا', footer_en: 'Goods received' },
      recovery: { ...base, paper: 'A6', template: 'minimal', footer_ur: 'رقم وصول پائی', footer_en: 'Payment received with thanks' },
      payment: { ...base, paper: 'A6', template: 'minimal', accent: '#4F46E5', footer_ur: 'ادائیگی واؤچر', footer_en: 'Payment voucher' },
      report: { ...base, template: 'modern', paper: 'A4', accent: '#4F46E5', footer_ur: '', footer_en: '' },
    };
  }

  /* ---------- persistence ---------- */
  function load() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.version === 1) return o; } } catch (e) { /* ignore */ }
    return null;
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function emit() { cache = {}; save(); listeners.forEach((f) => f()); }
  S = load() || seed();
  let cache = {};
  const memo = (k, fn) => (k in cache ? cache[k] : (cache[k] = fn()));

  /* ---------- lookups ---------- */
  const byId = (list, id) => list.find((x) => x.id === id);
  const item = (id) => byId(S.items, id);
  const party = (kind, id) => byId(kind === 'customer' ? S.customers : S.vendors, id);
  const partyOf = (id) => byId(S.customers, id) || byId(S.vendors, id);
  const method = (id) => byId(S.methods, id) || { id, name_ur: id, name_en: id };
  const category = (id) => byId(S.categories, id);
  const docsFor = (kind) => (kind === 'customer' ? S.invoices : S.receipts);
  const docParty = (doc) => doc.customerId || doc.vendorId;
  const dirFor = (kind) => (kind === 'customer' ? 'in' : 'out');
  const total = (doc) => lineTotal(doc.lines);
  const active = (x) => x.status !== 'cancelled';

  /* ---------- stock ---------- */
  function stockOf(itemId, upto) {
    const it = item(itemId); if (!it) return 0;
    let q = +it.opening || 0;
    const ok = (o) => !upto || o.date <= upto;
    S.receipts.forEach((r) => { if (active(r) && ok(r)) r.lines.forEach((l) => { if (l.itemId === itemId) q += +l.qty; }); });
    S.invoices.forEach((r) => { if (active(r) && ok(r)) r.lines.forEach((l) => { if (l.itemId === itemId) q -= +l.qty; }); });
    S.adjustments.forEach((a) => { if (a.itemId === itemId && ok(a)) q += +a.qty; });
    return r2(q);
  }
  function stockCard(itemId) {
    const it = item(itemId); const rows = [];
    S.receipts.forEach((r) => r.lines.forEach((l) => { if (l.itemId === itemId) { rows.push({ type: 'in', date: r.date, time: r.time, seq: r.seq, qty: +l.qty, doc: r, cancelled: !active(r) }); } }));
    S.invoices.forEach((r) => r.lines.forEach((l) => { if (l.itemId === itemId) { rows.push({ type: 'out', date: r.date, time: r.time, seq: r.seq, qty: -l.qty, doc: r, cancelled: !active(r) }); } }));
    S.adjustments.forEach((a) => { if (a.itemId === itemId) rows.push({ type: 'adj', date: a.date, time: a.time, seq: a.seq, qty: +a.qty, adj: a }); });
    rows.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    let run = +it.opening || 0;
    rows.forEach((r) => { if (!r.cancelled) run = r2(run + r.qty); r.balance = run; });
    return { opening: +it.opening || 0, rows };
  }
  function avgCost(itemId) {
    return memo('cost:' + itemId, () => {
      let q = 0, v = 0;
      S.receipts.forEach((r) => { if (active(r)) r.lines.forEach((l) => { if (l.itemId === itemId && +l.rate > 0) { q += +l.qty; v += l.qty * l.rate; } }); });
      if (q > 0) return v / q;
      const it = item(itemId); return it && it.cost ? +it.cost : null;
    });
  }

  /* ---------- balances, ledger, status ---------- */
  function balance(kind, id, upto) {
    const p = party(kind, id); if (!p) return 0;
    let b = +p.opening || 0;
    const ok = (o) => !upto || o.date <= upto;
    docsFor(kind).forEach((d) => { if (docParty(d) === id && active(d) && ok(d)) b += total(d); });
    S.payments.forEach((p2) => { if (p2.partyId === id && p2.dir === dirFor(kind) && active(p2) && ok(p2)) b -= p2.amount; });
    return round(b);
  }
  function ledger(kind, id, from, to) {
    const p = party(kind, id);
    const ev = [];
    docsFor(kind).forEach((d) => {
      if (docParty(d) !== id) return;
      ev.push({ kind: 'doc', date: d.date, time: d.time, seq: d.seq, doc: d, debit: total(d), credit: 0 });
      if (!active(d)) ev.push({ kind: 'docCancel', date: d.cancelDate || d.date, time: '23:59', seq: d.seq + 0.5, doc: d, debit: 0, credit: total(d) });
    });
    S.payments.forEach((x) => {
      if (x.partyId !== id || x.dir !== dirFor(kind)) return;
      ev.push({ kind: 'pay', date: x.date, time: x.time, seq: x.seq, pay: x, debit: 0, credit: x.amount });
      if (!active(x)) ev.push({ kind: 'payCancel', date: x.cancelDate || x.date, time: '23:59', seq: x.seq + 0.5, pay: x, debit: x.amount, credit: 0 });
    });
    ev.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    let run = +p.opening || 0; let opening = run; const rows = [];
    ev.forEach((e) => {
      run = round(run + e.debit - e.credit);
      if (from && e.date < from) { opening = run; return; }
      if (to && e.date > to) return;
      rows.push({ ...e, balance: run });
    });
    const sumD = rows.reduce((s, r) => s + r.debit, 0), sumC = rows.reduce((s, r) => s + r.credit, 0);
    return { party: p, opening: round(opening), rows, debit: sumD, credit: sumC, closing: rows.length ? rows[rows.length - 1].balance : round(opening) };
  }
  // Payments settle the opening balance first, then documents oldest-first.
  function docStatuses(kind) {
    return memo('status:' + kind, () => {
      const out = {};
      const list = kind === 'customer' ? S.customers : S.vendors;
      list.forEach((p) => {
        let pool = S.payments.filter((x) => x.partyId === p.id && x.dir === dirFor(kind) && active(x)).reduce((s, x) => s + x.amount, 0);
        pool -= Math.max(0, +p.opening || 0);
        if (+p.opening < 0) pool += -p.opening;
        docsFor(kind).filter((d) => docParty(d) === p.id && active(d)).sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)).forEach((d) => {
          const t = total(d); const paid = Math.max(0, Math.min(t, pool)); pool -= paid;
          out[d.id] = { paid: round(paid), due: round(t - paid), status: t === 0 || paid >= t ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
        });
      });
      return out;
    });
  }
  function docStatus(kind, doc) {
    if (!active(doc)) return { paid: 0, due: 0, status: 'cancelled' };
    const party2 = party(kind, docParty(doc));
    if (kind === 'vendor' && party2 && party2.own_farm) return { paid: 0, due: 0, status: 'farm' };
    return docStatuses(kind)[doc.id] || { paid: 0, due: total(doc), status: 'unpaid' };
  }

  /* ---------- period reports ---------- */
  function inRange(o, from, to) { return o.date >= from && o.date <= to; }
  function summary(from, to) {
    const items = S.items.map((it) => {
      let recv = 0, recvAmt = 0, sold = 0, soldAmt = 0, adj = 0, profit = 0, costKnown = true;
      const c = avgCost(it.id);
      S.receipts.forEach((r) => { if (active(r) && inRange(r, from, to)) r.lines.forEach((l) => { if (l.itemId === it.id) { recv += +l.qty; recvAmt += l.qty * l.rate; } }); });
      S.invoices.forEach((r) => { if (active(r) && inRange(r, from, to)) r.lines.forEach((l) => { if (l.itemId === it.id) { sold += +l.qty; soldAmt += l.qty * l.rate; if (c != null) profit += (l.rate - c) * l.qty; } }); });
      S.adjustments.forEach((a) => { if (a.itemId === it.id && inRange(a, from, to)) adj += +a.qty; });
      if (c == null) costKnown = false;
      return { item: it, opening: stockOf(it.id, addDays(from, -1)), recv: r2(recv), recvAmt: round(recvAmt), sold: r2(sold), soldAmt: round(soldAmt), adj: r2(adj), closing: stockOf(it.id, to), profit: round(profit), costKnown, cost: c };
    });
    const pays = (dir) => S.payments.filter((p) => p.dir === dir && active(p) && inRange(p, from, to));
    const byMethod = (list) => { const m = {}; list.forEach((p) => (m[p.method] = (m[p.method] || 0) + p.amount)); return m; };
    const exps = S.expenses.filter((e) => active(e) && inRange(e, from, to));
    const byCat = {}; exps.forEach((e) => (byCat[e.categoryId] = (byCat[e.categoryId] || 0) + e.amount));
    const sales = items.reduce((s, i) => s + i.soldAmt, 0);
    const purchases = items.reduce((s, i) => s + i.recvAmt, 0);
    const recov = pays('in').reduce((s, p) => s + p.amount, 0);
    const paidOut = pays('out').reduce((s, p) => s + p.amount, 0);
    const expTotal = exps.reduce((s, e) => s + e.amount, 0);
    const grossProfit = items.filter((i) => i.costKnown).reduce((s, i) => s + i.profit, 0);
    const cashIn = pays('in').filter((p) => method(p.method).cash).reduce((s, p) => s + p.amount, 0);
    const cashOut = pays('out').filter((p) => method(p.method).cash).reduce((s, p) => s + p.amount, 0) + exps.filter((e) => method(e.method).cash).reduce((s, e) => s + e.amount, 0);
    return {
      from, to, items, sales, purchases, recov, paidOut, expTotal, byCat,
      recovByMethod: byMethod(pays('in')), paidByMethod: byMethod(pays('out')),
      invoiceCount: S.invoices.filter((r) => active(r) && inRange(r, from, to)).length,
      receiptCount: S.receipts.filter((r) => active(r) && inRange(r, from, to)).length,
      grossProfit, netProfit: grossProfit - expTotal, profitPartial: items.some((i) => !i.costKnown && i.sold > 0),
      cashIn, cashOut,
      receivable: S.customers.reduce((s, c) => s + balance('customer', c.id, to), 0),
      payable: S.vendors.reduce((s, v) => s + balance('vendor', v.id, to), 0),
    };
  }
  function creditList(kind, from, to) {
    const list = kind === 'customer' ? S.customers : S.vendors;
    const rows = list.map((p) => {
      const prev = balance(kind, p.id, addDays(from, -1));
      const add = docsFor(kind).filter((d) => docParty(d) === p.id && active(d) && inRange(d, from, to)).reduce((s, d) => s + total(d), 0);
      const paid = S.payments.filter((x) => x.partyId === p.id && x.dir === dirFor(kind) && active(x) && inRange(x, from, to)).reduce((s, x) => s + x.amount, 0);
      return { party: p, prev, add, paid, closing: prev + add - paid };
    }).filter((r) => r.prev || r.add || r.paid || r.closing);
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    return { rows, totals: { prev: sum('prev'), add: sum('add'), paid: sum('paid'), closing: sum('closing') } };
  }

  /* ---------- actions ---------- */
  function audit(action, ref, detail) { S.audit.unshift({ id: uid(), at: today() + ' ' + nowTime(), action, ref, detail }); if (S.audit.length > 500) S.audit.length = 500; }
  const nextSeq = () => Math.max(0, ...S.invoices.map((x) => x.seq), ...S.receipts.map((x) => x.seq), ...S.payments.map((x) => x.seq), ...S.adjustments.map((x) => x.seq || 0)) + 1;

  function recentDuplicate(list, test) {
    const cutoff = Date.now() - 15000;
    return list.some((x) => x._ts && x._ts > cutoff && test(x));
  }

  const A = {
    saveDoc(kind, data, opts = {}) {
      const isC = kind === 'customer';
      const list = docsFor(kind);
      const doc = {
        id: uid(), no: ++S.counters[isC ? 'invoice' : 'receipt'], date: data.date, time: data.time || nowTime(), seq: nextSeq(),
        lines: data.lines.map((l) => ({ itemId: l.itemId, qty: r2(+l.qty), rate: +l.rate || 0 })), note: data.note || '', status: 'active', _ts: Date.now(),
      };
      if (isC) doc.customerId = data.partyId; else { doc.vendorId = data.partyId; doc.vendorBillNo = data.vendorBillNo || ''; doc.vehicle = data.vehicle || ''; doc.photo = data.photo || ''; }
      if (data.replaces) {
        const old = byId(list, data.replaces);
        if (old && active(old)) { old.status = 'cancelled'; old.cancelDate = today(); old.cancelReason = (data.reason || 'Corrected') + ' → #' + doc.no; old.replacedBy = doc.id; }
        doc.replaces = data.replaces;
        S.payments.forEach((p) => { if (p.docId === data.replaces) p.docId = doc.id; });
      }
      list.push(doc);
      if (+data.paidNow > 0) {
        A.savePayment(isC ? 'in' : 'out', { ...data.payment, partyId: data.partyId, amount: +data.paidNow, date: data.date, docId: doc.id }, { silent: true });
      }
      audit(data.replaces ? 'correct' : 'create', (isC ? 'INV-' : 'SR-') + doc.no, isC ? 'Sale invoice' : 'Stock receipt');
      emit();
      return doc;
    },
    isDuplicateDoc(kind, data) {
      const t = lineTotal(data.lines);
      return recentDuplicate(docsFor(kind), (d) => docParty(d) === data.partyId && total(d) === t);
    },
    cancelDoc(kind, id, reason) {
      const d = byId(docsFor(kind), id); if (!d || !active(d)) return;
      d.status = 'cancelled'; d.cancelDate = today(); d.cancelReason = reason;
      audit('cancel', (kind === 'customer' ? 'INV-' : 'SR-') + d.no, reason);
      emit();
    },
    savePayment(dir, data, opts = {}) {
      const p = {
        id: uid(), no: ++S.counters[dir], dir, date: data.date || today(), time: data.time || nowTime(), seq: nextSeq(), partyId: data.partyId,
        amount: round(+data.amount), method: data.method || 'cash', ref: data.ref || '', fromAcc: data.fromAcc || '', toAcc: data.toAcc || '',
        handledBy: data.handledBy || '', onBehalf: data.onBehalf || '', note: data.note || '', docId: data.docId || null, status: 'active', _ts: Date.now(),
      };
      S.payments.push(p);
      audit('create', (dir === 'in' ? 'RC-' : 'VP-') + p.no, dir === 'in' ? 'Recovery' : 'Vendor payment');
      if (!opts.silent) emit();
      return p;
    },
    isDuplicatePayment(dir, data) {
      return recentDuplicate(S.payments, (p) => p.dir === dir && p.partyId === data.partyId && p.amount === round(+data.amount));
    },
    cancelPayment(id, reason) {
      const p = byId(S.payments, id); if (!p || !active(p)) return;
      p.status = 'cancelled'; p.cancelDate = today(); p.cancelReason = reason;
      audit('cancel', (p.dir === 'in' ? 'RC-' : 'VP-') + p.no, reason); emit();
    },
    saveExpense(data) {
      const e = { id: uid(), no: ++S.counters.expense, date: data.date, time: nowTime(), categoryId: data.categoryId, amount: round(+data.amount), method: data.method || 'cash', desc: data.desc || '', status: 'active' };
      S.expenses.push(e); audit('create', 'EXP-' + e.no, 'Expense'); emit(); return e;
    },
    cancelExpense(id, reason) { const e = byId(S.expenses, id); if (!e) return; e.status = 'cancelled'; e.cancelReason = reason; audit('cancel', 'EXP-' + e.no, reason); emit(); },
    saveAdjustment(data) {
      const a = { id: uid(), date: data.date, time: nowTime(), seq: nextSeq(), itemId: data.itemId, qty: r2(+data.qty), reason: data.reason };
      S.adjustments.push(a); audit('create', 'ADJ', 'Stock correction: ' + data.reason); emit(); return a;
    },
    saveParty(kind, data) {
      const list = kind === 'customer' ? S.customers : S.vendors;
      if (data.id) { Object.assign(byId(list, data.id), data); audit('update', data.code, kind); }
      else {
        const n = list.length + 1;
        const p = { ...data, id: uid(), code: (kind === 'customer' ? 'C-' : 'V-') + String(n).padStart(3, '0'), active: true, opening: +data.opening || 0 };
        list.push(p); audit('create', p.code, kind); emit(); return p;
      }
      emit();
    },
    saveItem(data) {
      if (data.id) Object.assign(item(data.id), data); else S.items.push({ ...data, id: uid(), active: true });
      audit(data.id ? 'update' : 'create', 'ITEM', data.name_en || data.name_ur); emit();
    },
    saveCategory(data) { if (data.id) Object.assign(category(data.id), data); else S.categories.push({ ...data, id: uid(), active: true }); emit(); },
    saveMethod(data) { if (data.id) Object.assign(method(data.id), data); else S.methods.push({ ...data, id: uid(), active: true }); emit(); },
    setSettings(path, value) {
      const parts = path.split('.'); let o = S.settings; parts.slice(0, -1).forEach((k) => (o = o[k]));
      o[parts[parts.length - 1]] = value; emit();
    },
    resetPrint() { S.settings.print = defaultPrint(); emit(); },
    recordBackup(entry) { S.settings.backup.history.unshift({ id: uid(), at: today() + ' ' + nowTime(), ok: true, ...entry }); audit('backup', '', entry.kind); emit(); },
    exportData() { return JSON.stringify({ app: 'PoultryManager', exportedAt: new Date().toISOString(), data: S }, null, 1); },
    importData(text) {
      const o = JSON.parse(text); const d = o && o.data;
      if (!d || d.version !== 1 || !Array.isArray(d.invoices)) throw new Error('Not a Poultry Manager backup');
      S = d; audit('restore', '', 'Data restored from backup'); emit();
    },
    resetDemo() { S = seed(); emit(); },
  };

  window.Store = {
    get s() { return S; },
    subscribe: (f) => (listeners.add(f), () => listeners.delete(f)),
    today, nowTime, addDays, dow, lineTotal, uid,
    item, party, partyOf, method, category, total, active, docParty,
    stockOf, stockCard, avgCost, balance, ledger, docStatus, summary, creditList,
    ...A,
  };
})();
