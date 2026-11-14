/* Shared UI components (Preact + htm, no build step). */
(function () {
  'use strict';
  const { html, useState, useEffect, useMemo, useRef } = window.htmPreact;
  const { t, nm, money, qty, dmy } = I18N;

  /* re-render on store or language change */
  function useStore() {
    const [, set] = useState(0);
    useEffect(() => { const a = Store.subscribe(() => set((x) => x + 1)); const b = I18N.subscribe(() => set((x) => x + 1)); return () => { a(); b(); }; }, []);
    return Store.s;
  }

  const Ico = ({ n, cls }) => html`<i class=${'bi bi-' + n + (cls ? ' ' + cls : '')} aria-hidden="true"></i>`;
  const Num = ({ v, cls }) => html`<span class=${'num ' + (cls || '')}>${money(v)}</span>`;
  const Qty = ({ v, unit }) => html`<span class="num">${qty(v)}</span>${unit ? html` <small class="muted">${t(unit)}</small>` : ''}`;
  const D = ({ v }) => html`<span class="num">${dmy(v)}</span>`;

  function Btn({ kind = 'default', icon, children, onClick, disabled, type = 'button', title, size, block }) {
    return html`<button type=${type} title=${title} class=${'btn btn-' + kind + (size ? ' btn-' + size : '') + (block ? ' btn-block' : '')} onClick=${onClick} disabled=${disabled}>
      ${icon && html`<${Ico} n=${icon} />`}${children && html`<span>${children}</span>`}</button>`;
  }
  function Field({ label, children, hint, req, span }) {
    return html`<label class=${'field' + (span ? ' span-' + span : '')}><span class="field-l">${label}${req && html`<b class="req">*</b>`}</span>${children}${hint && html`<span class="field-h">${hint}</span>`}</label>`;
  }
  function Badge({ s }) {
    const map = { paid: ['green', 'Paid'], partial: ['yellow', 'Partially paid'], unpaid: ['red', 'Unpaid'], cancelled: ['grey', 'Cancelled'], farm: ['teal', 'Own farm'], active: ['green', 'Active'], inactive: ['grey', 'Inactive'] };
    const [c, l] = map[s] || ['grey', s];
    return html`<span class=${'badge badge-' + c}>${t(l)}</span>`;
  }
  function Side({ v, kind }) {
    if (!v) return html`<span class="badge badge-green">${t('Settled')}</span>`;
    const recv = kind === 'customer' ? v > 0 : v < 0;
    return html`<span class=${'side ' + (recv ? 'side-lena' : 'side-dena')}>${recv ? t('To receive') : t('To pay')}</span>`;
  }

  /* ---------- toasts & dialogs ---------- */
  const toastSubs = new Set(); let tseq = 0;
  function toast(msg, type = 'info', ms) { const x = { id: ++tseq, msg, type }; toastSubs.forEach((f) => f(x)); setTimeout(() => toastSubs.forEach((f) => f({ id: x.id, remove: true })), ms || (type === 'error' ? 6000 : 3500)); }
  function Toasts() {
    const [list, set] = useState([]);
    useEffect(() => { const f = (x) => set((l) => (x.remove ? l.filter((y) => y.id !== x.id) : [...l, x])); toastSubs.add(f); return () => toastSubs.delete(f); }, []);
    const ic = { success: 'check-circle-fill', error: 'x-octagon-fill', warn: 'exclamation-triangle-fill', info: 'info-circle-fill' };
    return html`<div class="toasts">${list.map((x) => html`<div key=${x.id} class=${'toast toast-' + x.type}><${Ico} n=${ic[x.type]} /><span>${x.msg}</span></div>`)}</div>`;
  }
  const dlgSubs = new Set();
  function ask(opts) { return new Promise((resolve) => dlgSubs.forEach((f) => f({ ...opts, resolve }))); }
  const confirmBox = (title, body, opts = {}) => ask({ title, body, ...opts });
  function Dialogs() {
    const [d, set] = useState(null); const [val, setVal] = useState('');
    useEffect(() => { const f = (x) => { setVal(''); set(x); }; dlgSubs.add(f); return () => dlgSubs.delete(f); }, []);
    if (!d) return null;
    const close = (r) => { set(null); d.resolve(r); };
    const ok = () => { if (d.input && d.inputReq && !val.trim()) return; close(d.input ? val.trim() : true); };
    return html`<${Modal} title=${d.title} onClose=${() => close(false)} size="sm" footer=${html`
      <${Btn} kind="ghost" onClick=${() => close(false)}>${t('Back')}</${Btn}>
      <${Btn} kind=${d.danger ? 'danger' : 'primary'} icon=${d.danger ? 'x-circle' : 'check2'} onClick=${ok}>${d.okLabel || t('Confirm')}</${Btn}>`}>
      <div class="dlg-body">${d.body}</div>
      ${d.input && html`<${Field} label=${d.input} req=${d.inputReq}><input class="inp" autoFocus value=${val} onInput=${(e) => setVal(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && ok()} /></${Field}>`}
    </${Modal}>`;
  }

  function Modal({ title, children, footer, onClose, size }) {
    useEffect(() => { const k = (e) => e.key === 'Escape' && onClose && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
    return html`<div class="ovl" onMouseDown=${(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div class=${'modal modal-' + (size || 'md')} role="dialog" aria-modal="true">
        <div class="modal-h"><h3>${title}</h3>${onClose && html`<button class="x" onClick=${onClose} aria-label=${t('Close')}><${Ico} n="x-lg" /></button>`}</div>
        <div class="modal-b">${children}</div>${footer && html`<div class="modal-f">${footer}</div>`}</div></div>`;
  }

  /* ---------- page structure ---------- */
  function Page({ title, icon, sub, actions, children }) {
    return html`<div class="page"><div class="page-h"><div class="page-t">${icon && html`<span class="page-ic"><${Ico} n=${icon} /></span>`}<div><h1>${title}</h1>${sub && html`<div class="muted">${sub}</div>`}</div></div>
      <div class="page-a">${actions}</div></div>${children}</div>`;
  }
  function Card({ title, actions, children, pad = true, cls }) {
    return html`<section class=${'card ' + (cls || '')}>${(title || actions) && html`<div class="card-h"><h2>${title}</h2><div class="card-a">${actions}</div></div>`}<div class=${pad ? 'card-b' : ''}>${children}</div></section>`;
  }
  function Kpi({ label, value, icon, tone, sub, onClick }) {
    return html`<div class=${'kpi kpi-' + (tone || 'brand') + (onClick ? ' clickable' : '')} onClick=${onClick}><div class="kpi-ic"><${Ico} n=${icon} /></div>
      <div><div class="kpi-l">${label}</div><div class="kpi-v num">${value}</div>${sub && html`<div class="kpi-s">${sub}</div>`}</div></div>`;
  }
  function Empty({ icon = 'inbox', text }) { return html`<div class="empty"><${Ico} n=${icon} /><div>${text || t('No records')}</div></div>`; }

  /** columns: [{label, render(row), num, cls}] */
  function Table({ columns, rows, onRow, foot, empty, rowCls, limit }) {
    const [n, setN] = useState(limit || 100000);
    if (!rows.length) return html`<${Empty} text=${empty} />`;
    return html`<div class="tbl-wrap"><table class="tbl"><thead><tr>${columns.map((c) => html`<th class=${(c.num ? 'r ' : '') + (c.cls || '')}>${c.label}</th>`)}</tr></thead>
      <tbody>${rows.slice(0, n).map((r, i) => html`<tr key=${r.id || i} class=${(onRow ? 'clickable ' : '') + (rowCls ? rowCls(r) || '' : '')} onClick=${onRow ? () => onRow(r) : null}>
        ${columns.map((c) => html`<td class=${(c.num ? 'r ' : '') + (c.cls || '')}>${c.render(r, i)}</td>`)}</tr>`)}</tbody>
      ${foot && html`<tfoot><tr>${foot.map((f, i) => html`<td class=${columns[i] && columns[i].num ? 'r' : ''}>${f}</td>`)}</tr></tfoot>`}</table>
      ${rows.length > n && html`<div class="more"><${Btn} kind="ghost" onClick=${() => setN(n + 100)}>${t('Show more')} (${rows.length - n})</${Btn}></div>`}</div>`;
  }

  function Seg({ value, options, onChange }) {
    return html`<div class="seg">${options.map((o) => html`<button type="button" class=${o.value === value ? 'on' : ''} onClick=${() => onChange(o.value)}>${o.icon && html`<${Ico} n=${o.icon} />`}${o.label}</button>`)}</div>`;
  }
  function Search({ value, onInput, placeholder }) {
    return html`<div class="search"><${Ico} n="search" /><input class="inp" value=${value} placeholder=${placeholder || t('Search')} onInput=${(e) => onInput(e.target.value)} /></div>`;
  }
  function DateInp({ value, onChange, max }) { return html`<input type="date" class="inp num" value=${value} max=${max} onChange=${(e) => onChange(e.target.value)} />`; }

  /* ---------- pickers ---------- */
  function PartyPicker({ kind, value, onChange, onNew, autoFocus }) {
    const s = useStore();
    const list = (kind === 'customer' ? s.customers : s.vendors).filter((p) => p.active || p.id === value);
    const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const ref = useRef();
    useEffect(() => { const f = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
    const sel = list.find((p) => p.id === value);
    const ql = q.toLowerCase();
    const hits = list.filter((p) => !q || [p.name_ur, p.name_en, p.code, p.phone].some((x) => (x || '').toLowerCase().includes(ql)));
    return html`<div class="picker" ref=${ref}>
      <button type="button" class=${'inp picker-btn' + (sel ? '' : ' placeholder')} onClick=${() => setOpen(!open)} autoFocus=${autoFocus}>
        ${sel ? html`<span><b>${nm(sel)}</b> <small class="muted num">${sel.code}${sel.phone ? ' · ' + sel.phone : ''}</small></span>` : t(kind === 'customer' ? 'Choose customer' : 'Choose vendor')}<${Ico} n="chevron-down" /></button>
      ${open && html`<div class="picker-pop"><input class="inp" autoFocus placeholder=${t('Search by name, ID or phone')} value=${q} onInput=${(e) => setQ(e.target.value)} />
        <div class="picker-list">${hits.map((p) => { const b = Store.balance(kind, p.id); return html`<button type="button" class=${'picker-opt' + (p.id === value ? ' on' : '')} onClick=${() => { onChange(p.id); setOpen(false); setQ(''); }}>
          <span><b>${nm(p)}</b> <small class="muted num">${p.code}${p.phone ? ' · ' + p.phone : ''}</small>${p.own_farm ? html` <span class="badge badge-teal">${t('Own farm')}</span>` : ''}</span><span class="num muted">${money(b)}</span></button>`; })}
          ${!hits.length && html`<div class="muted pad">${t('No match')}</div>`}</div>
        ${onNew && html`<button type="button" class="picker-new" onClick=${() => { setOpen(false); onNew(q); }}><${Ico} n="plus-circle" /> ${t(kind === 'customer' ? 'Add new customer' : 'Add new vendor')}</button>`}</div>`}
    </div>`;
  }
  function ItemSelect({ value, onChange }) {
    const s = useStore();
    return html`<select class="inp" value=${value} onChange=${(e) => onChange(e.target.value)}><option value="">${t('Choose item')}</option>
      ${s.items.filter((i) => i.active || i.id === value).map((i) => html`<option value=${i.id}>${nm(i)}</option>`)}</select>`;
  }
  function MethodSelect({ value, onChange }) {
    const s = useStore();
    return html`<div class="chips">${s.methods.filter((m) => m.active).map((m) => html`<button type="button" class=${'chip' + (m.id === value ? ' on' : '')} onClick=${() => onChange(m.id)}>${nm(m)}</button>`)}</div>`;
  }

  /* Name in both scripts with Roman Urdu -> Urdu converter */
  function NameFields({ value, onChange, label }) {
    const [busy, setBusy] = useState(false);
    const convert = async () => {
      if (!value.name_en) { toast(t('Type the name in Roman/English first'), 'warn'); return; }
      setBusy(true);
      const r = await Translit.toUrdu(value.name_en);
      setBusy(false);
      onChange({ ...value, name_ur: r.text });
      if (r.mode === 'offline') toast(t('No internet connection — basic offline conversion used. Please check the Urdu spelling.'), 'warn', 6000);
      else toast(t('Converted to Urdu'), 'success');
    };
    return html`<div class="name-pair">
      <${Field} label=${(label || t('Name')) + ' — ' + t('English / Roman')} req><input class="inp" dir="ltr" value=${value.name_en} placeholder="e.g. Javed Iqbal" onInput=${(e) => onChange({ ...value, name_en: e.target.value })} /></${Field}>
      <button type="button" class="conv" onClick=${convert} disabled=${busy} title=${t('Convert Roman to Urdu')}><${Ico} n=${busy ? 'hourglass-split' : 'translate'} /><span>${t('To Urdu')}</span></button>
      <${Field} label=${(label || t('Name')) + ' — ' + t('Urdu')}><input class="inp urdu" dir="rtl" value=${value.name_ur} placeholder="جاوید اقبال" onInput=${(e) => onChange({ ...value, name_ur: e.target.value })} /></${Field}>
    </div>`;
  }

  /* Payment detail fields shared by recoveries, vendor payments and paid-now on bills */
  function PaymentFields({ value, onChange, dir }) {
    const s = useStore();
    const set = (k) => (e) => onChange({ ...value, [k]: e.target ? e.target.value : e });
    const m = Store.method(value.method);
    const nonCash = !m.cash;
    return html`<div class="payf">
      <${Field} label=${t('Payment method')} req span="2"><${MethodSelect} value=${value.method} onChange=${set('method')} /></${Field}>
      ${nonCash && html`<${Field} label=${t(value.method === 'cheque' ? 'Cheque no.' : 'Transaction ID / reference')} req><input class="inp num" dir="ltr" value=${value.ref} onInput=${set('ref')} placeholder="TID…" /></${Field}>`}
      ${nonCash && html`<${Field} label=${t('From account')} hint=${t(dir === 'out' ? 'Our bank / wallet' : "Customer's bank / wallet / number")}><input class="inp" list="pm-accounts" value=${value.fromAcc} onInput=${set('fromAcc')} /></${Field}>`}
      ${nonCash && html`<${Field} label=${t('To account')} hint=${t(dir === 'out' ? "Vendor's bank / wallet / number" : 'Our bank / wallet')}><input class="inp" list="pm-accounts" value=${value.toAcc} onInput=${set('toAcc')} /></${Field}>`}
      <${Field} label=${t('Handled by')} hint=${t(dir === 'out' ? "Vendor's person who collected the payment" : 'Person who brought the payment')}><input class="inp" value=${value.handledBy} onInput=${set('handledBy')} /></${Field}>
      <${Field} label=${t('Paid on behalf of / by')} hint=${t('Third party, if any')}><input class="inp" value=${value.onBehalf} onInput=${set('onBehalf')} /></${Field}>
      <${Field} label=${t('Note')} span="2"><input class="inp" value=${value.note} onInput=${set('note')} /></${Field}>
      <datalist id="pm-accounts">${s.settings.accounts.map((a) => html`<option value=${a} />`)}</datalist>
    </div>`;
  }
  const emptyPayment = () => ({ method: 'cash', ref: '', fromAcc: '', toAcc: '', handledBy: '', onBehalf: '', note: '' });
  function paymentValid(p) {
    const m = Store.method(p.method);
    if (!m.cash && !String(p.ref || '').trim()) return t('Enter the transaction ID / reference for non-cash payments');
    return '';
  }

  /* Paper-sized iframe that shrinks to fit its container */
  function FitFrame({ doc, width }) {
    const ref = useRef(); const [z, setZ] = useState(1);
    useEffect(() => {
      const el = ref.current; if (!el) return;
      const fit = () => setZ(Math.min(1, (el.clientWidth - 32) / width));
      fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
    }, [width]);
    return html`<div class="preview-stage" ref=${ref}><iframe class="preview-frame" style=${'width:' + width + 'px;zoom:' + z} srcdoc=${doc} title="preview"></iframe></div>`;
  }

  /* Print preview with print button */
  function PrintPreview({ type, obj, title, onClose }) {
    useStore();
    const [paper, setPaper] = useState(Store.s.settings.print[type].paper);
    const [lang, setLang] = useState(Store.s.settings.print[type].lang);
    const doc = Print.build(type, obj, { paper, lang });
    const w = { A4: 794, A5: 560, A6: 400 }[paper];
    return html`<${Modal} title=${title || t('Print preview')} onClose=${onClose} size="lg" footer=${html`
      <${Seg} value=${paper} onChange=${setPaper} options=${['A4', 'A5', 'A6'].map((p) => ({ value: p, label: p }))} />
      <${Seg} value=${lang} onChange=${setLang} options=${[{ value: 'ur', label: 'اردو' }, { value: 'en', label: 'English' }, { value: 'both', label: t('Both') }]} />
      <span class="grow"></span>
      <${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}>
      <${Btn} kind="primary" icon="printer" onClick=${() => Print.printHtml(doc)}>${t('Print')}</${Btn}>`}>
      <${FitFrame} doc=${doc} width=${w} />
    </${Modal}>`;
  }

  window.UI = { html, useState, useEffect, useMemo, useRef, useStore, Ico, Num, Qty, D, Btn, Field, Badge, Side, toast, confirmBox, ask, Toasts, Dialogs, Modal, Page, Card, Kpi, Empty, Table, Seg, Search, DateInp, PartyPicker, ItemSelect, MethodSelect, NameFields, PaymentFields, emptyPayment, paymentValid, PrintPreview, FitFrame };
})();
