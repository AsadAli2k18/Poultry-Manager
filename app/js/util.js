/* Small shared helpers for screens. */
(function () {
  'use strict';
  const { t, nm, qty, money } = I18N;
  window.Screens = window.Screens || {};

  /** Period filter used by list screens. */
  function range(mode, anchor) {
    const d = anchor || Store.today();
    if (mode === 'today' || mode === 'day') return [d, d];
    if (mode === 'week') return [Store.addDays(d, -6), d];
    if (mode === 'month') { const s = d.slice(0, 8) + '01'; const e = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).toISOString().slice(0, 10); return [s, e]; }
    if (mode === 'year') return [d.slice(0, 4) + '-01-01', d.slice(0, 4) + '-12-31'];
    return ['0000-01-01', '9999-12-31'];
  }
  const periodOptions = () => [
    { value: 'today', label: t('Today') }, { value: 'week', label: t('7 days') }, { value: 'month', label: t('This month') }, { value: 'all', label: t('All') },
  ];
  const linesText = (lines) => lines.map((l) => { const it = Store.item(l.itemId); return nm(it) + ' ' + qty(l.qty); }).join('، ');
  const docNo = (kind, d) => (kind === 'customer' ? '#' + d.no : 'SR-' + d.no);
  const payNo = (p) => (p.dir === 'in' ? 'RC-' : 'VP-') + p.no;
  const matches = (q, ...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q.toLowerCase()));
  const csvSafe = (s) => s;
  const kindOfDocRoute = (kind) => (kind === 'customer' ? 'sales' : 'receipts');
  /** Reads a picked image and shrinks it (phone photos are several MB) to a JPEG data URL. */
  function readImage(file, maxPx = 1600) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const img = new Image();
        img.onerror = () => resolve(r.result);
        img.onload = () => {
          const k = Math.min(1, maxPx / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  /* Pakistani CNIC: 13 digits shown as 12345-1234567-1. The last digit is odd for men and even for women. */
  const cnicDigits = (v) => String(v || '').replace(/\D/g, '').slice(0, 13);
  const fmtCnic = (v) => { const d = cnicDigits(v); return d.length <= 5 ? d : d.length <= 12 ? d.slice(0, 5) + '-' + d.slice(5) : d.slice(0, 5) + '-' + d.slice(5, 12) + '-' + d.slice(12); };
  const cnicMask = (v) => { const d = cnicDigits(v); return d.length === 13 ? d.slice(0, 5) + '-•••••' + d.slice(10, 12) + '-' + d.slice(12) : fmtCnic(d); };
  const cnicGender = (v) => { const d = cnicDigits(v); return d.length === 13 ? (+d[12] % 2 ? 'M' : 'F') : ''; };
  window.Util = { cnicDigits, fmtCnic, cnicMask, cnicGender, readImage,  range, periodOptions, linesText, docNo, payNo, matches, csvSafe, kindOfDocRoute, money };
})();
