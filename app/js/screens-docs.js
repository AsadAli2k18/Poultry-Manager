/* Sale invoices and stock receipts: list, new/correct form, view. kind = 'customer' (sale) | 'vendor' (stock receipt) */
(function () {
  'use strict';
  const { html, useState, useMemo, useStore, Ico, Num, Qty, D, Btn, Field, Badge, toast, confirmBox, ask, Page, Card, Table, Seg, Search, DateInp, PartyPicker, ItemSelect, PaymentFields, emptyPayment, paymentValid, PrintPreview, Kpi } = UI;
  const { t, tf, nm, money, qty } = I18N;
  const nav = (...a) => App.nav(...a);
  const META = {
    customer: { title: 'Sale Invoices', one: 'Sale Invoice', icon: 'receipt', printType: 'sale', route: 'sales', partyLabel: 'Customer', newLabel: 'New sale invoice' },
    vendor: { title: 'Stock Receipts', one: 'Stock Receipt', icon: 'truck', printType: 'receipt', route: 'receipts', partyLabel: 'Vendor', newLabel: 'New stock receipt' },
  };

  /* ---------------- list ---------------- */
  function DocList({ kind }) {
    const s = useStore(); const M = META[kind];
    const [q, setQ] = useState(''); const [period, setPeriod] = useState('month'); const [st, setSt] = useState('');
    const [from, to] = Util.range(period);
    const docs = (kind === 'customer' ? s.invoices : s.receipts);
    const rows = docs.filter((d) => d.date >= from && d.date <= to).map((d) => ({ d, p: Store.party(kind, Store.docParty(d)), x: Store.docStatus(kind, d) }))
      .filter((r) => Util.matches(q, r.p && r.p.name_ur, r.p && r.p.name_en, r.d.no, r.d.vendorBillNo))
      .filter((r) => !st || r.x.status === st)
      .sort((a, b) => (b.d.date + b.d.time).localeCompare(a.d.date + a.d.time) || b.d.no - a.d.no);
    const act = rows.filter((r) => r.d.status !== 'cancelled');
    const tq = act.reduce((s2, r) => s2 + r.d.lines.reduce((a, l) => a + +l.qty, 0), 0);
    const tt = act.reduce((s2, r) => s2 + Store.total(r.d), 0);
    const tdue = act.reduce((s2, r) => s2 + r.x.due, 0);
    return html`<${Page} title=${t(M.title)} icon=${M.icon} actions=${html`<${Btn} kind="primary" size="lg" icon="plus-lg" onClick=${() => nav(M.route + '-new')}>${t(M.newLabel)}</${Btn}>`}>
      <div class="kpis">
        <${Kpi} icon="files" label=${t('Bills')} value=${act.length} />
        <${Kpi} icon="box-seam" tone="teal" label=${t('Total quantity')} value=${qty(tq) + ' kg'} />
        <${Kpi} icon="cash-stack" tone="green" label=${t('Total amount')} value=${money(tt)} />
        <${Kpi} icon="hourglass-split" tone="red" label=${t(kind === 'customer' ? 'Unpaid on these bills' : 'Unpaid to vendors')} value=${money(tdue)} />
      </div>
      <${Card} pad=${false}>
        <div class="filters"><${Search} value=${q} onInput=${setQ} placeholder=${t(kind === 'customer' ? 'Search customer or bill no.' : 'Search vendor or bill no.')} />
          <${Seg} value=${period} onChange=${setPeriod} options=${Util.periodOptions()} />
          <select class="inp w-auto" value=${st} onChange=${(e) => setSt(e.target.value)}><option value="">${t('All statuses')}</option>
            ${['paid', 'partial', 'unpaid', 'cancelled'].concat(kind === 'vendor' ? ['farm'] : []).map((x) => html`<option value=${x}>${t({ paid: 'Paid', partial: 'Partially paid', unpaid: 'Unpaid', cancelled: 'Cancelled', farm: 'Own farm' }[x])}</option>`)}</select></div>
        <${Table} limit=${60} onRow=${(r) => nav(M.route + '-view', { id: r.d.id })} rowCls=${(r) => (r.d.status === 'cancelled' ? 'row-cancel' : '')}
          columns=${[
            { label: t('No.'), render: (r) => html`<b class="num">${Util.docNo(kind, r.d)}</b>` },
            { label: t('Date'), render: (r) => html`<${D} v=${r.d.date} /> <small class="muted num">${r.d.time}</small>` },
            { label: t(M.partyLabel), render: (r) => html`<b>${nm(r.p)}</b>${r.d.vendorBillNo ? html`<div class="muted small">${t("Vendor's bill no.")}: <span class="num">${r.d.vendorBillNo}</span></div>` : ''}` },
            { label: t('Items'), render: (r) => html`<span class="small">${Util.linesText(r.d.lines)}</span>` },
            { label: t('Total'), num: true, render: (r) => html`<${Num} v=${Store.total(r.d)} />` },
            { label: t('Paid'), num: true, render: (r) => html`<${Num} v=${r.x.paid} />` },
            { label: t('Remaining'), num: true, render: (r) => html`<${Num} v=${r.x.due} cls=${r.x.due ? 'tx-red' : ''} />` },
            { label: t('Status'), render: (r) => html`<${Badge} s=${r.x.status} />` },
          ]} rows=${rows} foot=${['', '', t('Total'), qty(tq) + ' kg', html`<${Num} v=${tt} />`, '', html`<${Num} v=${tdue} />`, '']} />
      </${Card}></${Page}>`;
  }

  /* ---------------- form ---------------- */
  const newLine = () => ({ key: Store.uid(), itemId: '', qty: '', rate: '' });
  function DocForm({ kind, replaces, partyId: initialParty }) {
    const s = useStore(); const M = META[kind]; const isC = kind === 'customer';
    const old = replaces ? (isC ? s.invoices : s.receipts).find((d) => d.id === replaces) : null;
    const [f, setF] = useState(() => ({
      partyId: old ? Store.docParty(old) : initialParty || '', date: old ? old.date : Store.today(), note: old ? old.note : '',
      vendorBillNo: old ? old.vendorBillNo || '' : '', vehicle: old ? old.vehicle || '' : '', photo: old ? old.photo || '' : '',
      lines: old ? old.lines.map((l) => ({ key: Store.uid(), itemId: l.itemId, qty: String(l.qty), rate: String(l.rate) })) : [newLine()],
      paidNow: '', payment: emptyPayment(),
    }));
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
    const party = f.partyId ? Store.party(kind, f.partyId) : null;
    const farm = !isC && party && party.own_farm;
    const lastRate = (itemId) => {
      if (isC) return (Store.item(itemId) || {}).rate || '';
      if (farm) return 0;
      const rs = s.receipts.filter((r) => r.vendorId === f.partyId && Store.active(r)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      for (const r of rs) { const l = r.lines.find((x) => x.itemId === itemId); if (l) return l.rate; }
      return (Store.item(itemId) || {}).cost || '';
    };
    const setLine = (i, patch) => setF((o) => { const lines = o.lines.slice(); lines[i] = { ...lines[i], ...patch }; return { ...o, lines }; });
    const lines = f.lines;
    const total = Math.round(lines.reduce((a, l) => a + (+l.qty || 0) * (+l.rate || 0), 0));
    const prevBal = party ? Store.balance(kind, party.id) - (old && Store.active(old) ? Store.total(old) : 0) : 0;
    const paid = +f.paidNow || 0;
    const newBal = prevBal + total - paid;
    const stockWarn = isC ? lines.filter((l) => l.itemId && +l.qty > Store.stockOf(l.itemId) + (old ? old.lines.filter((x) => x.itemId === l.itemId).reduce((a, x) => a + +x.qty, 0) : 0)) : [];

    async function save(andPrint) {
      if (busy) return;
      if (!f.partyId) return toast(t(isC ? 'Choose the customer' : 'Choose the vendor'), 'error');
      const good = lines.filter((l) => l.itemId && +l.qty > 0);
      if (!good.length) return toast(t('Add at least one item with quantity'), 'error');
      if (!farm && good.some((l) => !(+l.rate > 0))) return toast(t('Enter the rate for every item'), 'error');
      if (paid > 0) { const err = UI.paymentValid(f.payment); if (err) return toast(err, 'error'); }
      const data = { ...f, lines: good, paidNow: paid };
      if (stockWarn.length && !(await confirmBox(t('Not enough stock'), tf('Stock of {items} will go below zero. Save anyway?', { items: stockWarn.map((l) => nm(Store.item(l.itemId))).join('، ') }), { okLabel: t('Save anyway') }))) return;
      if (Store.isDuplicateDoc(kind, data) && !(await confirmBox(t('Possible duplicate'), t('The same bill was saved a moment ago. Save it again?'), { okLabel: t('Save again') }))) return;
      if (old) {
        const reason = await ask({ title: t('Reason for correction'), body: tf('Bill {no} will be cancelled and replaced by this new one. Both stay on record.', { no: Util.docNo(kind, old) }), input: t('Reason'), inputReq: true, okLabel: t('Save correction') });
        if (!reason) return; data.replaces = old.id; data.reason = reason;
      }
      setBusy(true);
      const doc = Store.saveDoc(kind, data);
      setBusy(false);
      toast(tf(isC ? 'Invoice {no} saved' : 'Stock receipt {no} saved', { no: Util.docNo(kind, doc) }), 'success');
      if (andPrint) setPreview(doc); else nav(M.route + '-view', { id: doc.id });
    }
    const onPhoto = (e) => { const file = e.target.files[0]; if (!file) return; Util.readImage(file).then((d) => set('photo', d)); };

    return html`<${Page} title=${old ? tf('Correct {no}', { no: Util.docNo(kind, old) }) : t(M.newLabel)} icon=${M.icon}
      actions=${html`<${Btn} kind="ghost" icon="arrow-right-short" onClick=${() => history.back()}>${t('Back')}</${Btn}>`}>
      ${old && html`<div class="alert alert-yellow"><${Ico} n="info-circle" /> ${t('Correcting keeps the original bill on record as cancelled, and saves this as a new bill.')}</div>`}
      <div class="form-grid">
        <div class="form-main">
          <${Card} title=${t(isC ? 'Customer and date' : 'Vendor and date')}>
            <div class="grid-2">
              <${Field} label=${t(M.partyLabel)} req span="2"><${PartyPicker} kind=${kind} value=${f.partyId} onChange=${(v) => set('partyId', v)} autoFocus=${!f.partyId}
                onNew=${(q) => App.openPartyForm(kind, { name_en: q }, (p) => set('partyId', p.id))} /></${Field}>
              <${Field} label=${t('Date')}><${DateInp} value=${f.date} onChange=${(v) => set('date', v)} /></${Field}>
              ${!isC && html`<${Field} label=${t("Vendor's bill no.")} hint=${t('Number written on their bill')}><input class="inp num" value=${f.vendorBillNo} onInput=${(e) => set('vendorBillNo', e.target.value)} /></${Field}>`}
              ${!isC && html`<${Field} label=${t('Vehicle / driver')}><input class="inp" value=${f.vehicle} onInput=${(e) => set('vehicle', e.target.value)} /></${Field}>`}
              ${!isC && html`<${Field} label=${t("Photo of vendor's bill")} hint=${t('Optional')}><div class="photo-row"><input type="file" accept="image/*" onChange=${onPhoto} />${f.photo && html`<img class="thumb" src=${Store.photoSrc(f.photo)} />`}</div></${Field}>`}
            </div>
            ${farm && html`<div class="alert alert-teal"><${Ico} n="house-heart" /> ${t('Own farm: enter quantity only. No rate and no payable.')}</div>`}
          </${Card}>
          <${Card} title=${t('Items')} pad=${false}>
            <table class="tbl lines"><thead><tr><th>#</th><th>${t('Item')}</th><th class="r">${t('Quantity')} (kg)</th>${!farm && html`<th class="r">${t('Rate')}</th><th class="r">${t('Amount')}</th>`}<th></th></tr></thead>
              <tbody>${lines.map((l, i) => {
                const avail = l.itemId ? Store.stockOf(l.itemId) : null; const over = isC && l.itemId && +l.qty > avail;
                return html`<tr key=${l.key}><td class="num muted">${i + 1}</td>
                  <td><${ItemSelect} value=${l.itemId} onChange=${(v) => setLine(i, { itemId: v, rate: String(lastRate(v)) })} />
                    ${l.itemId && html`<div class=${'small ' + (over ? 'tx-red' : 'muted')}>${t('In stock')}: <span class="num">${qty(avail)}</span> kg${over ? ' — ' + t('not enough') : ''}</div>`}</td>
                  <td class="r"><input class="inp num big-num" type="number" min="0" step="0.01" inputmode="decimal" value=${l.qty} onInput=${(e) => setLine(i, { qty: e.target.value })} /></td>
                  ${!farm && html`<td class="r"><input class="inp num big-num" type="number" min="0" step="1" inputmode="decimal" value=${l.rate} onInput=${(e) => setLine(i, { rate: e.target.value })} /></td>
                  <td class="r num"><b>${money((+l.qty || 0) * (+l.rate || 0))}</b></td>`}
                  <td>${lines.length > 1 && html`<button class="icon-btn" title=${t('Remove line')} onClick=${() => set('lines', lines.filter((_, j) => j !== i))}><${Ico} n="trash3" /></button>`}</td></tr>`;
              })}</tbody></table>
            <div class="pad"><${Btn} kind="ghost" icon="plus-circle" onClick=${() => set('lines', [...lines, newLine()])}>${t('Add another item')}</${Btn}></div>
          </${Card}>
          ${!farm && html`<${Card} title=${t(isC ? 'Amount received now' : 'Amount paid now')}>
            <div class="grid-2"><${Field} label=${t('Amount')} hint=${t('Leave empty if on credit')}><input class="inp num big-num" type="number" min="0" value=${f.paidNow} onInput=${(e) => set('paidNow', e.target.value)} /></${Field}>
              <div class="quick">${total > 0 && html`<${Btn} kind="ghost" onClick=${() => set('paidNow', String(total))}>${t('Full bill amount')}</${Btn}>`}</div></div>
            ${paid > 0 && html`<${PaymentFields} dir=${isC ? 'in' : 'out'} value=${f.payment} onChange=${(v) => set('payment', v)} />`}
          </${Card}>`}
          <${Card} title=${t('Note')}><input class="inp" value=${f.note} onInput=${(e) => set('note', e.target.value)} placeholder=${t('Optional')} /></${Card}>
        </div>
        <aside class="form-side">
          <div class="totals card">
            <div class="tot-row big"><span>${t('Bill total')}</span><b class="num">${money(total)}</b></div>
            ${!farm && html`
              <div class="tot-row"><span>${t('Previous balance')}</span><span class="num">${money(prevBal)}</span></div>
              <div class="tot-row"><span>${t(isC ? 'Received now' : 'Paid now')}</span><span class="num">${money(paid)}</span></div>
              <div class="tot-row grand"><span>${t('New balance')}</span><b class="num">${money(newBal)}</b></div>`}
            <div class="tot-row"><span>${t('Total quantity')}</span><span class="num">${qty(lines.reduce((a, l) => a + (+l.qty || 0), 0))} kg</span></div>
            <div class="side-actions">
              <${Btn} kind="primary" size="lg" block icon="printer" onClick=${() => save(true)} disabled=${busy}>${t('Save and print')}</${Btn}>
              <${Btn} kind="default" size="lg" block icon="check2" onClick=${() => save(false)} disabled=${busy}>${t('Save')}</${Btn}>
              <${Btn} kind="ghost" block onClick=${() => history.back()}>${t('Back')}</${Btn}>
            </div>
          </div>
        </aside>
      </div>
      ${preview && html`<${PrintPreview} type=${M.printType} obj=${preview} title=${t(M.one)} onClose=${() => { const id = preview.id; setPreview(null); nav(M.route + '-view', { id }, true); }} />`}
    </${Page}>`;
  }

  /* ---------------- view ---------------- */
  function DocView({ kind, id }) {
    const s = useStore(); const M = META[kind]; const isC = kind === 'customer';
    const [preview, setPreview] = useState(false);
    const d = (isC ? s.invoices : s.receipts).find((x) => x.id === id);
    if (!d) return html`<${Page} title=${t('Not found')}><${Btn} onClick=${() => history.back()}>${t('Back')}</${Btn}></${Page}>`;
    const p = Store.party(kind, Store.docParty(d)); const x = Store.docStatus(kind, d);
    const linked = s.payments.filter((pp) => pp.docId === d.id);
    const repl = d.replacedBy ? (isC ? s.invoices : s.receipts).find((y) => y.id === d.replacedBy) : null;
    const orig = d.replaces ? (isC ? s.invoices : s.receipts).find((y) => y.id === d.replaces) : null;
    const cancel = async () => {
      const reason = await ask({ title: tf('Cancel {no}?', { no: Util.docNo(kind, d) }), body: t('The bill stays on record marked as cancelled. Stock and balance are reversed.'), input: t('Reason'), inputReq: true, danger: true, okLabel: t('Cancel bill') });
      if (reason) { Store.cancelDoc(kind, d.id, reason); toast(t('Bill cancelled'), 'success'); }
    };
    return html`<${Page} title=${t(M.one) + ' ' + Util.docNo(kind, d)} icon=${M.icon} sub=${html`<${D} v=${d.date} /> · <span class="num">${d.time}</span>`}
      actions=${html`<${Btn} kind="ghost" icon="arrow-right-short" onClick=${() => history.back()}>${t('Back')}</${Btn}>
        <${Btn} kind="primary" icon="printer" onClick=${() => setPreview(true)}>${t('Print')}</${Btn}>
        ${d.status !== 'cancelled' && html`<${Btn} icon="pencil-square" onClick=${() => nav(M.route + '-new', { replaces: d.id })}>${t('Correct')}</${Btn}>
        <${Btn} kind="danger-ghost" icon="x-circle" onClick=${cancel}>${t('Cancel bill')}</${Btn}>`}`}>
      ${d.status === 'cancelled' && html`<div class="alert alert-red"><${Ico} n="x-octagon" /> ${t('Cancelled')} <${D} v=${d.cancelDate} /> — ${d.cancelReason}
        ${repl && html` · <a onClick=${() => nav(M.route + '-view', { id: repl.id })}>${t('Open replacement')} ${Util.docNo(kind, repl)}</a>`}</div>`}
      ${orig && html`<div class="alert alert-yellow"><${Ico} n="arrow-repeat" /> ${t('This bill replaces')} <a onClick=${() => nav(M.route + '-view', { id: orig.id })}>${Util.docNo(kind, orig)}</a></div>`}
      <div class="form-grid"><div class="form-main">
        <${Card} title=${t(M.partyLabel)} actions=${html`<${Btn} kind="ghost" size="sm" icon="journal-text" onClick=${() => nav(isC ? 'customer' : 'vendor', { id: p.id })}>${t('Open ledger')}</${Btn}>`}>
          <div class="party-line"><b class="lg">${nm(p)}</b> <span class="muted num">${p.code} · ${p.phone || ''}</span>
            ${d.vendorBillNo && html`<div class="muted">${t("Vendor's bill no.")}: <b class="num">${d.vendorBillNo}</b></div>`}${d.vehicle && html`<div class="muted">${t('Vehicle / driver')}: ${d.vehicle}</div>`}</div>
          ${d.photo && html`<img class="bill-photo" src=${Store.photoSrc(d.photo)} />`}
        </${Card}>
        <${Card} title=${t('Items')} pad=${false}>
          <${Table} columns=${[
            { label: '#', render: (l, i) => html`<span class="num muted">${i + 1}</span>` },
            { label: t('Item'), render: (l) => nm(Store.item(l.itemId)) },
            { label: t('Quantity'), num: true, render: (l) => html`<${Qty} v=${l.qty} unit="kg" />` },
            { label: t('Rate'), num: true, render: (l) => html`<${Num} v=${l.rate} />` },
            { label: t('Amount'), num: true, render: (l) => html`<${Num} v=${l.qty * l.rate} />` },
          ]} rows=${d.lines} foot=${['', t('Total'), html`<${Qty} v=${d.lines.reduce((a, l) => a + +l.qty, 0)} unit="kg" />`, '', html`<b><${Num} v=${Store.total(d)} /></b>`]} />
        </${Card}>
        ${linked.length > 0 && html`<${Card} title=${t('Payment with this bill')} pad=${false}>
          <${Table} columns=${payCols()} rows=${linked} onRow=${(pp) => App.openPayment(pp.id)} /></${Card}>`}
        ${d.note && html`<${Card} title=${t('Note')}>${d.note}</${Card}>`}
      </div>
      <aside class="form-side"><div class="totals card">
        <div class="tot-row big"><span>${t('Bill total')}</span><b class="num">${money(Store.total(d))}</b></div>
        <div class="tot-row"><span>${t('Settled')}</span><span class="num">${money(x.paid)}</span></div>
        <div class="tot-row grand"><span>${t('Remaining on this bill')}</span><b class="num">${money(x.due)}</b></div>
        <div class="tot-row"><span>${t('Status')}</span><${Badge} s=${x.status} /></div>
        <div class="tot-row"><span>${tf("{who}'s balance now", { who: nm(p) })}</span><b class="num">${money(Store.balance(kind, p.id))}</b></div>
        <p class="muted small">${t('Payments settle the oldest bills first.')}</p>
      </div></aside></div>
      ${preview && html`<${PrintPreview} type=${M.printType} obj=${d} title=${t(M.one)} onClose=${() => setPreview(false)} />`}
    </${Page}>`;
  }
  function payCols() {
    return [
      { label: t('No.'), render: (p) => html`<b class="num">${Util.payNo(p)}</b>` },
      { label: t('Date'), render: (p) => html`<${D} v=${p.date} />` },
      { label: t('Method'), render: (p) => nm(Store.method(p.method)) },
      { label: t('Reference'), render: (p) => html`<span class="num small">${p.ref}</span>` },
      { label: t('Amount'), num: true, render: (p) => html`<${Num} v=${p.amount} />` },
    ];
  }

  Object.assign(Screens, {
    sales: () => html`<${DocList} kind="customer" />`,
    'sales-new': (p) => html`<${DocForm} kind="customer" ...${p} />`,
    'sales-view': (p) => html`<${DocView} kind="customer" ...${p} />`,
    receipts: () => html`<${DocList} kind="vendor" />`,
    'receipts-new': (p) => html`<${DocForm} kind="vendor" ...${p} />`,
    'receipts-view': (p) => html`<${DocView} kind="vendor" ...${p} />`,
  });
})();
