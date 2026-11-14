/* Recoveries (money in), vendor payments (money out), expenses. */
(function () {
  'use strict';
  const { html, useState, useStore, Ico, Num, D, Btn, Field, Badge, Side, toast, confirmBox, ask, Modal, Page, Card, Table, Seg, Search, DateInp, PartyPicker, MethodSelect, PaymentFields, emptyPayment, paymentValid, PrintPreview, Kpi } = UI;
  const { t, tf, nm, money } = I18N;
  const nav = (...a) => App.nav(...a);
  const META = {
    in: { kind: 'customer', title: 'Recoveries', one: 'Recovery', icon: 'cash-coin', route: 'recoveries', newLabel: 'New recovery', partyLabel: 'Customer', printType: 'recovery' },
    out: { kind: 'vendor', title: 'Vendor Payments', one: 'Vendor payment', icon: 'send', route: 'payments', newLabel: 'New vendor payment', partyLabel: 'Vendor', printType: 'payment' },
  };
  const payCols = (withParty) => [
    { label: t('No.'), render: (p) => html`<b class="num">${Util.payNo(p)}</b>` },
    { label: t('Date'), render: (p) => html`<${D} v=${p.date} /> <small class="muted num">${p.time}</small>` },
    ...(withParty ? [{ label: t('Name'), render: (p) => html`<b>${nm(Store.partyOf(p.partyId))}</b>` }] : []),
    { label: t('Method'), render: (p) => html`<span class=${'badge badge-m-' + p.method}>${nm(Store.method(p.method))}</span>` },
    { label: t('Reference'), render: (p) => html`<span class="num small">${p.ref}</span>` },
    { label: t('Handled by'), render: (p) => html`<span class="small">${p.handledBy}${p.onBehalf ? html`<div class="muted">${t('on behalf')}: ${p.onBehalf}</div>` : ''}</span>` },
    { label: t('Amount'), num: true, render: (p) => html`<b><${Num} v=${p.amount} /></b>` },
    { label: '', render: (p) => (p.status === 'cancelled' ? html`<${Badge} s="cancelled" />` : p.docId ? html`<small class="muted">${t('with bill')}</small>` : '') },
  ];

  function PayList({ dir }) {
    const s = useStore(); const M = META[dir];
    const [q, setQ] = useState(''); const [period, setPeriod] = useState('month'); const [m, setM] = useState('');
    const [from, to] = Util.range(period);
    const rows = s.payments.filter((p) => p.dir === dir && p.date >= from && p.date <= to && (!m || p.method === m))
      .filter((p) => { const pt = Store.partyOf(p.partyId); return Util.matches(q, pt && pt.name_ur, pt && pt.name_en, p.ref, p.handledBy, p.onBehalf, p.no); })
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const act = rows.filter(Store.active); const tot = act.reduce((a, p) => a + p.amount, 0);
    const byM = {}; act.forEach((p) => (byM[p.method] = (byM[p.method] || 0) + p.amount));
    return html`<${Page} title=${t(M.title)} icon=${M.icon} actions=${html`<${Btn} kind="primary" size="lg" icon="plus-lg" onClick=${() => nav(M.route + '-new')}>${t(M.newLabel)}</${Btn}>`}>
      <div class="kpis"><${Kpi} icon="cash-stack" tone=${dir === 'in' ? 'green' : 'red'} label=${t('Total')} value=${money(tot)} sub=${act.length + ' ' + t('entries')} />
        ${Object.keys(byM).map((k) => html`<${Kpi} icon=${Store.method(k).cash ? 'cash' : 'phone'} tone="teal" label=${nm(Store.method(k))} value=${money(byM[k])} />`)}</div>
      <${Card} pad=${false}>
        <div class="filters"><${Search} value=${q} onInput=${setQ} placeholder=${t('Search name, TID or person')} />
          <${Seg} value=${period} onChange=${setPeriod} options=${Util.periodOptions()} />
          <select class="inp w-auto" value=${m} onChange=${(e) => setM(e.target.value)}><option value="">${t('All methods')}</option>${s.methods.map((x) => html`<option value=${x.id}>${nm(x)}</option>`)}</select></div>
        <${Table} limit=${60} rows=${rows} onRow=${(p) => App.openPayment(p.id)} rowCls=${(p) => (p.status === 'cancelled' ? 'row-cancel' : '')} columns=${payCols(true)}
          foot=${['', '', t('Total'), '', '', '', html`<b><${Num} v=${tot} /></b>`, '']} />
      </${Card}></${Page}>`;
  }

  function PayForm({ dir, partyId: initialParty }) {
    const s = useStore(); const M = META[dir];
    const [f, setF] = useState(() => ({ partyId: initialParty || '', date: Store.today(), amount: '', ...emptyPayment(), method: dir === 'out' ? 'online' : 'cash' }));
    const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false);
    const party = f.partyId ? Store.party(M.kind, f.partyId) : null;
    const bal = party ? Store.balance(M.kind, party.id) : 0;
    const amt = +f.amount || 0;
    const unpaid = party ? (M.kind === 'customer' ? s.invoices : s.receipts).filter((d) => Store.docParty(d) === party.id).map((d) => ({ d, x: Store.docStatus(M.kind, d) })).filter((r) => r.x.due > 0).sort((a, b) => a.d.date.localeCompare(b.d.date)) : [];
    // preview of oldest-first settlement
    let pool = amt; const alloc = unpaid.map((r) => { const a = Math.min(pool, r.x.due); pool -= a; return { ...r, a }; });
    async function save(andPrint) {
      if (busy) return;
      if (!f.partyId) return toast(t(dir === 'in' ? 'Choose the customer' : 'Choose the vendor'), 'error');
      if (!(amt > 0)) return toast(t('Enter the amount'), 'error');
      const err = paymentValid(f); if (err) return toast(err, 'error');
      if (amt > bal && bal >= 0 && !(await confirmBox(t('Amount is more than the balance'), tf('Balance is {b}. The extra {x} will be kept as advance. Continue?', { b: money(bal), x: money(amt - bal) })))) return;
      if (Store.isDuplicatePayment(dir, f) && !(await confirmBox(t('Possible duplicate'), t('The same payment was saved a moment ago. Save it again?'), { okLabel: t('Save again') }))) return;
      setBusy(true); const p = Store.savePayment(dir, { ...f, amount: amt }); setBusy(false);
      toast(tf('{no} saved', { no: Util.payNo(p) }), 'success');
      if (andPrint) setPreview(p); else history.back();
    }
    return html`<${Page} title=${t(M.newLabel)} icon=${M.icon} actions=${html`<${Btn} kind="ghost" icon="arrow-right-short" onClick=${() => history.back()}>${t('Back')}</${Btn}>`}>
      <div class="form-grid"><div class="form-main">
        <${Card} title=${t(M.partyLabel)}>
          <div class="grid-2"><${Field} label=${t(M.partyLabel)} req span="2"><${PartyPicker} kind=${M.kind} value=${f.partyId} onChange=${(v) => setF({ ...f, partyId: v })} autoFocus=${!f.partyId} /></${Field}>
            <${Field} label=${t('Date')}><${DateInp} value=${f.date} onChange=${(v) => setF({ ...f, date: v })} /></${Field}>
            <${Field} label=${t('Amount')} req><input class="inp num big-num xl" type="number" min="0" value=${f.amount} onInput=${(e) => setF({ ...f, amount: e.target.value })} /></${Field}></div>
          ${party && bal > 0 && html`<div class="quick"><${Btn} kind="ghost" onClick=${() => setF({ ...f, amount: String(bal) })}>${t('Full balance')} <span class="num">${money(bal)}</span></${Btn}>
            ${unpaid.length > 0 && html`<${Btn} kind="ghost" onClick=${() => setF({ ...f, amount: String(unpaid[0].x.due) })}>${t('Oldest bill')} <span class="num">${money(unpaid[0].x.due)}</span></${Btn}>`}</div>`}
        </${Card}>
        <${Card} title=${t('Payment details')}><${PaymentFields} dir=${dir} value=${f} onChange=${(v) => setF({ ...f, ...v })} /></${Card}>
        ${party && unpaid.length > 0 && html`<${Card} title=${t('Bills this payment will settle (oldest first)')} pad=${false}>
          <${Table} rows=${alloc} columns=${[
            { label: t('No.'), render: (r) => html`<span class="num">${Util.docNo(M.kind, r.d)}</span>` }, { label: t('Date'), render: (r) => html`<${D} v=${r.d.date} />` },
            { label: t('Remaining'), num: true, render: (r) => html`<${Num} v=${r.x.due} />` }, { label: t('Settled now'), num: true, render: (r) => (r.a ? html`<b class="tx-credit"><${Num} v=${r.a} /></b>` : '') },
            { label: '', render: (r) => (r.a >= r.x.due ? html`<${Badge} s="paid" />` : r.a > 0 ? html`<${Badge} s="partial" />` : '') }]} /></${Card}>`}
      </div>
      <aside class="form-side"><div class="totals card">
        <div class="tot-row"><span>${t('Current balance')}</span><span class="num">${money(bal)}</span></div>
        <div class="tot-row big"><span>${t(dir === 'in' ? 'Received' : 'Paid')}</span><b class="num">${money(amt)}</b></div>
        <div class="tot-row grand"><span>${t('Balance after')}</span><b class="num">${money(bal - amt)}</b></div>
        <div class="side-actions">
          <${Btn} kind="primary" size="lg" block icon="printer" onClick=${() => save(true)} disabled=${busy}>${t('Save and print')}</${Btn}>
          <${Btn} size="lg" block icon="check2" onClick=${() => save(false)} disabled=${busy}>${t('Save')}</${Btn}>
          <${Btn} kind="ghost" block onClick=${() => history.back()}>${t('Back')}</${Btn}></div>
      </div></aside></div>
      ${preview && html`<${PrintPreview} type=${M.printType} obj=${preview} title=${t(dir === 'in' ? 'Payment Receipt' : 'Payment Voucher')} onClose=${() => { setPreview(null); history.back(); }} />`}
    </${Page}>`;
  }

  /* payment detail modal (opened from anywhere) */
  function PaymentModal({ id, onClose }) {
    const s = useStore(); const p = s.payments.find((x) => x.id === id);
    const [preview, setPreview] = useState(false);
    if (!p) return null;
    const M = META[p.dir]; const party = Store.party(M.kind, p.partyId);
    const doc = p.docId ? (p.dir === 'in' ? s.invoices : s.receipts).find((d) => d.id === p.docId) : null;
    const cancel = async () => {
      const reason = await ask({ title: tf('Cancel {no}?', { no: Util.payNo(p) }), body: t('The entry stays on record marked as cancelled and the balance is reversed.'), input: t('Reason'), inputReq: true, danger: true, okLabel: t('Cancel entry') });
      if (reason) { Store.cancelPayment(p.id, reason); toast(t('Entry cancelled'), 'success'); }
    };
    const row = (k, v) => v ? html`<div class="kv"><span>${t(k)}</span><b>${v}</b></div>` : null;
    return html`<${Modal} title=${t(M.one) + ' ' + Util.payNo(p)} onClose=${onClose} footer=${html`
      ${p.status !== 'cancelled' && html`<${Btn} kind="danger-ghost" icon="x-circle" onClick=${cancel}>${t('Cancel entry')}</${Btn}>`}<span class="grow"></span>
      <${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}><${Btn} kind="primary" icon="printer" onClick=${() => setPreview(true)}>${t('Print')}</${Btn}>`}>
      ${p.status === 'cancelled' && html`<div class="alert alert-red">${t('Cancelled')} <${D} v=${p.cancelDate} /> — ${p.cancelReason}</div>`}
      <div class="amount-hero"><span class="muted">${t(p.dir === 'in' ? 'Received from' : 'Paid to')} <a onClick=${() => { onClose(); nav(M.kind, { id: party.id }); }}><b>${nm(party)}</b></a></span><div class="num">${money(p.amount)}</div></div>
      <div class="kvs">${row('Date', html`<span class="num">${I18N.dmy(p.date)} ${p.time}</span>`)}${row('Payment method', nm(Store.method(p.method)))}${row('Transaction ID / reference', html`<span class="num">${p.ref}</span>`)}
        ${row('From account', p.fromAcc)}${row('To account', p.toAcc)}${row('Handled by', p.handledBy)}${row('Paid on behalf of / by', p.onBehalf)}${row('Note', p.note)}
        ${doc && row('With bill', html`<a class="num" onClick=${() => { onClose(); nav(META[p.dir].kind === 'customer' ? 'sales-view' : 'receipts-view', { id: doc.id }); }}>${Util.docNo(M.kind, doc)}</a>`)}</div>
      ${preview && html`<${PrintPreview} type=${M.printType} obj=${p} onClose=${() => setPreview(false)} />`}
    </${Modal}>`;
  }

  /* ---------------- expenses ---------------- */
  function Expenses() {
    const s = useStore();
    const [period, setPeriod] = useState('month'); const [cat, setCat] = useState(''); const [q, setQ] = useState('');
    const [form, setForm] = useState(null);
    const [from, to] = Util.range(period);
    const tot = (a, b) => s.expenses.filter((e) => Store.active(e) && e.date >= a && e.date <= b).reduce((x, e) => x + e.amount, 0);
    const [d1] = Util.range('today'); const [m1, m2] = Util.range('month'); const [y1, y2] = Util.range('year');
    const rows = s.expenses.filter((e) => e.date >= from && e.date <= to && (!cat || e.categoryId === cat) && Util.matches(q, e.desc)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const act = rows.filter(Store.active); const sum = act.reduce((x, e) => x + e.amount, 0);
    const byCat = {}; act.forEach((e) => (byCat[e.categoryId] = (byCat[e.categoryId] || 0) + e.amount));
    const cancel = async (e) => {
      const reason = await ask({ title: t('Cancel expense?'), body: e.desc, input: t('Reason'), inputReq: true, danger: true, okLabel: t('Cancel entry') });
      if (reason) { Store.cancelExpense(e.id, reason); toast(t('Entry cancelled'), 'success'); }
    };
    return html`<${Page} title=${t('Expenses')} icon="wallet2" actions=${html`<${Btn} kind="primary" size="lg" icon="plus-lg" onClick=${() => setForm({})}>${t('Add expense')}</${Btn}>`}>
      <div class="kpis"><${Kpi} icon="calendar-day" label=${t('Today')} value=${money(tot(d1, d1))} /><${Kpi} icon="calendar-month" tone="teal" label=${t('This month')} value=${money(tot(m1, m2))} /><${Kpi} icon="calendar3" tone="yellow" label=${t('This year')} value=${money(tot(y1, y2))} /></div>
      <div class="grid-side">
        <${Card} pad=${false}>
          <div class="filters"><${Search} value=${q} onInput=${setQ} /><${Seg} value=${period} onChange=${setPeriod} options=${Util.periodOptions()} />
            <select class="inp w-auto" value=${cat} onChange=${(e) => setCat(e.target.value)}><option value="">${t('All categories')}</option>${s.categories.map((c) => html`<option value=${c.id}>${nm(c)}</option>`)}</select></div>
          <${Table} limit=${60} rows=${rows} rowCls=${(e) => (e.status === 'cancelled' ? 'row-cancel' : '')} columns=${[
            { label: t('Date'), render: (e) => html`<${D} v=${e.date} />` }, { label: t('Category'), render: (e) => html`<span class="badge badge-brand">${nm(Store.category(e.categoryId))}</span>` },
            { label: t('Description'), render: (e) => e.desc }, { label: t('Method'), render: (e) => nm(Store.method(e.method)) },
            { label: t('Amount'), num: true, render: (e) => html`<b><${Num} v=${e.amount} /></b>` },
            { label: '', render: (e) => (e.status === 'cancelled' ? html`<${Badge} s="cancelled" />` : html`<button class="icon-btn" title=${t('Cancel entry')} onClick=${() => cancel(e)}><${Ico} n="x-circle" /></button>`) }]}
            foot=${['', '', t('Total'), '', html`<b><${Num} v=${sum} /></b>`, '']} />
        </${Card}>
        <${Card} title=${t('By category')} actions=${html`<${Btn} kind="ghost" size="sm" icon="gear" onClick=${() => nav('settings', { tab: 'categories' })}>${t('Categories')}</${Btn}>`}>
          ${Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map((k) => html`<div class="bar-row"><span>${nm(Store.category(k))}</span><span class="num">${money(byCat[k])}</span>
            <div class="bar"><i style=${'width:' + Math.round((byCat[k] / (sum || 1)) * 100) + '%'}></i></div></div>`)}
          ${!sum && html`<div class="muted">${t('No records')}</div>`}
        </${Card}></div>
      ${form && html`<${ExpenseForm} onClose=${() => setForm(null)} />`}
    </${Page}>`;
  }
  function ExpenseForm({ onClose }) {
    const s = useStore();
    const [f, setF] = useState({ date: Store.today(), categoryId: s.categories.find((c) => c.active).id, amount: '', method: 'cash', desc: '' });
    const [newCat, setNewCat] = useState('');
    const save = () => {
      if (!(+f.amount > 0)) return toast(t('Enter the amount'), 'error');
      Store.saveExpense(f); toast(t('Expense saved'), 'success'); onClose();
    };
    const addCat = () => { if (!newCat.trim()) return; Store.saveCategory({ name_en: newCat.trim(), name_ur: Translit.offline(newCat.trim()) }); const c = Store.s.categories[Store.s.categories.length - 1]; setF({ ...f, categoryId: c.id }); setNewCat(''); };
    return html`<${Modal} title=${t('Add expense')} onClose=${onClose} footer=${html`<${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}><${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <div class="grid-2"><${Field} label=${t('Date')}><${DateInp} value=${f.date} onChange=${(v) => setF({ ...f, date: v })} /></${Field}>
        <${Field} label=${t('Amount')} req><input class="inp num big-num" type="number" autoFocus value=${f.amount} onInput=${(e) => setF({ ...f, amount: e.target.value })} /></${Field}>
        <${Field} label=${t('Category')} req span="2"><div class="chips">${s.categories.filter((c) => c.active).map((c) => html`<button type="button" class=${'chip' + (c.id === f.categoryId ? ' on' : '')} onClick=${() => setF({ ...f, categoryId: c.id })}>${nm(c)}</button>`)}
          <span class="chip-add"><input class="inp" placeholder=${t('+ New category')} value=${newCat} onInput=${(e) => setNewCat(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addCat()} />${newCat && html`<${Btn} size="sm" onClick=${addCat}>${t('Add')}</${Btn}>`}</span></div></${Field}>
        <${Field} label=${t('Payment method')} span="2"><${MethodSelect} value=${f.method} onChange=${(v) => setF({ ...f, method: v })} /></${Field}>
        <${Field} label=${t('Description')} span="2"><input class="inp" value=${f.desc} onInput=${(e) => setF({ ...f, desc: e.target.value })} /></${Field}></div>
    </${Modal}>`;
  }

  Object.assign(Screens, {
    recoveries: () => html`<${PayList} dir="in" />`, 'recoveries-new': (p) => html`<${PayForm} dir="in" ...${p} />`,
    payments: () => html`<${PayList} dir="out" />`, 'payments-new': (p) => html`<${PayForm} dir="out" ...${p} />`,
    expenses: () => html`<${Expenses} />`,
    PaymentModal, payCols: () => payCols(false),
  });
})();
