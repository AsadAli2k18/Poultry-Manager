/* Printable documents: sale invoice, stock receipt, recovery receipt, payment voucher, reports.
 * Each document type has its own settings (template, paper, language, toggles) from the print designer.
 */
(function () {
  'use strict';
  const { money, qty, dmy } = I18N;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // T80 / T58: thermal receipt rolls. content = printable width (the print head is narrower than the roll).
  const PAPER = { A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 }, A6: { w: 105, h: 148 }, T80: { w: 80, content: 72, thermal: true }, T58: { w: 58, content: 48, thermal: true } };
  const FONT = { s: 10.5, m: 12, l: 13.5, xl: 15 };
  const TFONT = { s: 11.5, m: 13, l: 14.5, xl: 16 }; // px on thermal paper: 13px is about 10pt, readable at 203 dpi
  const kgf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kg2 = (n) => kgf.format(+n || 0); // KG always with 2 decimals on the thermal bill
  const isThermal = (paper) => !!(PAPER[paper] && PAPER[paper].thermal);
  const pxOf = (mm) => Math.round(mm * 96 / 25.4);
  const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ur: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'] };
  function fmtDate(iso, fmt, lang) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (fmt === 'dd/mm/yyyy') return d + '/' + m + '/' + y;
    if (fmt === 'dd-mm-yyyy') return d + '-' + m + '-' + y;
    if (fmt === 'd mon yyyy') return +d + ' ' + MON[lang === 'en' ? 'en' : 'ur'][+m - 1] + ' ' + y;
    return dmy(iso);
  }
  function fmtTime(tm, fmt) {
    if (!tm || fmt === 'off') return '';
    if (fmt !== '12h') return tm;
    const [h, mi] = tm.split(':').map(Number);
    return ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
  }

  function L(cfg) {
    const ur = (s) => I18N.tr(s, 'ur');
    if (cfg.lang === 'ur') return ur;
    if (cfg.lang === 'en') return (s) => s;
    return (s) => (ur(s) === s ? s : ur(s) + ' <span class="en">' + s + '</span>');
  }
  const N = (cfg, o) => {
    if (!o) return '';
    if (cfg.lang === 'en') return esc(o.name_en || o.name_ur);
    if (cfg.lang === 'ur') return esc(o.name_ur || o.name_en);
    return esc(o.name_ur || '') + (o.name_en ? ' <span class="en">' + esc(o.name_en) + '</span>' : '');
  };

  function css(cfg) {
    const p = PAPER[cfg.paper] || PAPER.A5; const f = FONT[cfg.font] || 12; const a = cfg.accent || '#B4141F';
    const rtl = cfg.lang !== 'en';
    return `
@page{size:${p.w}mm ${p.h}mm;margin:${cfg.paper === 'A6' ? 5 : 8}mm}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#111;font-size:${f}px;line-height:${rtl ? 1.9 : 1.45};font-family:${rtl ? "'Noto Nastaliq Urdu','Segoe UI',sans-serif" : "'Segoe UI',Roboto,Arial,sans-serif"};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{direction:${rtl ? 'rtl' : 'ltr'}}
.page{width:100%;max-width:${p.w - 2 * (cfg.paper === 'A6' ? 5 : 8)}mm;margin:0 auto}
.num,.n{font-family:'Segoe UI',Roboto,Arial,sans-serif;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;white-space:nowrap}
.en{font-family:'Segoe UI',Arial,sans-serif;font-size:.78em;color:#666;font-weight:400;direction:ltr;unicode-bidi:isolate}
h1,h2,h3{font-weight:700}
.muted{color:#666}
/* classic: bill pad */
.cl-head{background:linear-gradient(180deg,#e9eaec 0%,#c9ccd1 60%,#f4f4f5 100%);border-radius:6px 6px 0 0;padding:${f * 0.6}px ${f}px ${f * 0.4}px;text-align:center;position:relative;border-bottom:3px solid #333}
.cl-name{font-size:${f * 2.3}px;line-height:1.5;color:${a};font-weight:800;text-shadow:0 0 1px #f5c400,0 1px 0 #f5c400,1px 0 0 #f5c400,-1px 0 0 #f5c400,0 -1px 0 #f5c400}
.cl-sub{font-size:${f * 1.25}px;color:#1d1d5c;font-weight:800;margin-top:-${f * 0.3}px}
.cl-row{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:${f * 0.5}px;flex-wrap:wrap}
.cl-owner{text-align:center;font-size:.9em}.cl-owner b{color:${a};display:block;font-size:.95em}
.cl-addr{background:#c2185b;color:#fff;border-radius:999px;padding:0 ${f}px;font-size:.85em}
/* modern */
.md-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-${rtl ? 'right' : 'left'}:5px solid ${a};padding-${rtl ? 'right' : 'left'}:10px;margin-bottom:6px}
.md-name{font-size:${f * 1.7}px;color:${a};line-height:1.6}
.md-doc{text-align:${rtl ? 'left' : 'right'};font-size:${f * 1.15}px;color:#333}
/* minimal */
.mn-head{text-align:center;border-bottom:1px dashed #999;padding-bottom:4px;margin-bottom:6px}
.mn-name{font-size:${f * 1.5}px}
.doc-title{display:inline-block;background:${a};color:#fff;border-radius:4px;padding:0 10px;font-size:.95em;margin:6px 0 2px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin:6px 0;font-size:.95em}
.meta .k{color:#555}.meta .line{border-bottom:1px solid #999;padding:0 4px}
table{width:100%;border-collapse:collapse;margin:6px 0}
th{background:${a};color:#fff;font-weight:600;padding:3px 6px;text-align:${rtl ? 'right' : 'left'};font-size:.92em}
td{border-bottom:1px solid #ddd;padding:2px 6px;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
th.r,td.r{text-align:${rtl ? 'left' : 'right'}}
tfoot td{font-weight:700;border-top:2px solid #333;background:#f2f2f2}
.tot{margin-${rtl ? 'right' : 'left'}:auto;width:min(100%,${cfg.paper === 'A6' ? 100 : 62}%);border:1px solid #bbb;border-radius:4px;overflow:hidden}
.tot div{display:flex;justify-content:space-between;padding:1px 8px;border-bottom:1px solid #e5e5e5}
.tot div:last-child{border-bottom:none}
.tot .big{background:${a};color:#fff;font-weight:700;font-size:1.08em}
.amount-box{border:2px solid ${a};border-radius:6px;text-align:center;padding:4px;margin:8px 0}
.amount-box .n{font-size:${f * 2}px;font-weight:800;color:${a}}
.pay{border:1px dashed #aaa;border-radius:4px;padding:4px 8px;margin:6px 0;font-size:.92em}
.pay div{display:flex;justify-content:space-between;gap:8px}
.sign{display:flex;justify-content:space-between;margin-top:${f * 2.4}px;font-size:.9em}
.sign span{border-top:1px solid #333;padding-top:2px;min-width:30%;text-align:center}
.foot{text-align:center;color:#555;margin-top:8px;font-size:.88em;border-top:1px solid #ddd;padding-top:3px}
.stamp{color:#B4141F;border:2px solid #B4141F;display:inline-block;padding:0 8px;border-radius:4px;transform:rotate(-6deg);font-weight:800}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}
.kpi{border:1px solid #ddd;border-radius:4px;padding:3px 6px}.kpi .k{font-size:.82em;color:#666}.kpi .n{font-size:1.15em;font-weight:700}
.sec{font-size:1.05em;margin:10px 0 2px;color:${a}}
`;
  }

  function header(cfg, docTitle) {
    const s = Store.s.settings.shop; const t = L(cfg);
    const sname = cfg.lang === 'en' ? esc(s.name_en) : esc(s.name_ur);
    const ssub = cfg.lang === 'en' ? esc(s.sub_en) : esc(s.sub_ur);
    const addr = cfg.lang === 'en' ? esc(s.addr_en) : esc(s.addr_ur);
    const owner = (o) => `<div class="cl-owner"><b>${cfg.lang === 'en' ? esc(o.name_en) : esc(o.name_ur)}</b><span class="num">${esc(o.phone)}</span></div>`;
    const logo = cfg.showLogo && s.logo ? `<img src="${esc(s.logo)}" style="height:${cfg.paper === 'A6' ? 26 : 40}px">` : '';
    if (cfg.template === 'classic') {
      return `<div class="cl-head">${logo}<div class="cl-name">${sname}</div>${ssub ? `<div class="cl-sub">${ssub}</div>` : ''}
        <div class="cl-row">${s.owners[0] ? owner(s.owners[0]) : '<span></span>'}<span class="cl-addr">${addr}</span>${s.owners[1] ? owner(s.owners[1]) : '<span></span>'}</div></div>
        <div style="text-align:center"><span class="doc-title">${t(docTitle)}</span></div>`;
    }
    if (cfg.template === 'modern') {
      return `<div class="md-head"><div>${logo}<div class="md-name">${sname} ${ssub ? `<small style="font-size:.6em;color:#333">${ssub}</small>` : ''}</div>
        <div class="muted" style="font-size:.88em">${addr}</div><div class="muted num" style="font-size:.88em">${s.owners.map((o) => esc(o.phone)).join(' · ')}</div></div>
        <div class="md-doc"><b>${t(docTitle)}</b></div></div>`;
    }
    return `<div class="mn-head">${logo}<div class="mn-name">${sname}</div><div class="muted" style="font-size:.85em">${addr}</div>
      <div class="num muted" style="font-size:.85em">${s.owners.map((o) => esc(o.phone)).join(' · ')}</div><b>${t(docTitle)}</b></div>`;
  }
  function wrap(cfg, body) {
    const base = esc(location.href.replace(/[^/]*$/, ''));
    return `<!doctype html><html lang="${cfg.lang === 'en' ? 'en' : 'ur'}"><head><meta charset="utf-8"><base href="${base}">
      <link rel="stylesheet" href="css/fonts.css"><style>${css(cfg)}</style></head><body><div class="page">${body}</div></body></html>`;
  }
  const foot = (cfg) => {
    const t = L(cfg); const f = cfg.lang === 'en' ? cfg.footer_en : cfg.lang === 'ur' ? cfg.footer_ur : [cfg.footer_ur, cfg.footer_en].filter(Boolean).join(' — ');
    return (cfg.showSignature ? `<div class="sign"><span>${t('Received by')}</span><span>${t('Signature')}</span></div>` : '') + (f ? `<div class="foot">${esc(f)}</div>` : '');
  };
  function payBlock(cfg, p) {
    const t = L(cfg); const m = Store.method(p.method);
    const row = (k, v) => (v ? `<div><span class="muted">${t(k)}</span><span>${v}</span></div>` : '');
    return `<div class="pay">${row('Method', N(cfg, m))}${row('Transaction ID', `<span class="num">${esc(p.ref)}</span>`.replace('<span class="num"></span>', ''))}
      ${row('From account', esc(p.fromAcc))}${row('To account', esc(p.toAcc))}${row('Handled by', esc(p.handledBy))}${row('Paid on behalf of / by', esc(p.onBehalf))}${row('Note', esc(p.note))}</div>`;
  }
  function positionIn(kind, partyId, pred) {
    const lg = Store.ledger(kind, partyId);
    const row = lg.rows.find(pred);
    if (!row) return { prev: lg.closing, after: lg.closing };
    return { prev: row.balance - row.debit + row.credit, after: row.balance };
  }

  /* ---------- documents ---------- */
  function docLines(cfg, doc, showRate) {
    const t = L(cfg);
    const rows = doc.lines.map((l, i) => { const it = Store.item(l.itemId); return `<tr><td class="num">${i + 1}</td><td>${N(cfg, it)}</td><td class="r num">${qty(l.qty)} ${t(it ? it.unit : 'kg')}</td>${showRate ? `<td class="r num">${money(l.rate)}</td><td class="r num">${money(l.qty * l.rate)}</td>` : ''}</tr>`; }).join('');
    const totQty = doc.lines.reduce((s, l) => s + +l.qty, 0);
    return `<table><thead><tr><th>#</th><th>${t('Item')}</th><th class="r">${t('Quantity')}</th>${showRate ? `<th class="r">${t('Rate')}</th><th class="r">${t('Amount')}</th>` : ''}</tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td></td><td>${t('Total')}</td><td class="r num">${qty(totQty)}</td>${showRate ? `<td></td><td class="r num">${money(Store.total(doc))}</td>` : ''}</tr></tfoot></table>`;
  }
  function saleInvoice(doc, cfg) {
    if (isThermal(cfg.paper)) return thermalSale(doc, cfg);
    const t = L(cfg); const c = Store.party('customer', doc.customerId);
    const tot = Store.total(doc);
    const linked = Store.s.payments.filter((p) => p.docId === doc.id && Store.active(p));
    const bb = Store.billBalance('customer', doc); // same figures as the customer ledger, as of this bill
    const prev = bb.prev; const received = bb.received; const newBal = bb.after;
    if (cfg.showBalance === false) cfg = { ...cfg, showPrev: false, showReceived: false, showNewBal: false };
    let body = header(cfg, 'Sale Invoice');
    body += `<div class="meta">${cfg.showBillNo ? `<div><span class="k">${t('Bill No.')}:</span> <b class="num">${doc.no}</b></div>` : '<div></div>'}
      <div><span class="k">${t('Date')}:</span> <span class="num">${dmy(doc.date)} ${esc(doc.time || '')}</span></div>
      <div style="grid-column:1/-1"><span class="k">${t('Buyer name')}:</span> <span class="line"><b>${N(cfg, c)}</b></span> <span class="num muted">${esc(c && c.phone)}</span></div></div>`;
    if (!Store.active(doc)) body += `<div style="text-align:center"><span class="stamp">${t('CANCELLED')}</span></div>`;
    body += docLines(cfg, doc, cfg.showRate);
    body += `<div class="tot"><div><span>${t('Bill total')}</span><b class="num">${money(tot)}</b></div>
      ${cfg.showPrev ? `<div><span>${t('Previous balance')}</span><span class="num">${money(prev)}</span></div><div><span>${t('Total due')}</span><span class="num">${money(prev + tot)}</span></div>` : ''}
      ${cfg.showReceived ? `<div><span>${t('Received')}</span><span class="num">${money(received)}</span></div>` : ''}
      ${cfg.showNewBal ? `<div class="big"><span>${t('New balance')}</span><span class="num">${money(newBal)}</span></div>` : ''}</div>`;
    if (cfg.showPayDetails && linked.length) body += linked.map((p) => payBlock(cfg, p)).join('');
    if (doc.note) body += `<div class="muted" style="margin-top:4px">${t('Note')}: ${esc(doc.note)}</div>`;
    return wrap(cfg, body + foot(cfg));
  }

  /* ---------- thermal receipt (80 mm / 58 mm roll) ---------- */
  function thermalCss(cfg) {
    const P = PAPER[cfg.paper]; const f = TFONT[cfg.font] || 13; const rtl = cfg.lang !== 'en';
    const boxed = cfg.design === 'boxed';
    const w = cfg.bold ? 700 : 400;
    return `/*THERMAL:${P.w}*/
@page{size:${P.w}mm 297mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#000;width:${P.w}mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{direction:${rtl ? 'rtl' : 'ltr'};font-size:${f}px;line-height:${rtl ? 1.85 : 1.3};font-weight:${w};font-family:${rtl ? "'Noto Nastaliq Urdu','Segoe UI',sans-serif" : "'Segoe UI',Arial,sans-serif"}}
.rc{width:${P.content}mm;margin:0 auto;padding:2mm 0 6mm;overflow:hidden;text-align:${rtl ? 'right' : 'left'}}
.num{font-family:'Segoe UI',Arial,sans-serif;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;white-space:nowrap}
.en{font-family:'Segoe UI',Arial,sans-serif;font-size:.8em;direction:ltr;unicode-bidi:isolate}
b,.b{font-weight:700}
.c{text-align:center}
.hd{text-align:center;padding-bottom:1mm}
.hd img{max-width:60%;max-height:${cfg.paper === 'T58' ? 14 : 18}mm;display:block;margin:0 auto 1mm}
.sname{font-size:1.55em;font-weight:700;line-height:${rtl ? 1.7 : 1.2}}
.ssub{font-size:1.05em;font-weight:700}
.small{font-size:.88em}
.owners{display:flex;flex-wrap:wrap;justify-content:center;gap:0 3mm;font-size:.9em}
.hnote{font-size:.9em;margin-top:.5mm}
.title{text-align:center;font-weight:700;margin:1mm 0;${boxed ? 'background:#000;color:#fff;padding:.3mm 0' : 'font-size:1.1em'}}
.sep{border-top:1px dashed #000;margin:1.2mm 0}
.sep2{border-top:2px solid #000;margin:1.2mm 0}
.kv{display:flex;justify-content:space-between;align-items:baseline;gap:2mm}
.kv>span:first-child{flex:1 1 auto;min-width:0}
.kv>:last-child{flex:0 0 auto}
table{width:100%;border-collapse:collapse}
th{font-weight:700;text-align:${rtl ? 'right' : 'left'};border-bottom:1px solid #000;padding:0 .8mm .3mm;font-size:.92em;white-space:nowrap}
td{padding:.2mm .6mm;vertical-align:top}
tr,.blk{break-inside:avoid;page-break-inside:avoid}
th.r,td.r{text-align:${rtl ? 'left' : 'right'}}
td.it{word-break:break-word;width:100%}
.ln{padding:.4mm 0;border-bottom:1px dotted #000}
.ln:last-child{border-bottom:0}
.ln .calc{display:flex;justify-content:space-between;gap:2mm;font-size:.95em}
.big{font-size:1.2em;font-weight:700}
.bal{${boxed ? 'border:1.5px solid #000;padding:.6mm 1.2mm' : ''}}
.bal .now{${boxed ? 'background:#000;color:#fff;margin:.6mm -1.2mm -.6mm;padding:.4mm 1.2mm' : 'border-top:1px solid #000;padding-top:.4mm'};font-size:1.15em;font-weight:700}
.stamp{display:inline-block;border:2px solid #000;padding:0 2mm;font-weight:700;margin:1mm 0}
.foot{text-align:center}
.foot .ty{font-weight:700;font-size:1.05em}
`;
  }
  const pick = (cfg, ur, en) => (cfg.lang === 'en' ? en || ur : cfg.lang === 'ur' ? ur || en : [ur, en].filter(Boolean).join(' / '));
  function thermalHeader(cfg) {
    const s = Store.s.settings.shop;
    let h = '<div class="hd">';
    if (cfg.showLogo && s.logo) h += `<img src="${esc(s.logo)}">`;
    if (cfg.showShopName !== false) {
      h += `<div class="sname">${esc(cfg.lang === 'en' ? s.name_en || s.name_ur : s.name_ur || s.name_en)}</div>`;
      const sub = cfg.lang === 'en' ? s.sub_en : s.sub_ur; if (sub) h += `<div class="ssub">${esc(sub)}</div>`;
    }
    if (cfg.showAddress !== false) { const a = cfg.lang === 'en' ? s.addr_en || s.addr_ur : s.addr_ur || s.addr_en; if (a) h += `<div class="small">${esc(a)}</div>`; }
    if (cfg.showOwners !== false) {
      const os = (s.owners || []).filter((o) => o.name_ur || o.name_en || o.phone);
      if (os.length) h += `<div class="owners">${os.map((o) => `<span>${esc(cfg.lang === 'en' ? o.name_en || o.name_ur : o.name_ur || o.name_en)} <span class="num">${esc(o.phone)}</span></span>`).join('')}</div>`;
    }
    const hn = pick(cfg, cfg.headerNote_ur, cfg.headerNote_en); if (hn) h += `<div class="hnote">${esc(hn)}</div>`;
    return h + '</div>';
  }
  function thermalSale(doc, cfg) {
    const t = L(cfg); const c = Store.party('customer', doc.customerId);
    const bb = Store.billBalance('customer', doc); // same figures as the customer ledger, as of this bill
    const linked = Store.s.payments.filter((p) => p.docId === doc.id && Store.active(p));
    const cols = { item: cfg.colItem !== false, qty: cfg.colQty !== false, rate: cfg.colRate !== false, amount: cfg.colAmount !== false };
    const stacked = cfg.lineStyle === 'stacked' || (cfg.lineStyle !== 'table' && cfg.paper === 'T58');
    const tm = fmtTime(doc.time, cfg.timeFmt);
    let b = thermalHeader(cfg);
    b += `<div class="title">${t('Sale Invoice')}</div>`;
    b += `<div class="kv">${cfg.showBillNo ? `<span>${t('Bill No.')}: <b class="num">${esc(cfg.billPrefix || '')}${doc.no}</b></span>` : '<span></span>'}
      <span class="num">${fmtDate(doc.date, cfg.dateFmt, cfg.lang)}${tm ? ' ' + tm : ''}</span></div>`;
    b += `<div>${t('Buyer name')}: <b>${N(cfg, c)}</b>${c && c.phone ? ` <span class="num small">${esc(c.phone)}</span>` : ''}</div>`;
    if (!Store.active(doc)) b += `<div class="c"><span class="stamp">${t('CANCELLED')}</span></div>`;
    b += '<div class="sep2"></div>';
    if (stacked) {
      b += doc.lines.map((l, i) => {
        const it = Store.item(l.itemId);
        const calc = [cols.qty ? `${kg2(l.qty)} ${esc(it ? it.unit : 'kg')}` : '', cols.rate ? `× ${money(l.rate)}` : ''].filter(Boolean).join(' ');
        return `<div class="ln blk">${cols.item ? `<div><span class="num">${i + 1}.</span> ${N(cfg, it)}</div>` : ''}
          <div class="calc"><span class="num">${calc}</span>${cols.amount ? `<b class="num">${money(l.qty * l.rate)}</b>` : ''}</div></div>`;
      }).join('');
    } else {
      const head = (cols.item ? `<th>${t('Item')}</th>` : '') + (cols.qty ? `<th class="r">${t('KG')}</th>` : '') + (cols.rate ? `<th class="r">${t('Rate')}</th>` : '') + (cols.amount ? `<th class="r">${t('Amount')}</th>` : '');
      const rows = doc.lines.map((l) => {
        const it = Store.item(l.itemId);
        return `<tr>${cols.item ? `<td class="it">${N(cfg, it)}</td>` : ''}${cols.qty ? `<td class="r num">${kg2(l.qty)}</td>` : ''}${cols.rate ? `<td class="r num">${money(l.rate)}</td>` : ''}${cols.amount ? `<td class="r num">${money(l.qty * l.rate)}</td>` : ''}</tr>`;
      }).join('');
      if (head) b += `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    const totQty = doc.lines.reduce((s, l) => s + +l.qty, 0);
    b += '<div class="sep"></div>';
    if (cols.qty) b += `<div class="kv"><span>${t('Total quantity')}</span><span class="num">${kg2(totQty)} kg</span></div>`;
    b += `<div class="kv big blk"><span>${t('Bill total')}</span><b class="num">${money(bb.total)}</b></div>`;
    if (cfg.showBalance !== false) {
      b += `<div class="sep"></div><div class="bal blk">
        <div class="kv"><span>${t('Previous balance')}</span><span class="num">${money(bb.prev)}</span></div>
        <div class="kv"><span>${t('This bill')}</span><span class="num">${money(bb.total)}</span></div>
        <div class="kv"><span>${t('Received now')}</span><span class="num">${money(bb.received)}</span></div>
        <div class="kv now"><span>${t('Current balance')}</span><span class="num">${money(bb.after)}</span></div></div>`;
    } else if (bb.received) b += `<div class="kv"><span>${t('Received now')}</span><span class="num">${money(bb.received)}</span></div>`;
    if (cfg.showPayDetails && linked.length) {
      b += linked.map((p) => { const m = Store.method(p.method); return `<div class="small blk">${t('Method')}: ${N(cfg, m)}${p.ref ? ` · <span class="num">${esc(p.ref)}</span>` : ''}${p.handledBy ? ` · ${esc(p.handledBy)}` : ''}</div>`; }).join('');
    }
    if (doc.note) b += `<div class="small">${t('Note')}: ${esc(doc.note)}</div>`;
    const note = pick(cfg, cfg.note_ur, cfg.note_en); const ty = pick(cfg, cfg.footer_ur, cfg.footer_en);
    if (note || ty) b += `<div class="sep"></div><div class="foot blk">${note ? `<div class="small">${esc(note)}</div>` : ''}${ty ? `<div class="ty">${esc(ty)}</div>` : ''}</div>`;
    const base = esc(location.href.replace(/[^/]*$/, ''));
    return `<!doctype html><html lang="${cfg.lang === 'en' ? 'en' : 'ur'}"><head><meta charset="utf-8"><base href="${base}">
      <link rel="stylesheet" href="css/fonts.css"><style>${thermalCss(cfg)}</style></head><body><div class="rc">${b}</div></body></html>`;
  }
  function stockReceipt(doc, cfg) {
    const t = L(cfg); const v = Store.party('vendor', doc.vendorId); const farm = v && v.own_farm;
    const tot = Store.total(doc);
    const linked = Store.s.payments.filter((p) => p.docId === doc.id && Store.active(p));
    const paid = linked.reduce((s, p) => s + p.amount, 0);
    const pos = positionIn('vendor', doc.vendorId, (r) => r.kind === 'doc' && r.doc.id === doc.id);
    let body = header(cfg, 'Stock Receipt');
    body += `<div class="meta"><div><span class="k">${t('Receipt No.')}:</span> <b class="num">SR-${doc.no}</b></div>
      <div><span class="k">${t('Date')}:</span> <span class="num">${dmy(doc.date)} ${esc(doc.time || '')}</span></div>
      <div><span class="k">${t('Vendor')}:</span> <b>${N(cfg, v)}</b></div>
      <div>${doc.vendorBillNo ? `<span class="k">${t("Vendor's bill no.")}:</span> <span class="num">${esc(doc.vendorBillNo)}</span>` : ''}</div>
      ${doc.vehicle ? `<div><span class="k">${t('Vehicle / driver')}:</span> <span class="num">${esc(doc.vehicle)}</span></div>` : ''}</div>`;
    if (!Store.active(doc)) body += `<div style="text-align:center"><span class="stamp">${t('CANCELLED')}</span></div>`;
    body += docLines(cfg, doc, !farm && cfg.showRate);
    if (!farm) {
      body += `<div class="tot"><div><span>${t('Bill total')}</span><b class="num">${money(tot)}</b></div>
        ${cfg.showPrev ? `<div><span>${t('Previous balance')}</span><span class="num">${money(pos.prev)}</span></div>` : ''}
        ${cfg.showReceived ? `<div><span>${t('Paid now')}</span><span class="num">${money(paid)}</span></div>` : ''}
        ${cfg.showNewBal ? `<div class="big"><span>${t('Payable balance')}</span><span class="num">${money(pos.prev + tot - paid)}</span></div>` : ''}</div>`;
      if (cfg.showPayDetails && linked.length) body += linked.map((p) => payBlock(cfg, p)).join('');
    } else body += `<div class="muted" style="text-align:center">${t('Own farm — quantity only, no payable')}</div>`;
    return wrap(cfg, body + foot(cfg));
  }
  function paymentDoc(p, cfg) {
    const t = L(cfg); const isIn = p.dir === 'in'; const kind = isIn ? 'customer' : 'vendor';
    const party = Store.party(kind, p.partyId);
    const pos = positionIn(kind, p.partyId, (r) => r.kind === 'pay' && r.pay.id === p.id);
    let body = header(cfg, isIn ? 'Payment Receipt' : 'Payment Voucher');
    body += `<div class="meta"><div><span class="k">${t('No.')}:</span> <b class="num">${isIn ? 'RC' : 'VP'}-${p.no}</b></div>
      <div><span class="k">${t('Date')}:</span> <span class="num">${dmy(p.date)} ${esc(p.time || '')}</span></div>
      <div style="grid-column:1/-1"><span class="k">${t(isIn ? 'Received from' : 'Paid to')}:</span> <b>${N(cfg, party)}</b></div></div>`;
    if (!Store.active(p)) body += `<div style="text-align:center"><span class="stamp">${t('CANCELLED')}</span></div>`;
    body += `<div class="amount-box"><div class="muted">${t('Amount')} (PKR)</div><div class="n">${money(p.amount)}</div></div>`;
    if (cfg.showPayDetails) body += payBlock(cfg, p);
    if (cfg.showPrev || cfg.showNewBal) body += `<div class="tot">${cfg.showPrev ? `<div><span>${t('Previous balance')}</span><span class="num">${money(pos.prev)}</span></div>` : ''}
      ${cfg.showNewBal ? `<div class="big"><span>${t('Remaining balance')}</span><span class="num">${money(pos.after)}</span></div>` : ''}</div>`;
    return wrap(cfg, body + foot(cfg));
  }
  /** report: {title, subtitle, kpis:[{k,v}], sections:[{title, columns:[{label,num}], rows:[[..]], foot:[..]}]} — cell values are pre-formatted strings */
  function report(rep, cfg) {
    const t = L(cfg);
    let body = header(cfg, rep.title);
    if (rep.subtitle) body += `<div style="text-align:center" class="muted">${rep.subtitle}</div>`;
    if (rep.kpis && rep.kpis.length) body += `<div class="kpis">${rep.kpis.map((k) => `<div class="kpi"><div class="k">${t(k.k)}</div><div class="n num">${k.v}</div></div>`).join('')}</div>`;
    (rep.sections || []).forEach((sec) => {
      if (sec.title) body += `<div class="sec">${t(sec.title)}</div>`;
      body += `<table><thead><tr>${sec.columns.map((c) => `<th class="${c.num ? 'r' : ''}">${t(c.label)}</th>`).join('')}</tr></thead><tbody>
        ${sec.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${sec.columns[i].num ? 'r num' : ''}">${v}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${sec.columns.length}" class="muted" style="text-align:center">${t('No records')}</td></tr>`}</tbody>
        ${sec.foot ? `<tfoot><tr>${sec.foot.map((v, i) => `<td class="${sec.columns[i].num ? 'r num' : ''}">${v}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
    });
    body += `<div class="foot num">${t('Printed')}: ${dmy(Store.today())} ${Store.nowTime()}</div>`;
    return wrap(cfg, body);
  }

  function cfgFor(type, override) {
    const cfg = { ...Store.s.settings.print[type], ...(override || {}) };
    if (type !== 'sale' && isThermal(cfg.paper)) cfg.paper = 'A6'; // the thermal layout is for sale invoices
    return cfg;
  }
  function build(type, obj, override) {
    const cfg = cfgFor(type, override);
    if (type === 'sale') return saleInvoice(obj, cfg);
    if (type === 'receipt') return stockReceipt(obj, cfg);
    if (type === 'recovery' || type === 'payment') return paymentDoc(obj, cfg);
    return report(obj, cfg);
  }
  /* A thermal receipt is one long page exactly as tall as the bill: no page breaks, no blank paper fed.
   * The height is measured here (fonts loaded) and written into @page before printing. */
  async function fitHeight(html) {
    const m = /\/\*THERMAL:([\d.]+)\*\//.exec(html); if (!m) return html;
    const wmm = +m[1];
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + wmm + 'mm;height:200px;border:0;visibility:hidden';
    document.body.appendChild(f);
    try {
      await new Promise((r) => { f.onload = r; f.srcdoc = html; });
      try { await f.contentDocument.fonts.ready; } catch (e) { /* ignore */ }
      await new Promise((r) => setTimeout(r, 60));
      const px = f.contentDocument.querySelector('.rc').getBoundingClientRect().height;
      let hmm = Math.ceil(px * 25.4 / 96 * 1.02) + 4; // print layout runs a little taller on long Urdu bills
      if (hmm > 5000) hmm = 297; // extremely long bill: normal pages, rows never split (break-inside: avoid)
      return html.replace('@page{size:' + wmm + 'mm 297mm', '@page{size:' + wmm + 'mm ' + hmm + 'mm');
    } finally { f.remove(); }
  }
  const pageSizeOf = (html) => {
    const m = /@page{size:([\d.]+)mm ([\d.]+)mm/.exec(html);
    return m ? { width: Math.round(+m[1] * 1000), height: Math.round(+m[2] * 1000) } : 'A4';
  };
  /** opts: { printer, silent } from the print designer */
  async function printHtml(html, opts = {}) {
    html = await fitHeight(html);
    // Desktop app: Windows printing through Electron (print dialog, or straight to the chosen printer when silent)
    if (window.PM && window.PM.print) {
      const paper = pageSizeOf(html);
      const r = await window.PM.print(html, { paper, thermal: /\/\*THERMAL:/.test(html), printer: opts.printer || '', silent: !!opts.silent });
      if (r && !r.ok && r.reason && !/cancel/i.test(r.reason)) UI.toast(I18N.t('Print') + ': ' + r.reason, 'error');
      else if (r && r.ok && opts.silent) UI.toast(I18N.t('Sent to printer') + (opts.printer ? ' — ' + opts.printer : ''), 'success');
      return r;
    }
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    f.onload = async () => {
      try { await f.contentDocument.fonts.ready; } catch (e) { /* ignore */ }
      setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 150);
    };
    f.srcdoc = html;
  }
  async function savePdf(html, name) {
    html = await fitHeight(html);
    if (!(window.PM && window.PM.savePdf)) return printHtml(html); // browser demo: print dialog, then Save as PDF
    const r = await window.PM.savePdf(html, { name });
    if (r && r.ok) UI.toast(I18N.t('PDF saved') + ' — ' + r.file, 'success');
    else if (r && r.reason && !/cancel/i.test(r.reason)) UI.toast('PDF: ' + r.reason, 'error');
    return r;
  }
  const device = (cfg) => ({ printer: cfg.printer || '', silent: !!cfg.silent });
  window.Print = {
    build, printHtml, savePdf, fitHeight, esc, cfgFor, device, isThermal, PAPER, fmtDate, fmtTime,
    previewWidth: (paper) => (isThermal(paper) ? pxOf(PAPER[paper].w) : { A4: 794, A5: 560, A6: 400 }[paper] || 560),
    print: (type, obj, o) => printHtml(build(type, obj, o), device(cfgFor(type, o))),
  };
})();
