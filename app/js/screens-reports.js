/* Reports: daily / monthly / yearly with one click, every report printable. */
(function () {
  'use strict';
  const { html, useState, useStore, Ico, Num, Btn, Page, Card, Table, Seg, DateInp, PrintPreview, Kpi } = UI;
  const { t, tf, nm, money, qty, dmy } = I18N;
  const nav = (...a) => App.nav(...a);
  const TABS = [
    { value: 'summary', label: 'Summary', icon: 'speedometer2' }, { value: 'credit', label: 'Daily credit list', icon: 'people' },
    { value: 'payable', label: 'Daily payable list', icon: 'shop' }, { value: 'stock', label: 'Stock summary', icon: 'box-seam' },
    { value: 'recv', label: 'Receivables', icon: 'arrow-down-left-circle' }, { value: 'pay', label: 'Payables', icon: 'arrow-up-right-circle' },
  ];

  function Reports({ tab: tab0 }) {
    useStore();
    const [tab, setTab] = useState(tab0 || 'summary');
    const [mode, setMode] = useState('day'); const [anchor, setAnchor] = useState(Store.today());
    const [preview, setPreview] = useState(null);
    const [from, to0] = Util.range(mode, anchor); const to = to0 > Store.today() ? Store.today() : to0;
    const label = mode === 'day' ? dmy(from) : mode === 'month' ? I18N.monthName(+anchor.slice(5, 7) - 1) + ' ' + anchor.slice(0, 4) : anchor.slice(0, 4);
    const shift = (n) => { const d = new Date(anchor + 'T00:00:00Z'); if (mode === 'day') d.setUTCDate(d.getUTCDate() + n); else if (mode === 'month') d.setUTCMonth(d.getUTCMonth() + n); else d.setUTCFullYear(d.getUTCFullYear() + n); const iso = d.toISOString().slice(0, 10); if (iso <= Store.today()) setAnchor(iso); };
    const periodText = t(mode === 'day' ? 'Daily' : mode === 'month' ? 'Monthly' : 'Yearly') + ' — ' + label;
    let body, rep;
    if (tab === 'summary') [body, rep] = summaryView(from, to, periodText);
    else if (tab === 'credit' || tab === 'payable') [body, rep] = creditView(tab === 'credit' ? 'customer' : 'vendor', from, to, periodText);
    else if (tab === 'stock') [body, rep] = stockView(from, to, periodText);
    else [body, rep] = balancesView(tab === 'recv' ? 'customer' : 'vendor', to);
    const noPeriod = tab === 'recv' || tab === 'pay';
    return html`<${Page} title=${t('Reports')} icon="bar-chart-line" actions=${html`<${Btn} kind="primary" size="lg" icon="printer" onClick=${() => setPreview(rep)}>${t('Print report')}</${Btn}>`}>
      <div class="tabs">${TABS.map((x) => html`<button class=${'tab' + (tab === x.value ? ' on' : '')} onClick=${() => setTab(x.value)}><${Ico} n=${x.icon} /> ${t(x.label)}</button>`)}</div>
      <div class="period-bar">
        <${Seg} value=${mode} onChange=${(v) => { setMode(v); }} options=${[{ value: 'day', label: t('Daily') }, { value: 'month', label: t('Monthly') }, { value: 'year', label: t('Yearly') }]} />
        <div class="stepper"><button class="icon-btn" onClick=${() => shift(I18N.lang === 'ur' ? 1 : -1)}><${Ico} n="chevron-left" /></button>
          <b class="period-label">${label}</b><button class="icon-btn" onClick=${() => shift(I18N.lang === 'ur' ? -1 : 1)}><${Ico} n="chevron-right" /></button></div>
        ${mode === 'day' && html`<${DateInp} value=${anchor} max=${Store.today()} onChange=${setAnchor} />`}
        <${Btn} kind="ghost" size="sm" onClick=${() => setAnchor(Store.today())}>${t('Today')}</${Btn}>
        ${noPeriod && html`<span class="muted small">${tf('Balances as of {d}', { d: dmy(to) })}</span>`}
      </div>
      ${body}
      ${preview && html`<${PrintPreview} type="report" obj=${preview} title=${t(preview.title)} onClose=${() => setPreview(null)} />`}
    </${Page}>`;
  }

  function summaryView(from, to, periodText) {
    const r = Store.summary(from, to);
    const k = (label, v, icon, tone) => html`<${Kpi} icon=${icon} tone=${tone} label=${t(label)} value=${money(v)} />`;
    const body = html`<div class="kpis kpis-6">
        ${k('Sales', r.sales, 'receipt', 'brand')}${k('Recoveries', r.recov, 'cash-coin', 'green')}${k('Stock purchases', r.purchases, 'truck', 'teal')}
        ${k('Paid to vendors', r.paidOut, 'send', 'yellow')}${k('Expenses', r.expTotal, 'wallet2', 'red')}
        ${html`<${Kpi} icon="graph-up-arrow" tone=${r.netProfit >= 0 ? 'green' : 'red'} label=${t('Net profit')} value=${money(r.netProfit)} sub=${r.profitPartial ? t('Partial — some items have no cost') : t('Gross profit') + ': ' + money(r.grossProfit)} />`}</div>
      <div class="grid-2 gap">
        <${Card} title=${t('By item')} pad=${false}><${Table} rows=${r.items.filter((i) => i.recv || i.sold || i.adj)} columns=${[
          { label: t('Item'), render: (i) => nm(i.item) }, { label: t('Received'), num: true, render: (i) => html`<span class="num">${qty(i.recv)}</span>` },
          { label: t('Sold'), num: true, render: (i) => html`<span class="num">${qty(i.sold)}</span>` }, { label: t('Sales'), num: true, render: (i) => html`<${Num} v=${i.soldAmt} />` },
          { label: t('Profit'), num: true, render: (i) => (i.costKnown ? html`<${Num} v=${i.profit} cls=${i.profit < 0 ? 'tx-red' : 'tx-credit'} />` : html`<span class="muted small">${t('no cost')}</span>`) }]} /></${Card}>
        <div>
          <${Card} title=${t('Money in and out')}>
            ${row('Recoveries', r.recov)}${Object.keys(r.recovByMethod).map((m) => row('  · ' + nm(Store.method(m)), r.recovByMethod[m], true))}
            ${row('Paid to vendors', -r.paidOut)}${Object.keys(r.paidByMethod).map((m) => row('  · ' + nm(Store.method(m)), -r.paidByMethod[m], true))}
            ${row('Expenses', -r.expTotal)}${Object.keys(r.byCat).map((c) => row('  · ' + nm(Store.category(c)), -r.byCat[c], true))}
            <div class="kv strong"><span>${t('Cash in hand change')}</span><b class="num">${money(r.cashIn - r.cashOut)}</b></div></${Card}>
          <${Card} title=${t('Outstanding at period end')}>
            <div class="kv"><span>${t('Total receivable')}</span><b class="num tx-credit">${money(r.receivable)}</b></div>
            <div class="kv"><span>${t('Total payable')}</span><b class="num tx-debit">${money(r.payable)}</b></div></${Card}>
        </div></div>`;
    const rep = {
      title: 'Summary Report', subtitle: periodText,
      kpis: [{ k: 'Sales', v: money(r.sales) }, { k: 'Recoveries', v: money(r.recov) }, { k: 'Expenses', v: money(r.expTotal) }, { k: 'Net profit', v: money(r.netProfit) }],
      sections: [
        { title: 'By item', columns: [{ label: 'Item' }, { label: 'Received', num: true }, { label: 'Sold', num: true }, { label: 'Sales', num: true }, { label: 'Profit', num: true }],
          rows: r.items.filter((i) => i.recv || i.sold).map((i) => [Print.esc(nm(i.item)), qty(i.recv), qty(i.sold), money(i.soldAmt), i.costKnown ? money(i.profit) : '—']) },
        { title: 'Money in and out', columns: [{ label: 'Details' }, { label: 'Amount', num: true }],
          rows: [[t('Recoveries'), money(r.recov)], [t('Stock purchases'), money(r.purchases)], [t('Paid to vendors'), money(r.paidOut)]].concat(Object.keys(r.byCat).map((c) => [t('Expenses') + ' — ' + Print.esc(nm(Store.category(c))), money(r.byCat[c])]))
            .concat([[t('Total receivable'), money(r.receivable)], [t('Total payable'), money(r.payable)]]) },
      ],
    };
    return [body, rep];
  }
  const row = (label, v, sub) => html`<div class=${'kv' + (sub ? ' sub' : '')}><span>${label.startsWith('  · ') ? label : t(label)}</span><span class=${'num ' + (v < 0 ? 'tx-debit' : 'tx-credit')}>${money(v)}</span></div>`;

  function creditView(kind, from, to, periodText) {
    const r = Store.creditList(kind, from, to);
    const isC = kind === 'customer';
    const cols = [t(isC ? 'Customer' : 'Vendor'), t('Previous balance'), t(isC ? 'New credit' : 'New stock'), t(isC ? 'Received' : 'Paid'), t('Closing balance')];
    const body = html`<${Card} pad=${false}><${Table} rows=${r.rows} onRow=${(x) => nav(kind, { id: x.party.id })} empty=${t('Nothing for this period')} columns=${[
      { label: cols[0], render: (x) => html`<b>${nm(x.party)}</b> <small class="muted num">${x.party.code}</small>` }, { label: cols[1], num: true, render: (x) => html`<${Num} v=${x.prev} />` },
      { label: cols[2], num: true, render: (x) => (x.add ? html`<${Num} v=${x.add} cls="tx-debit" />` : '') }, { label: cols[3], num: true, render: (x) => (x.paid ? html`<${Num} v=${x.paid} cls="tx-credit" />` : '') },
      { label: cols[4], num: true, render: (x) => html`<b><${Num} v=${x.closing} /></b>` }]}
      foot=${[t('Grand total'), html`<${Num} v=${r.totals.prev} />`, html`<${Num} v=${r.totals.add} />`, html`<${Num} v=${r.totals.paid} />`, html`<b><${Num} v=${r.totals.closing} /></b>`]} /></${Card}>`;
    const rep = { title: isC ? 'Daily Credit List' : 'Daily Payable List', subtitle: periodText,
      sections: [{ columns: cols.map((c, i) => ({ label: c, num: i > 0 })), rows: r.rows.map((x) => [Print.esc(nm(x.party)), money(x.prev), x.add ? money(x.add) : '', x.paid ? money(x.paid) : '', money(x.closing)]),
        foot: [t('Grand total'), money(r.totals.prev), money(r.totals.add), money(r.totals.paid), money(r.totals.closing)] }] };
    return [body, rep];
  }
  function stockView(from, to, periodText) {
    const r = Store.summary(from, to);
    const cols = ['Item', 'Opening', 'Received', 'Sold', 'Corrections', 'Closing'];
    const body = html`<${Card} pad=${false}><${Table} rows=${r.items} onRow=${(i) => nav('stock-item', { id: i.item.id })} columns=${[
      { label: t('Item'), render: (i) => html`<b>${nm(i.item)}</b>` }, { label: t('Opening'), num: true, render: (i) => html`<span class="num">${qty(i.opening)}</span>` },
      { label: t('Received'), num: true, render: (i) => html`<span class="num tx-credit">${qty(i.recv)}</span>` }, { label: t('Sold'), num: true, render: (i) => html`<span class="num tx-debit">${qty(i.sold)}</span>` },
      { label: t('Corrections'), num: true, render: (i) => html`<span class="num">${qty(i.adj)}</span>` }, { label: t('Closing'), num: true, render: (i) => html`<b class="num">${qty(i.closing)}</b>` }]} /></${Card}>`;
    const rep = { title: 'Stock Summary', subtitle: periodText + ' (kg)', sections: [{ columns: cols.map((c, i) => ({ label: c, num: i > 0 })), rows: r.items.map((i) => [Print.esc(nm(i.item)), qty(i.opening), qty(i.recv), qty(i.sold), qty(i.adj), qty(i.closing)]) }] };
    return [body, rep];
  }
  function balancesView(kind, to) {
    const list = (kind === 'customer' ? Store.s.customers : Store.s.vendors).map((p) => ({ p, b: Store.balance(kind, p.id, to) })).filter((x) => x.b !== 0).sort((a, b) => b.b - a.b);
    const tot = list.reduce((a, x) => a + x.b, 0);
    const body = html`<${Card} pad=${false}><${Table} rows=${list} onRow=${(x) => nav(kind, { id: x.p.id })} columns=${[
      { label: t('Name'), render: (x) => html`<b>${nm(x.p)}</b>` }, { label: t('Phone'), render: (x) => html`<span class="num">${x.p.phone}</span>` },
      { label: t('Balance'), num: true, render: (x) => html`<b><${Num} v=${x.b} /></b>` }]} foot=${[t('Total'), '', html`<b><${Num} v=${tot} /></b>`]} /></${Card}>`;
    const rep = { title: kind === 'customer' ? 'Receivables' : 'Payables', subtitle: tf('Balances as of {d}', { d: dmy(to) }),
      sections: [{ columns: [{ label: 'Name' }, { label: 'Phone' }, { label: 'Balance', num: true }], rows: list.map((x) => [Print.esc(nm(x.p)), x.p.phone, money(x.b)]), foot: [t('Total'), '', money(tot)] }] };
    return [body, rep];
  }

  Object.assign(Screens, { reports: (p) => html`<${Reports} ...${p} />` });
})();
