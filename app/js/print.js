/* Printable documents: sale invoice, stock receipt, recovery receipt, payment voucher, reports.
 * Each document type has its own settings (template, paper, language, toggles) from the print designer.
 */
(function () {
  'use strict';
  const { money, qty, dmy } = I18N;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAPER = { A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 }, A6: { w: 105, h: 148 } };
  const FONT = { s: 10.5, m: 12, l: 13.5 };

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
    const t = L(cfg); const c = Store.party('customer', doc.customerId);
    const tot = Store.total(doc);
    const linked = Store.s.payments.filter((p) => p.docId === doc.id && Store.active(p));
    const received = linked.reduce((s, p) => s + p.amount, 0);
    const pos = positionIn('customer', doc.customerId, (r) => r.kind === 'doc' && r.doc.id === doc.id);
    const prev = pos.prev; const newBal = prev + tot - received;
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

  function cfgFor(type, override) { return { ...Store.s.settings.print[type], ...(override || {}) }; }
  function build(type, obj, override) {
    const cfg = cfgFor(type, override);
    if (type === 'sale') return saleInvoice(obj, cfg);
    if (type === 'receipt') return stockReceipt(obj, cfg);
    if (type === 'recovery' || type === 'payment') return paymentDoc(obj, cfg);
    return report(obj, cfg);
  }
  function printHtml(html) {
    // Desktop app: Windows print dialog through Electron, page size taken from the design
    if (window.PM && window.PM.print) {
      const m = /@page{size:([d.]+)mm ([d.]+)mm/.exec(html);
      const paper = m ? { width: Math.round(+m[1] * 1000), height: Math.round(+m[2] * 1000) } : 'A4';
      return window.PM.print(html, { paper }).then((r) => { if (r && !r.ok && r.reason && !/cancel/i.test(r.reason)) UI.toast('Print: ' + r.reason, 'error'); return r; });
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
  window.Print = { build, printHtml, print: (type, obj, o) => printHtml(build(type, obj, o)), esc };
})();
