/* Customers and vendors: list, profile with register-style ledger, add/edit form. */
(function () {
  'use strict';
  const { html, useState, useStore, Ico, Num, D, Btn, Field, Badge, Side, toast, Modal, Page, Card, Table, Seg, Search, DateInp, NameFields, PrintPreview, Kpi } = UI;
  const { t, tf, nm, money, qty } = I18N;
  const nav = (...a) => App.nav(...a);
  const META = {
    customer: { title: 'Customers', one: 'Customer', icon: 'people', route: 'customer', docRoute: 'sales', payRoute: 'recoveries', newDoc: 'New sale invoice', newPay: 'New recovery', side: 'To receive' },
    vendor: { title: 'Vendors', one: 'Vendor', icon: 'shop', route: 'vendor', docRoute: 'receipts', payRoute: 'payments', newDoc: 'New stock receipt', newPay: 'New vendor payment', side: 'To pay' },
  };

  function PartyList({ kind }) {
    const s = useStore(); const M = META[kind];
    const [q, setQ] = useState(''); const [show, setShow] = useState('active');
    const list = (kind === 'customer' ? s.customers : s.vendors);
    const rows = list.filter((p) => (show === 'all' ? true : show === 'due' ? Store.balance(kind, p.id) !== 0 : p.active))
      .filter((p) => Util.matches(q, p.name_ur, p.name_en, p.code, p.phone))
      .map((p) => ({ ...p, bal: Store.balance(kind, p.id) }))
      .sort((a, b) => b.bal - a.bal);
    const tot = rows.reduce((a, r) => a + r.bal, 0);
    return html`<${Page} title=${t(M.title)} icon=${M.icon} actions=${html`<${Btn} kind="primary" size="lg" icon="person-plus" onClick=${() => App.openPartyForm(kind)}>${t(kind === 'customer' ? 'Add customer' : 'Add vendor')}</${Btn}>`}>
      <div class="kpis">
        <${Kpi} icon=${M.icon} label=${t(M.title)} value=${list.filter((p) => p.active).length} />
        <${Kpi} icon="cash-coin" tone=${kind === 'customer' ? 'green' : 'red'} label=${t(kind === 'customer' ? 'Total receivable' : 'Total payable')} value=${money(list.reduce((a, p) => a + Store.balance(kind, p.id), 0))} />
        <${Kpi} icon="exclamation-diamond" tone="yellow" label=${t('With balance')} value=${list.filter((p) => Store.balance(kind, p.id) !== 0).length} />
      </div>
      <${Card} pad=${false}>
        <div class="filters"><${Search} value=${q} onInput=${setQ} placeholder=${t('Search by name, ID or phone')} />
          <${Seg} value=${show} onChange=${setShow} options=${[{ value: 'active', label: t('Active') }, { value: 'due', label: t('With balance') }, { value: 'all', label: t('All') }]} /></div>
        <${Table} onRow=${(p) => nav(M.route, { id: p.id })} rowCls=${(p) => (p.active ? '' : 'row-cancel')} columns=${[
          { label: t('ID'), render: (p) => html`<span class="num muted">${p.code}</span>` },
          { label: t('Name'), render: (p) => html`<b>${nm(p)}</b> ${p.own_farm ? html`<span class="badge badge-teal">${t('Own farm')}</span>` : ''}<div class="muted small">${I18N.lang === 'ur' ? p.name_en : p.name_ur}</div>` },
          { label: t('Phone'), render: (p) => html`<span class="num">${p.phone}</span>` },
          { label: t('Address'), render: (p) => html`<span class="small">${p.address}</span>` },
          { label: t('Balance'), num: true, render: (p) => html`<b><${Num} v=${p.bal} /></b>` },
          { label: '', render: (p) => html`<${Side} v=${p.bal} kind=${kind} />` },
        ]} rows=${rows} foot=${['', t('Total'), '', '', html`<b><${Num} v=${tot} /></b>`, '']} />
      </${Card}></${Page}>`;
  }

  /* Register (khata) layout: Date | Details | Rate | Debit | Credit | lena/dena | Balance */
  function detailOf(kind, r) {
    if (r.kind === 'doc' || r.kind === 'docCancel') {
      const d = r.doc; const lines = d.lines.map((l) => nm(Store.item(l.itemId)) + ' ' + qty(l.qty) + ' kg').join('، ');
      const tag = html`<a class="num" onClick=${(e) => { e.stopPropagation(); nav(META[kind].docRoute + '-view', { id: d.id }); }}>${Util.docNo(kind, d)}</a>`;
      if (r.kind === 'docCancel') return html`<span class="tx-red">${t('Cancelled')}: ${tag} — ${d.cancelReason}</span>`;
      return html`<span>${t(kind === 'customer' ? 'Goods' : 'Goods received')} — ${lines} · ${tag}${d.vendorBillNo ? html` <small class="muted">(${t('their bill')} <span class="num">${d.vendorBillNo}</span>)</small>` : ''}${d.status === 'cancelled' ? html` <span class="badge badge-grey">${t('Cancelled')}</span>` : ''}</span>`;
    }
    const p = r.pay; const m = Store.method(p.method);
    const bits = [nm(m), p.ref, p.handledBy && (t('by') + ' ' + p.handledBy), p.onBehalf && (t('on behalf') + ': ' + p.onBehalf)].filter(Boolean).join(' · ');
    const tag = html`<a class="num" onClick=${(e) => { e.stopPropagation(); App.openPayment(p.id); }}>${Util.payNo(p)}</a>`;
    if (r.kind === 'payCancel') return html`<span class="tx-red">${t('Cancelled')}: ${tag} — ${p.cancelReason}</span>`;
    return html`<span class="tx-pay">${t(kind === 'customer' ? 'Received' : 'Paid')} — ${bits} · ${tag}${p.status === 'cancelled' ? html` <span class="badge badge-grey">${t('Cancelled')}</span>` : ''}</span>`;
  }
  const rateOf = (r) => (r.doc && r.kind === 'doc' && r.doc.lines.length === 1 ? money(r.doc.lines[0].rate) : '');

  function ledgerReport(kind, lg, from, to) {
    const sideTxt = (b) => (!b ? t('Settled') : (kind === 'customer' ? b > 0 : b < 0) ? t('To receive') : t('To pay'));
    const plain = (r) => {
      if (r.doc) { const base = r.doc.lines.map((l) => nm(Store.item(l.itemId)) + ' ' + qty(l.qty) + ' kg').join('، ') + ' · ' + Util.docNo(kind, r.doc); return r.kind === 'docCancel' ? t('Cancelled') + ': ' + Util.docNo(kind, r.doc) : base; }
      const p = r.pay; const s = [nm(Store.method(p.method)), p.ref, p.handledBy].filter(Boolean).join(' · ') + ' · ' + Util.payNo(p);
      return (r.kind === 'payCancel' ? t('Cancelled') + ': ' : t(kind === 'customer' ? 'Received' : 'Paid') + ' — ') + s;
    };
    return {
      title: kind === 'customer' ? 'Customer Ledger' : 'Vendor Ledger',
      subtitle: Print.esc(nm(lg.party)) + ' · ' + lg.party.code + ' · ' + I18N.dmy(from) + ' – ' + I18N.dmy(to),
      kpis: [{ k: 'Opening balance', v: money(lg.opening) }, { k: 'Debit', v: money(lg.debit) }, { k: 'Credit', v: money(lg.credit) }, { k: 'Closing balance', v: money(lg.closing) }],
      sections: [{
        columns: [{ label: 'Date' }, { label: 'Details' }, { label: 'Rate', num: true }, { label: 'Debit', num: true }, { label: 'Credit', num: true }, { label: 'To receive / To pay' }, { label: 'Balance', num: true }],
        rows: [[I18N.dmy(from), t('Opening balance'), '', '', '', sideTxt(lg.opening), money(lg.opening)]].concat(lg.rows.map((r) => [I18N.dmy(r.date), Print.esc(plain(r)), rateOf(r), r.debit ? money(r.debit) : '', r.credit ? money(r.credit) : '', sideTxt(r.balance), money(r.balance)])),
        foot: ['', t('Total'), '', money(lg.debit), money(lg.credit), '', money(lg.closing)],
      }],
    };
  }

  function PartyView({ kind, id }) {
    const s = useStore(); const M = META[kind];
    const p = (kind === 'customer' ? s.customers : s.vendors).find((x) => x.id === id);
    const [period, setPeriod] = useState('all');
    const [from, setFrom] = useState(s.settings.goLive); const [to, setTo] = useState(Store.today());
    const [tab, setTab] = useState('ledger');
    const [preview, setPreview] = useState(null);
    if (!p) return html`<${Page} title=${t('Not found')} />`;
    const setP = (v) => { setPeriod(v); if (v !== 'custom') { const [a, b] = Util.range(v); setFrom(v === 'all' ? s.settings.goLive : a); setTo(v === 'all' ? Store.today() : b > Store.today() ? Store.today() : b); } };
    const lg = Store.ledger(kind, id, from, to);
    const bal = Store.balance(kind, id);
    const docs = (kind === 'customer' ? s.invoices : s.receipts).filter((d) => Store.docParty(d) === id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const pays = s.payments.filter((x) => x.partyId === id && x.dir === (kind === 'customer' ? 'in' : 'out')).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const unpaid = docs.map((d) => ({ d, x: Store.docStatus(kind, d) })).filter((r) => r.x.status === 'unpaid' || r.x.status === 'partial');
    return html`<${Page} title=${nm(p)} icon=${M.icon} sub=${html`<span class="num">${p.code}</span> · <span class="num">${p.phone}</span> · ${p.address} ${p.own_farm ? html`<span class="badge badge-teal">${t('Own farm')}</span>` : ''}`}
      actions=${html`<${Btn} kind="ghost" icon="arrow-right-short" onClick=${() => App.back()}>${t('Back')}</${Btn}>
        <${Btn} icon="pencil" onClick=${() => App.openPartyForm(kind, p)}>${t('Edit')}</${Btn}>
        ${!p.own_farm && html`<${Btn} icon="cash-coin" onClick=${() => nav(M.payRoute + '-new', { partyId: id })}>${t(M.newPay)}</${Btn}>`}
        <${Btn} kind="primary" icon="plus-lg" onClick=${() => nav(M.docRoute + '-new', { partyId: id })}>${t(M.newDoc)}</${Btn}>`}>
      <div class="kpis">
        <${Kpi} icon="flag" label=${t('Opening balance')} value=${money(p.opening)} sub=${tf('as of {d}', { d: I18N.dmy(s.settings.goLive) })} />
        <${Kpi} icon="receipt" tone="teal" label=${t(kind === 'customer' ? 'Total billed' : 'Total received goods')} value=${money(docs.filter(Store.active).reduce((a, d) => a + Store.total(d), 0))} />
        <${Kpi} icon="cash-stack" tone="green" label=${t(kind === 'customer' ? 'Total recovered' : 'Total paid')} value=${money(pays.filter(Store.active).reduce((a, x) => a + x.amount, 0))} />
        <${Kpi} icon="wallet2" tone=${bal ? 'red' : 'green'} label=${t('Current balance')} value=${money(bal)} sub=${html`<${Side} v=${bal} kind=${kind} />`} />
      </div>
      <${Card} pad=${false} actions=${tab === 'ledger' && html`<${Btn} kind="primary" icon="printer" onClick=${() => setPreview(ledgerReport(kind, lg, from, to))}>${t('Print ledger')}</${Btn}>`}
        title=${html`<${Seg} value=${tab} onChange=${setTab} options=${[{ value: 'ledger', label: t('Ledger (khata)'), icon: 'journal-text' }, { value: 'bills', label: t('Bills') + ' (' + docs.length + ')', icon: 'receipt' }, { value: 'pays', label: t(kind === 'customer' ? 'Recoveries' : 'Payments') + ' (' + pays.length + ')', icon: 'cash' }, { value: 'unpaid', label: t('Unpaid bills') + ' (' + unpaid.length + ')', icon: 'hourglass-split' }]} />`}>
        ${tab === 'ledger' && html`<div class="filters"><${Seg} value=${period} onChange=${setP} options=${[...Util.periodOptions(), { value: 'custom', label: t('Custom') }]} />
          <span class="muted">${t('From')}</span><${DateInp} value=${from} onChange=${(v) => { setFrom(v); setPeriod('custom'); }} /><span class="muted">${t('To')}</span><${DateInp} value=${to} onChange=${(v) => { setTo(v); setPeriod('custom'); }} /></div>
          <div class="tbl-wrap"><table class="tbl khata"><thead><tr><th>${t('Date')}</th><th>${t('Details')}</th><th class="r">${t('Rate')}</th><th class="r">${t('Debit')}<small>${t('(naam)')}</small></th><th class="r">${t('Credit')}<small>${t('(jama)')}</small></th><th>${t('To receive / To pay')}</th><th class="r">${t('Balance')}<small>${t('(baqaya)')}</small></th></tr></thead>
            <tbody><tr class="row-open"><td><${D} v=${from} /></td><td><b>${t('Opening balance')}</b></td><td></td><td></td><td></td><td><${Side} v=${lg.opening} kind=${kind} /></td><td class="r"><b><${Num} v=${lg.opening} /></b></td></tr>
            ${lg.rows.map((r, i) => html`<tr key=${i} class=${r.kind.endsWith('Cancel') ? 'row-rev' : ''}><td><${D} v=${r.date} /></td><td>${detailOf(kind, r)}</td><td class="r num">${rateOf(r)}</td>
              <td class="r">${r.debit ? html`<${Num} v=${r.debit} cls="tx-debit" />` : ''}</td><td class="r">${r.credit ? html`<${Num} v=${r.credit} cls="tx-credit" />` : ''}</td>
              <td><${Side} v=${r.balance} kind=${kind} /></td><td class="r"><b><${Num} v=${r.balance} /></b></td></tr>`)}</tbody>
            <tfoot><tr><td></td><td>${t('Total')}</td><td></td><td class="r"><${Num} v=${lg.debit} /></td><td class="r"><${Num} v=${lg.credit} /></td><td></td><td class="r"><${Num} v=${lg.closing} /></td></tr></tfoot></table></div>`}
        ${tab === 'bills' && html`<${Table} limit=${50} onRow=${(d) => nav(M.docRoute + '-view', { id: d.id })} rowCls=${(d) => (d.status === 'cancelled' ? 'row-cancel' : '')} rows=${docs} columns=${[
          { label: t('No.'), render: (d) => html`<b class="num">${Util.docNo(kind, d)}</b>` }, { label: t('Date'), render: (d) => html`<${D} v=${d.date} />` },
          { label: t('Items'), render: (d) => html`<span class="small">${Util.linesText(d.lines)}</span>` }, { label: t('Total'), num: true, render: (d) => html`<${Num} v=${Store.total(d)} />` },
          { label: t('Remaining'), num: true, render: (d) => html`<${Num} v=${Store.docStatus(kind, d).due} />` }, { label: t('Status'), render: (d) => html`<${Badge} s=${Store.docStatus(kind, d).status} />` }]} />`}
        ${tab === 'pays' && html`<${Table} limit=${50} onRow=${(x) => App.openPayment(x.id)} rowCls=${(x) => (x.status === 'cancelled' ? 'row-cancel' : '')} rows=${pays} columns=${Screens.payCols()} />`}
        ${tab === 'unpaid' && html`<${Table} onRow=${(r) => nav(M.docRoute + '-view', { id: r.d.id })} rows=${unpaid} empty=${t('All bills are settled')} columns=${[
          { label: t('No.'), render: (r) => html`<b class="num">${Util.docNo(kind, r.d)}</b>` }, { label: t('Date'), render: (r) => html`<${D} v=${r.d.date} />` },
          { label: t('Days'), num: true, render: (r) => html`<span class="num">${Math.round((new Date(Store.today()) - new Date(r.d.date)) / 864e5)}</span>` },
          { label: t('Total'), num: true, render: (r) => html`<${Num} v=${Store.total(r.d)} />` }, { label: t('Remaining'), num: true, render: (r) => html`<b><${Num} v=${r.x.due} /></b>` }, { label: t('Status'), render: (r) => html`<${Badge} s=${r.x.status} />` }]} />`}
      </${Card}>
      ${p.note && html`<${Card} title=${t('Note')}>${p.note}</${Card}>`}
      ${preview && html`<${PrintPreview} type="report" obj=${preview} title=${t(preview.title)} onClose=${() => setPreview(null)} />`}
    </${Page}>`;
  }

  function PartyForm({ kind, value, onClose, onSaved }) {
    const s = useStore();
    const [f, setF] = useState(() => ({ name_en: '', name_ur: '', phone: '', address: '', opening: '', note: '', own_farm: false, active: true, ...(value || {}) }));
    const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const save = () => {
      if (!(f.name_en || '').trim() && !(f.name_ur || '').trim()) return toast(t('Enter the name'), 'error');
      const list = kind === 'customer' ? s.customers : s.vendors;
      if (f.phone && list.some((p) => p.id !== f.id && p.phone && p.phone.replace(/\D/g, '') === f.phone.replace(/\D/g, ''))) toast(t('Another record already has this phone number'), 'warn');
      const saved = Store.saveParty(kind, { ...f, opening: +f.opening || 0 });
      toast(t('Saved'), 'success'); onClose(); if (onSaved && saved) onSaved(saved);
    };
    return html`<${Modal} title=${t(f.id ? (kind === 'customer' ? 'Edit customer' : 'Edit vendor') : (kind === 'customer' ? 'Add customer' : 'Add vendor'))} onClose=${onClose}
      footer=${html`<${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}><${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <${NameFields} value=${f} onChange=${(v) => setF({ ...f, ...v })} />
      <div class="grid-2">
        <${Field} label=${t('Phone')}><input class="inp num" dir="ltr" value=${f.phone} onInput=${set('phone')} placeholder="03xx-xxxxxxx" /></${Field}>
        <${Field} label=${t('Address')}><input class="inp" value=${f.address} onInput=${set('address')} /></${Field}>
        <${Field} label=${t('Opening balance')} hint=${tf(kind === 'customer' ? 'Amount they owe us on the go-live date ({d})' : 'Amount we owe them on the go-live date ({d})', { d: I18N.dmy(s.settings.goLive) })}>
          <input class="inp num" type="number" value=${f.opening} onInput=${set('opening')} /></${Field}>
        <${Field} label=${t('Note')}><input class="inp" value=${f.note} onInput=${set('note')} /></${Field}>
        ${kind === 'vendor' && html`<label class="check span-2"><input type="checkbox" checked=${f.own_farm} onChange=${set('own_farm')} /> <span><b>${t('Own farm')}</b> — ${t('records quantity only, no rate and no payable')}</span></label>`}
        ${f.id && html`<label class="check span-2"><input type="checkbox" checked=${f.active} onChange=${set('active')} /> <span>${t('Active')}</span></label>`}
      </div>
    </${Modal}>`;
  }

  Object.assign(Screens, {
    customers: () => html`<${PartyList} kind="customer" />`,
    vendors: () => html`<${PartyList} kind="vendor" />`,
    customer: (p) => html`<${PartyView} kind="customer" ...${p} />`,
    vendor: (p) => html`<${PartyView} kind="vendor" ...${p} />`,
    PartyForm,
  });
})();
