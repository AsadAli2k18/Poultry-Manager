/* Poultry Manager — data store.
 * Holds all records in memory and computes every balance, stock figure and status
 * from the records. Nothing is stored as a running total.
 * Desktop app: every change is written to the SQLite database (desktop/db.js) through
 * window.PM before the screen moves on. Browser demo: kept in localStorage with dummy data.
 */
(function () {
  'use strict';
  const LS_KEY = 'pm.demo.v4';
  const DESK = !!(window.PM && window.PM.desktop);
  const TABLES = ['items', 'customers', 'vendors', 'categories', 'methods', 'invoices', 'receipts', 'payments', 'adjustments', 'expenses', 'drafts', 'biometrics'];
  const listeners = new Set();
  let S = null;
  let INFO = {};

  /* ---------- helpers ---------- */
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  const nowTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
  const round = (n) => Math.round(n);
  const r2 = (n) => Math.round(n * 100) / 100;
  const sortKey = (o) => (o.date || '') + ' ' + (o.time || '00:00') + ' ' + (+o.seq || 0).toFixed(2).padStart(12, '0'); // seq may be fractional (x.5)
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
      categories: defaultCategories(),
      methods: defaultMethods(),
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

  function defaultCategories() {
    return [
      { id: 'e1', name_ur: 'بل', name_en: 'Bills', active: true },
      { id: 'e2', name_ur: 'ٹرانسپورٹ', name_en: 'Transport', active: true },
      { id: 'e3', name_ur: 'مزدوری', name_en: 'Labour', active: true },
      { id: 'e4', name_ur: 'دکان کا سامان', name_en: 'Shop supplies', active: true },
    ];
  }
  function defaultMethods() {
    return [
      { id: 'cash', name_ur: 'نقد', name_en: 'Cash', cash: true, active: true },
      { id: 'online', name_ur: 'آن لائن ٹرانسفر', name_en: 'Online transfer', active: true },
      { id: 'easypaisa', name_ur: 'ایزی پیسہ', name_en: 'Easypaisa', active: true },
      { id: 'jazzcash', name_ur: 'جاز کیش', name_en: 'JazzCash', active: true },
      { id: 'bank', name_ur: 'بینک جمع', name_en: 'Bank deposit', active: true },
      { id: 'cheque', name_ur: 'چیک', name_en: 'Cheque', active: true },
    ];
  }
  // fingerprint scanner (optional). level: how sure a match must be (SecuGen 1-9, 5 = normal)
  const defaultBio = () => ({ enabled: true, listen: true, level: 5 });
  const defaultBackup = () => ({ enabled: true, frequency: 'weekly', day: 0, time: '22:00', folder: INFO.defaultBackupFolder || 'D:\\PoultryManager\\Backups', usb: true, keep: 12, history: [] });

  /* A new, empty shop: start from where the business stands today (opening balances only). */
  function blank() {
    const d = today();
    return {
      version: 1,
      settings: {
        goLive: d, theme: 'light',
        shop: { name_ur: 'میری دکان', name_en: 'My Shop', sub_ur: '', sub_en: '', addr_ur: '', addr_en: '', owners: [{ name_ur: '', name_en: '', phone: '' }], logo: '' },
        accounts: [], print: defaultPrint(), backup: defaultBackup(), bio: defaultBio(),
      },
      items: [{ id: 'i1', name_ur: 'مرغی', name_en: 'Chicken', unit: 'kg', rate: 0, cost: null, opening: 0, active: true }],
      customers: [],
      vendors: [{ id: 'vfarm', code: 'V-001', name_ur: 'اپنا فارم', name_en: 'Own Farm', phone: '', address: '', opening: 0, own_farm: true, note: '', active: true }],
      categories: defaultCategories(), methods: defaultMethods(),
      invoices: [], receipts: [], payments: [], adjustments: [], expenses: [], audit: [],
      counters: { invoice: 0, receipt: 0, in: 0, out: 0, expense: 0 },
    };
  }

  function defaultPrint() {
    const base = { template: 'classic', paper: 'A5', lang: 'ur', font: 'm', accent: '#B4141F', showLogo: false,
      showBillNo: true, showRate: true, showPrev: true, showReceived: true, showNewBal: true, showPayDetails: true, showSignature: true,
      footer_ur: 'شکریہ! دوبارہ تشریف لائیں', footer_en: 'Thank you for your business',
      // thermal receipt (paper T80 / T58) and shared options
      showBalance: true, design: 'standard', showShopName: true, showAddress: true, showOwners: true, headerNote_ur: '', headerNote_en: '',
      colItem: true, colQty: true, colRate: true, colAmount: true, lineStyle: 'auto', bold: true,
      billPrefix: '', dateFmt: 'd/m/yy', timeFmt: '24h', note_ur: '', note_en: '', printer: '', silent: false, printMode: 'direct', cut: true };
    return {
      sale: { ...base },
      receipt: { ...base, template: 'modern', paper: 'A5', accent: '#0E7C74', footer_ur: 'مال وصول کیا', footer_en: 'Goods received' },
      recovery: { ...base, paper: 'A6', template: 'minimal', footer_ur: 'رقم وصول پائی', footer_en: 'Payment received with thanks' },
      payment: { ...base, paper: 'A6', template: 'minimal', accent: '#4F46E5', footer_ur: 'ادائیگی واؤچر', footer_en: 'Payment voucher' },
      report: { ...base, template: 'modern', paper: 'A4', accent: '#4F46E5', footer_ur: '', footer_en: '' },
    };
  }

  /* ---------- persistence ---------- */
  let cache = {};
  let snap = {}; // desktop: last saved JSON of every record, to send only what changed
  let newAudit = []; // desktop: activity entries not yet written
  let backupLogCache = null;

  // fill in fields older data may not have
  function normalize(st) {
    TABLES.concat(['audit']).forEach((k) => { if (!Array.isArray(st[k])) st[k] = []; });
    st.counters = { invoice: 0, receipt: 0, in: 0, out: 0, expense: 0, ...(st.counters || {}) };
    st.settings.backup = { ...defaultBackup(), ...(st.settings.backup || {}) };
    st.settings.bio = { ...defaultBio(), ...(st.settings.bio || {}) };
    if (!st.settings.backup.folder) st.settings.backup.folder = INFO.defaultBackupFolder || '';
    const dp = defaultPrint(); const sp = st.settings.print || {};
    st.settings.print = {}; Object.keys(dp).forEach((k) => (st.settings.print[k] = { ...dp[k], ...(sp[k] || {}) }));
    st.adjustments.forEach((a) => { if (!a.status) a.status = 'active'; });
    if (DESK) { delete st.settings.password; st.settings.backup.history = []; }
    return st;
  }
  const settingsForDb = () => { const o = JSON.parse(JSON.stringify(S.settings)); delete o.password; if (o.backup) delete o.backup.history; return o; };
  function snapshot() {
    snap = {};
    TABLES.forEach((t) => { const m = new Map(); S[t].forEach((r) => m.set(r.id, JSON.stringify(r))); snap[t] = m; });
    snap.settings = JSON.stringify(settingsForDb()); snap.counters = JSON.stringify(S.counters);
    newAudit = [];
  }
  function saveFailed(err) {
    console.error(err);
    // The screen must never show something that is not on disk: reload what the database has.
    alert('Could not save to the database / ڈیٹا محفوظ نہیں ہو سکا\n\n' + (err && err.message ? err.message : err));
    location.reload();
    throw err;
  }
  function persistDesk() {
    const ch = { upserts: {}, deletes: {} }; let any = false; const next = {};
    TABLES.forEach((t) => {
      const old = snap[t] || new Map(); const now = new Map(); const ups = [];
      S[t].forEach((r) => { const j = JSON.stringify(r); now.set(r.id, j); if (old.get(r.id) !== j) ups.push(r); });
      const dels = []; old.forEach((_, id) => { if (!now.has(id)) dels.push(id); });
      if (ups.length) { ch.upserts[t] = ups; any = true; }
      if (dels.length) { ch.deletes[t] = dels; any = true; }
      next[t] = now;
    });
    if (newAudit.length) { ch.upserts.audit = newAudit.slice(); any = true; }
    const sj = JSON.stringify(settingsForDb()); if (sj !== snap.settings) { ch.settings = JSON.parse(sj); any = true; }
    const cj = JSON.stringify(S.counters); if (cj !== snap.counters) { ch.counters = S.counters; any = true; }
    if (!any) return;
    try { PM.commit(ch); } catch (e) { saveFailed(e); }
    next.settings = sj; next.counters = cj; snap = next; newAudit = [];
    if (S.audit.length > 1000) S.audit.length = 1000;
  }
  function load() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.version === 1) return o; } } catch (e) { /* ignore */ }
    return null;
  }
  function save() { if (DESK) return persistDesk(); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function emit() { cache = {}; save(); listeners.forEach((f) => f()); }
  // Replace everything (first run, sample data, erase, browser import)
  function replaceState(st) {
    S = normalize(st);
    if (DESK) { try { PM.replaceAll({ ...S, settings: settingsForDb() }); } catch (e) { saveFailed(e); } snapshot(); }
    cache = {}; save(); listeners.forEach((f) => f());
  }

  if (DESK) {
    const r = PM.load(); INFO = r.info || {};
    if (r.state) { S = normalize(r.state); snapshot(); } else { S = normalize(blank()); PM.replaceAll({ ...S, settings: settingsForDb() }); snapshot(); }
  } else {
    S = load();
    if (!S) { S = seed(); save(); } // saved straight away so links stay valid after a reload
    normalize(S);
  }
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
    S.adjustments.forEach((a) => { if (a.itemId === itemId && active(a) && ok(a)) q += +a.qty; });
    return r2(q);
  }
  function stockCard(itemId) {
    const it = item(itemId); const rows = [];
    S.receipts.forEach((r) => r.lines.forEach((l) => { if (l.itemId === itemId) { rows.push({ type: 'in', date: r.date, time: r.time, seq: r.seq, qty: +l.qty, doc: r, cancelled: !active(r) }); } }));
    S.invoices.forEach((r) => r.lines.forEach((l) => { if (l.itemId === itemId) { rows.push({ type: 'out', date: r.date, time: r.time, seq: r.seq, qty: -l.qty, doc: r, cancelled: !active(r) }); } }));
    S.adjustments.forEach((a) => { if (a.itemId === itemId) rows.push({ type: 'adj', date: a.date, time: a.time, seq: a.seq, qty: +a.qty, adj: a, cancelled: !active(a) }); });
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
  // Where a cancellation sits in the ledger: a corrected entry is reversed just before its replacement;
  // a plain cancel at the time it was made (older records without a time: end of that day).
  function cancelAt(o, list) {
    const rep = o.replacedBy && byId(list, o.replacedBy);
    if (rep) return { date: rep.date, time: rep.time, seq: rep.seq - 0.5 };
    return { date: o.cancelDate || o.date, time: o.cancelTime || '23:59', seq: o.cancelSeq != null ? o.cancelSeq : o.seq + 0.5 };
  }
  /* Balance figures for one bill, taken from the party's ledger as of that bill (reprints show the balance then, not today's).
   * prev = balance before the bill, total = bill, received = payments taken with it, after = prev + total - received. */
  function billBalance(kind, doc) {
    const lg = ledger(kind, docParty(doc));
    const tot = total(doc);
    const linked = S.payments.filter((p) => p.docId === doc.id && p.dir === dirFor(kind) && active(p));
    const received = round(linked.reduce((s, p) => s + p.amount, 0));
    const idx = lg.rows.findIndex((r) => r.kind === 'doc' && r.doc.id === doc.id);
    if (idx < 0) return { prev: lg.closing, total: tot, received, after: round(lg.closing + tot - received) };
    const row = lg.rows[idx];
    let prev = row.balance - row.debit + row.credit;
    // a payment the ledger lists before this bill (a corrected bill keeps the original's payment) is not yet in "previous"
    linked.forEach((p) => { const i = lg.rows.findIndex((r) => r.kind === 'pay' && r.pay.id === p.id); if (i >= 0 && i < idx) prev += p.amount; });
    prev = round(prev);
    return { prev, total: tot, received, after: round(prev + tot - received) };
  }
  function ledger(kind, id, from, to) {
    const p = party(kind, id);
    const ev = [];
    docsFor(kind).forEach((d) => {
      if (docParty(d) !== id) return;
      ev.push({ kind: 'doc', date: d.date, time: d.time, seq: d.seq, doc: d, debit: total(d), credit: 0 });
      if (!active(d)) ev.push({ kind: 'docCancel', ...cancelAt(d, docsFor(kind)), doc: d, debit: 0, credit: total(d) });
    });
    S.payments.forEach((x) => {
      if (x.partyId !== id || x.dir !== dirFor(kind)) return;
      ev.push({ kind: 'pay', date: x.date, time: x.time, seq: x.seq, pay: x, debit: 0, credit: x.amount });
      if (!active(x)) ev.push({ kind: 'payCancel', ...cancelAt(x, S.payments), pay: x, debit: x.amount, credit: 0 });
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
      S.adjustments.forEach((a) => { if (a.itemId === it.id && active(a) && inRange(a, from, to)) adj += +a.qty; });
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
  function audit(action, ref, detail) {
    const e = { id: uid() + uid(), at: today() + ' ' + nowTime(), action, ref, detail };
    S.audit.unshift(e);
    if (DESK) newAudit.push(e); else if (S.audit.length > 500) S.audit.length = 500;
  }
  const nextSeq = () => { let m = 0; ['invoices', 'receipts', 'payments', 'adjustments'].forEach((k) => S[k].forEach((x) => { if ((x.seq || 0) > m) m = x.seq; if ((x.cancelSeq || 0) > m) m = x.cancelSeq; })); return Math.floor(m) + 1; };
  // Shrinks a photo before it is stored (bills are photographed with phones: several MB each)
  function storePhoto(data) {
    if (!data || !DESK || !String(data).startsWith('data:')) return data || '';
    const id = uid() + uid();
    try { PM.putPhoto(id, data); } catch (e) { saveFailed(e); }
    return 'db:' + id;
  }
  const photoCache = {};
  function photoSrc(ref) {
    if (!ref || !String(ref).startsWith('db:')) return ref || '';
    const id = ref.slice(3);
    if (!(id in photoCache)) { try { photoCache[id] = PM.getPhoto(id); } catch (e) { photoCache[id] = ''; } }
    return photoCache[id];
  }

  function recentDuplicate(list, test) {
    const cutoff = Date.now() - 15000;
    return list.some((x) => x._ts && x._ts > cutoff && test(x));
  }

  const payRef = (p) => (p.dir === 'in' ? 'RC-' : 'VP-') + p.no;
  const A = {
    saveDoc(kind, data, opts = {}) {
      const isC = kind === 'customer';
      const list = docsFor(kind);
      const doc = {
        id: uid() + uid(), no: ++S.counters[isC ? 'invoice' : 'receipt'], date: data.date, time: data.time || nowTime(), seq: nextSeq(),
        lines: data.lines.map((l) => ({ itemId: l.itemId, qty: r2(+l.qty), rate: +l.rate || 0 })), note: data.note || '', status: 'active', _ts: Date.now(),
      };
      if (isC) doc.customerId = data.partyId; else { doc.vendorId = data.partyId; doc.vendorBillNo = data.vendorBillNo || ''; doc.vehicle = data.vehicle || ''; doc.photo = storePhoto(data.photo); }
      if (data.replaces) {
        const old = byId(list, data.replaces);
        if (old && active(old)) { old.status = 'cancelled'; old.cancelDate = today(); old.cancelReason = (data.reason || 'Corrected') + ' → ' + (isC ? '#' : 'SR-') + doc.no; old.replacedBy = doc.id; }
        doc.replaces = data.replaces;
        // a payment taken with the old bill now belongs to the new one (same customer only)
        S.payments.forEach((p) => { if (p.docId === data.replaces && p.partyId === data.partyId) p.docId = doc.id; });
      }
      list.push(doc);
      if (+data.paidNow > 0) {
        A.savePayment(isC ? 'in' : 'out', { ...data.payment, partyId: data.partyId, amount: +data.paidNow, date: data.date, docId: doc.id }, { silent: true });
      }
      audit(data.replaces ? 'correct' : 'create', (isC ? 'INV-' : 'SR-') + doc.no, (isC ? 'Sale invoice' : 'Stock receipt') + (data.replaces ? ' — ' + (data.reason || '') : ''));
      emit();
      return doc;
    },
    isDuplicateDoc(kind, data) {
      const t = lineTotal(data.lines);
      return recentDuplicate(docsFor(kind), (d) => docParty(d) === data.partyId && total(d) === t && active(d));
    },
    /* Drafts: an unfinished bill kept as typed (no number, no stock or balance effect). */
    saveDraft(kind, data, id) {
      const d = id && byId(S.drafts, id);
      const rec = {
        id: d ? d.id : uid() + uid(), kind, savedAt: today() + ' ' + nowTime(),
        date: data.date || today(), partyId: data.partyId || '', note: data.note || '',
        lines: (data.lines || []).filter((l) => l.itemId || l.qty || l.rate).map((l) => ({ itemId: l.itemId || '', qty: l.qty === '' ? '' : +l.qty || 0, rate: l.rate === '' ? '' : +l.rate || 0 })),
        paidNow: data.paidNow || '', payment: data.payment || null, vendorBillNo: data.vendorBillNo || '', vehicle: data.vehicle || '',
        photo: data.photo ? storePhoto(data.photo) : '', replaces: data.replaces || null,
      };
      if (d) Object.assign(d, rec); else S.drafts.push(rec);
      emit(); return d || rec;
    },
    deleteDraft(id) { const i = S.drafts.findIndex((x) => x.id === id); if (i >= 0) { S.drafts.splice(i, 1); emit(); } },
    drafts: (kind) => S.drafts.filter((d) => d.kind === kind).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    cancelDoc(kind, id, reason) {
      const d = byId(docsFor(kind), id); if (!d || !active(d)) return;
      d.status = 'cancelled'; d.cancelDate = today(); d.cancelTime = nowTime(); d.cancelSeq = nextSeq(); d.cancelReason = reason;
      audit('cancel', (kind === 'customer' ? 'INV-' : 'SR-') + d.no, reason);
      emit();
    },
    savePayment(dir, data, opts = {}) {
      const old = data.replaces ? byId(S.payments, data.replaces) : null;
      const p = {
        id: uid() + uid(), no: ++S.counters[dir], dir, date: data.date || today(), time: data.time || nowTime(), seq: nextSeq(), partyId: data.partyId,
        amount: round(+data.amount), method: data.method || 'cash', ref: data.ref || '', fromAcc: data.fromAcc || '', toAcc: data.toAcc || '',
        handledBy: data.handledBy || '', onBehalf: data.onBehalf || '', note: data.note || '', docId: data.docId || (old && old.partyId === data.partyId ? old.docId : null) || null, status: 'active', _ts: Date.now(),
      };
      if (old) {
        if (active(old)) { old.status = 'cancelled'; old.cancelDate = today(); old.cancelReason = (data.reason || 'Corrected') + ' → ' + payRef(p); old.replacedBy = p.id; }
        p.replaces = old.id;
      }
      S.payments.push(p);
      audit(old ? 'correct' : 'create', payRef(p), (dir === 'in' ? 'Recovery' : 'Vendor payment') + (old ? ' — ' + (data.reason || '') : ''));
      if (!opts.silent) emit();
      return p;
    },
    isDuplicatePayment(dir, data) {
      return recentDuplicate(S.payments, (p) => p.dir === dir && p.partyId === data.partyId && p.amount === round(+data.amount) && active(p));
    },
    cancelPayment(id, reason) {
      const p = byId(S.payments, id); if (!p || !active(p)) return;
      p.status = 'cancelled'; p.cancelDate = today(); p.cancelTime = nowTime(); p.cancelSeq = nextSeq(); p.cancelReason = reason;
      audit('cancel', payRef(p), reason); emit();
    },
    saveExpense(data) {
      const e = { id: uid() + uid(), no: ++S.counters.expense, date: data.date, time: nowTime(), categoryId: data.categoryId, amount: round(+data.amount), method: data.method || 'cash', desc: data.desc || '', status: 'active' };
      const old = data.replaces ? byId(S.expenses, data.replaces) : null;
      if (old) {
        if (active(old)) { old.status = 'cancelled'; old.cancelDate = today(); old.cancelReason = (data.reason || 'Corrected') + ' → EXP-' + e.no; old.replacedBy = e.id; }
        e.replaces = old.id;
      }
      S.expenses.push(e); audit(old ? 'correct' : 'create', 'EXP-' + e.no, 'Expense' + (old ? ' — ' + (data.reason || '') : '')); emit(); return e;
    },
    cancelExpense(id, reason) { const e = byId(S.expenses, id); if (!e || !active(e)) return; e.status = 'cancelled'; e.cancelDate = today(); e.cancelReason = reason; audit('cancel', 'EXP-' + e.no, reason); emit(); },
    saveAdjustment(data) {
      const a = { id: uid() + uid(), date: data.date, time: nowTime(), seq: nextSeq(), itemId: data.itemId, qty: r2(+data.qty), reason: data.reason, status: 'active' };
      S.adjustments.push(a); audit('create', 'ADJ', 'Stock correction: ' + data.reason + ' (' + (a.qty > 0 ? '+' : '') + a.qty + ')'); emit(); return a;
    },
    cancelAdjustment(id, reason) {
      const a = byId(S.adjustments, id); if (!a || !active(a)) return;
      a.status = 'cancelled'; a.cancelDate = today(); a.cancelReason = reason;
      audit('cancel', 'ADJ', 'Stock correction cancelled: ' + reason); emit();
    },
    saveParty(kind, data) {
      const list = kind === 'customer' ? S.customers : S.vendors;
      data = { ...data };
      if ('cnic' in data) data.cnic = String(data.cnic || '').replace(/\D/g, '').slice(0, 13); // stored as 13 digits, shown as 12345-1234567-1
      ['cnicFront', 'cnicBack'].forEach((k) => { if (data[k]) data[k] = storePhoto(data[k]); });
      if (data.id) {
        const p = byId(list, data.id); const before = p.opening;
        Object.assign(p, data);
        audit('update', p.code, kind + (+before !== +p.opening ? ' — opening balance ' + before + ' → ' + p.opening : ''));
        emit(); return p;
      }
      const used = new Set(list.map((x) => x.code)); let n = list.length + 1; let code;
      do { code = (kind === 'customer' ? 'C-' : 'V-') + String(n++).padStart(3, '0'); } while (used.has(code));
      const p = { ...data, id: uid() + uid(), code, active: true, opening: +data.opening || 0 };
      list.push(p); audit('create', p.code, kind); emit(); return p;
    },
    /* Fingerprints (optional): templates only. Enrolling the same finger again replaces it; removing keeps an inactive record. */
    saveBiometric(partyId, finger, templates, quality, sdk) {
      const p = party('customer', partyId); if (!p || !templates || !templates.length) return null;
      S.biometrics.filter((b) => b.partyId === partyId && b.finger === finger && b.active).forEach((b) => { b.active = false; b.removedAt = today() + ' ' + nowTime(); });
      const rec = { id: uid() + uid(), partyId, finger, templates, quality: Math.round(quality || 0), sdk: sdk || 'secugen', enrolledAt: today() + ' ' + nowTime(), active: true };
      S.biometrics.push(rec); audit('enroll', p.code, 'fingerprint — ' + finger); emit(); return rec;
    },
    removeBiometric(id) {
      const b = byId(S.biometrics, id); if (!b || !b.active) return;
      b.active = false; b.removedAt = today() + ' ' + nowTime();
      const p = party('customer', b.partyId); audit('remove', p ? p.code : '', 'fingerprint — ' + b.finger); emit();
    },
    fingersOf: (partyId) => S.biometrics.filter((b) => b.partyId === partyId && b.active),
    // another customer or vendor with the same CNIC (13 digits)
    cnicOwner(digits, exceptId) {
      const d = String(digits || '').replace(/\D/g, ''); if (d.length !== 13) return null;
      const hit = (l, kind) => { const p = l.find((x) => x.id !== exceptId && x.cnic === d); return p ? { kind, p } : null; };
      return hit(S.customers, 'customer') || hit(S.vendors, 'vendor');
    },
    saveItem(data) {
      let it;
      if (data.id) { it = item(data.id); Object.assign(it, data); } else { it = { ...data, id: uid() + uid(), active: true }; S.items.push(it); }
      audit(data.id ? 'update' : 'create', 'ITEM', data.name_en || data.name_ur); emit(); return it;
    },
    saveCategory(data) { let c; if (data.id) { c = category(data.id); Object.assign(c, data); } else { c = { ...data, id: uid() + uid(), active: true }; S.categories.push(c); } emit(); return c; },
    saveMethod(data) { let m; if (data.id) { m = byId(S.methods, data.id); Object.assign(m, data); } else { m = { ...data, id: uid() + uid(), active: true }; S.methods.push(m); } emit(); return m; },
    setSettings(path, value) {
      const parts = path.split('.'); let o = S.settings; parts.slice(0, -1).forEach((k) => (o = o[k]));
      o[parts[parts.length - 1]] = value; emit();
    },
    resetPrint() { S.settings.print = defaultPrint(); emit(); },
    logLogin() { audit('login', '', 'Owner logged in'); emit(); },

    /* password */
    checkPassword(pw) { return DESK ? !!PM.checkPassword(pw) : pw === S.settings.password; },
    changePassword(oldPw, newPw) {
      if (DESK) { const r = PM.setPassword(oldPw, newPw); if (r.ok) { audit('update', '', 'Password changed'); emit(); } return r; }
      if (oldPw !== S.settings.password) return { ok: false, error: 'wrong' };
      S.settings.password = newPw; emit(); return { ok: true };
    },
    defaultPassword() { return DESK ? PM.authInfo().isDefault : true; },

    /* backups */
    backupHistory() {
      if (!DESK) return S.settings.backup.history;
      if (!backupLogCache) { try { backupLogCache = PM.backupLog(); } catch (e) { backupLogCache = []; } }
      return backupLogCache;
    },
    recordBackup(entry) { S.settings.backup.history.unshift({ id: uid(), at: today() + ' ' + nowTime(), ok: true, ...entry }); audit('backup', '', entry.kind); emit(); },
    async backupNow(kind, note) {
      const e = await PM.backupNow(kind || 'manual', note || '');
      backupLogCache = null; audit('backup', e.file || '', (e.ok ? 'OK ' : 'FAILED ') + (e.kind || '') + (e.error ? ': ' + e.error : '')); emit();
      return e;
    },
    exportData() { return JSON.stringify({ app: 'PoultryManager', exportedAt: new Date().toISOString(), data: S }, null, 1); },
    importData(text) {
      const o = JSON.parse(text); const d = o && o.data;
      if (!d || d.version !== 1 || !Array.isArray(d.invoices)) throw new Error('Not a Poultry Manager backup');
      replaceState(d); audit('restore', '', 'Data restored from backup'); emit();
    },
    resetDemo() { replaceState(seed()); },
    // desktop: a safety backup is always taken first, so either can be undone with Restore
    async loadSample() {
      const keepFolder = S.settings.backup.folder; const safe = await A.backupNow('safety', 'Before loading sample data');
      if (!safe.ok) throw new Error(safe.error || 'Safety backup failed');
      const st = seed(); st.settings.backup = { ...st.settings.backup, folder: keepFolder, history: [] }; st.settings.sample = true; delete st.settings.password;
      replaceState(st); audit('restore', '', 'Sample data loaded'); emit();
    },
    async eraseAll() {
      const wasSample = !!S.settings.sample;
      const keep = { shop: S.settings.shop, print: S.settings.print, backup: S.settings.backup, accounts: S.settings.accounts, theme: S.settings.theme, bio: S.settings.bio };
      const safe = await A.backupNow('safety', 'Before erasing all data');
      if (!safe.ok) throw new Error(safe.error || 'Safety backup failed');
      const st = blank(); Object.assign(st.settings, keep);
      if (wasSample) { st.settings.shop = blank().settings.shop; st.settings.accounts = []; } // sample shop name is made up
      replaceState(st); audit('restore', '', 'All data erased — fresh start'); emit();
    },
  };
  if (DESK && PM.onBackup) PM.onBackup(() => { backupLogCache = null; cache = {}; listeners.forEach((f) => f()); });

  window.Store = {
    get s() { return S; },
    subscribe: (f) => (listeners.add(f), () => listeners.delete(f)),
    desktop: DESK, get info() { return INFO; },
    today, nowTime, addDays, dow, lineTotal, uid, photoSrc,
    item, party, partyOf, method, category, total, active, docParty,
    stockOf, stockCard, avgCost, balance, ledger, billBalance, docStatus, summary, creditList,
    ...A,
  };
})();
