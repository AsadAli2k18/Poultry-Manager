/* Stock overview, stock card per item, corrections, and the items list. */
(function () {
  'use strict';
  const { html, useState, useStore, Ico, Num, Qty, D, Btn, Field, Badge, toast, ask, Modal, Page, Card, Table, Seg, DateInp, ItemSelect, NameFields, Kpi } = UI;
  const { t, tf, nm, money, qty } = I18N;
  const nav = (...a) => App.nav(...a);
  const REASONS = ['Mortality', 'Weight loss', 'Count correction', 'Damaged / spoiled', 'Other'];

  function Stock() {
    const s = useStore();
    const [adj, setAdj] = useState(null);
    const today = Store.today();
    const items = s.items.filter((i) => i.active);
    const cancelAdj = async (a) => {
      const reason = await ask({ title: t('Cancel this correction?'), body: t('The stock goes back to what it was before this correction. The entry stays on record as cancelled.'), input: t('Reason'), inputReq: true, danger: true, okLabel: t('Cancel entry') });
      if (reason) { Store.cancelAdjustment(a.id, reason); toast(t('Entry cancelled'), 'success'); }
    };
    const moved = (it, list, sign) => list.filter((d) => Store.active(d) && d.date === today).reduce((a, d) => a + d.lines.filter((l) => l.itemId === it.id).reduce((b, l) => b + +l.qty, 0), 0);
    return html`<${Page} title=${t('Stock')} icon="box-seam" actions=${html`<${Btn} icon="sliders" onClick=${() => setAdj({})}>${t('Stock correction')}</${Btn}>
        <${Btn} kind="primary" size="lg" icon="truck" onClick=${() => nav('receipts-new')}>${t('New stock receipt')}</${Btn}>`}>
      <div class="stock-grid">${items.map((it) => {
        const q = Store.stockOf(it.id); const inT = moved(it, s.receipts); const outT = moved(it, s.invoices);
        return html`<div class=${'stock-card' + (q < 0 ? ' neg' : q < 20 ? ' low' : '')} onClick=${() => nav('stock-item', { id: it.id })}>
          <div class="stock-name">${nm(it)}</div><div class="stock-q num">${qty(q)} <small>${t(it.unit)}</small></div>
          <div class="stock-mv"><span class="tx-credit"><${Ico} n="arrow-down-circle" /> ${t('In today')} <b class="num">${qty(inT)}</b></span>
            <span class="tx-debit"><${Ico} n="arrow-up-circle" /> ${t('Sold today')} <b class="num">${qty(outT)}</b></span></div>
          <div class="muted small">${t('Selling rate')}: <b class="num">${money(it.rate)}</b> / ${t(it.unit)}</div>
          ${q < 0 && html`<div class="tx-red small"><${Ico} n="exclamation-triangle" /> ${t('Below zero — check entries or add a correction')}</div>`}</div>`;
      })}</div>
      <${Card} title=${t('Recent corrections')} pad=${false}>
        <${Table} limit=${15} rows=${s.adjustments.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))} rowCls=${(a) => (Store.active(a) ? '' : 'row-cancel')} empty=${t('No corrections yet')} columns=${[
          { label: t('Date'), render: (a) => html`<${D} v=${a.date} />` }, { label: t('Item'), render: (a) => nm(Store.item(a.itemId)) },
          { label: t('Quantity'), num: true, render: (a) => html`<b class=${'num ' + (a.qty < 0 ? 'tx-debit' : 'tx-credit')}>${a.qty > 0 ? '+' : ''}${qty(a.qty)}</b>` }, { label: t('Reason'), render: (a) => html`${t(a.reason)}${!Store.active(a) ? html`<div class="muted small">${t('Cancelled')}: ${a.cancelReason}</div>` : ''}` },
          { label: '', render: (a) => (Store.active(a) ? html`<button class="icon-btn" title=${t('Cancel entry')} onClick=${() => cancelAdj(a)}><${Ico} n="x-circle" /></button>` : html`<${Badge} s="cancelled" />`) }]} />
      </${Card}>
      ${adj && html`<${AdjForm} itemId=${adj.itemId} onClose=${() => setAdj(null)} />`}
    </${Page}>`;
  }

  function StockItem({ id }) {
    const s = useStore(); const it = s.items.find((i) => i.id === id);
    const [adj, setAdj] = useState(false);
    if (!it) return null;
    const card = Store.stockCard(id);
    const rows = card.rows.slice().reverse();
    return html`<${Page} title=${nm(it)} icon="box-seam" sub=${t('Stock card — every movement in and out')}
      actions=${html`<${Btn} kind="ghost" icon="arrow-right-short" onClick=${() => history.back()}>${t('Back')}</${Btn}><${Btn} icon="sliders" onClick=${() => setAdj(true)}>${t('Stock correction')}</${Btn}>`}>
      <div class="kpis"><${Kpi} icon="flag" label=${t('Opening stock')} value=${qty(card.opening) + ' kg'} /><${Kpi} icon="box-seam" tone="teal" label=${t('Available now')} value=${qty(Store.stockOf(id)) + ' kg'} />
        <${Kpi} icon="tag" tone="yellow" label=${t('Selling rate')} value=${money(it.rate)} />${Store.avgCost(id) != null && html`<${Kpi} icon="calculator" tone="brand" label=${t('Average cost')} value=${money(Store.avgCost(id))} />`}</div>
      <${Card} pad=${false}><${Table} limit=${80} rows=${rows} rowCls=${(r) => (r.cancelled ? 'row-cancel' : '')} columns=${[
        { label: t('Date'), render: (r) => html`<${D} v=${r.date} /> <small class="muted num">${r.time}</small>` },
        { label: t('Details'), render: (r) => r.type === 'adj' ? html`<span>${t('Correction')} — ${t(r.adj.reason)}${r.cancelled ? html` <${Badge} s="cancelled" />` : ''}</span>` : html`<a onClick=${() => nav(r.type === 'in' ? 'receipts-view' : 'sales-view', { id: r.doc.id })}>${r.type === 'in' ? t('Stock receipt') + ' SR-' + r.doc.no : t('Sale invoice') + ' #' + r.doc.no}</a> · ${nm(Store.partyOf(Store.docParty(r.doc)))}${r.cancelled ? html` <${Badge} s="cancelled" />` : ''}` },
        { label: t('In'), num: true, render: (r) => (r.qty > 0 ? html`<b class="num tx-credit">${qty(r.qty)}</b>` : '') },
        { label: t('Out'), num: true, render: (r) => (r.qty < 0 ? html`<b class="num tx-debit">${qty(-r.qty)}</b>` : '') },
        { label: t('Balance'), num: true, render: (r) => html`<b class="num">${qty(r.balance)}</b>` }]} /></${Card}>
      ${adj && html`<${AdjForm} itemId=${id} onClose=${() => setAdj(false)} />`}
    </${Page}>`;
  }

  function AdjForm({ itemId, onClose }) {
    const [f, setF] = useState({ itemId: itemId || '', date: Store.today(), dir: '-', qty: '', reason: 'Weight loss', other: '' });
    const save = () => {
      if (!f.itemId) return toast(t('Choose item'), 'error');
      if (!(+f.qty > 0)) return toast(t('Enter the quantity'), 'error');
      const reason = f.reason === 'Other' ? f.other.trim() : f.reason;
      if (!reason) return toast(t('Enter the reason'), 'error');
      Store.saveAdjustment({ itemId: f.itemId, date: f.date, qty: (f.dir === '-' ? -1 : 1) * +f.qty, reason });
      toast(t('Correction saved'), 'success'); onClose();
    };
    return html`<${Modal} title=${t('Stock correction')} onClose=${onClose} footer=${html`<${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}><${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <div class="grid-2"><${Field} label=${t('Item')} req><${ItemSelect} value=${f.itemId} onChange=${(v) => setF({ ...f, itemId: v })} /></${Field}>
        <${Field} label=${t('Date')}><${DateInp} value=${f.date} onChange=${(v) => setF({ ...f, date: v })} /></${Field}>
        <${Field} label=${t('Direction')}><${Seg} value=${f.dir} onChange=${(v) => setF({ ...f, dir: v })} options=${[{ value: '-', label: t('Reduce'), icon: 'dash-circle' }, { value: '+', label: t('Increase'), icon: 'plus-circle' }]} /></${Field}>
        <${Field} label=${t('Quantity') + ' (kg)'} req><input class="inp num big-num" type="number" min="0" step="0.01" value=${f.qty} onInput=${(e) => setF({ ...f, qty: e.target.value })} /></${Field}>
        <${Field} label=${t('Reason')} req span="2"><div class="chips">${REASONS.map((r) => html`<button type="button" class=${'chip' + (f.reason === r ? ' on' : '')} onClick=${() => setF({ ...f, reason: r })}>${t(r)}</button>`)}</div>
          ${f.reason === 'Other' && html`<input class="inp" style="margin-top:8px" value=${f.other} onInput=${(e) => setF({ ...f, other: e.target.value })} placeholder=${t('Write the reason')} />`}</${Field}>
        ${f.itemId && f.qty && html`<div class="span-2 alert alert-teal">${t('Stock after correction')}: <b class="num">${qty(Store.stockOf(f.itemId) + (f.dir === '-' ? -1 : 1) * +f.qty)}</b> kg</div>`}</div>
    </${Modal}>`;
  }

  function Items() {
    const s = useStore();
    const [edit, setEdit] = useState(null); const [rates, setRates] = useState({});
    const dirty = Object.keys(rates).length > 0;
    const saveRates = () => { Object.keys(rates).forEach((id) => Store.saveItem({ ...Store.item(id), rate: +rates[id] || 0 })); setRates({}); toast(t("Today's rates saved"), 'success'); };
    return html`<${Page} title=${t('Items & rates')} icon="tags" sub=${t('Add any product you sell. The rate here is the default; it can be changed on every bill.')}
      actions=${html`${dirty && html`<${Btn} kind="primary" icon="check2-all" onClick=${saveRates}>${t("Save today's rates")}</${Btn}>`}<${Btn} kind=${dirty ? 'default' : 'primary'} size="lg" icon="plus-lg" onClick=${() => setEdit({})}>${t('Add item')}</${Btn}>`}>
      <${Card} pad=${false}><${Table} rows=${s.items} rowCls=${(i) => (i.active ? '' : 'row-cancel')} columns=${[
        { label: t('Name'), render: (i) => html`<b>${nm(i)}</b><div class="muted small">${I18N.lang === 'ur' ? i.name_en : i.name_ur}</div>` },
        { label: t('Unit'), render: (i) => t(i.unit) },
        { label: t('Default selling rate'), render: (i) => html`<input class=${'inp num rate-inp' + (rates[i.id] != null ? ' changed' : '')} type="number" value=${rates[i.id] != null ? rates[i.id] : i.rate} onInput=${(e) => setRates({ ...rates, [i.id]: e.target.value })} />` },
        { label: t('Cost rate'), num: true, render: (i) => (Store.avgCost(i.id) != null ? html`<span class="num">${money(Store.avgCost(i.id))}</span>` : html`<span class="muted">—</span>`) },
        { label: t('Available'), num: true, render: (i) => html`<b class="num">${qty(Store.stockOf(i.id))}</b>` },
        { label: t('Status'), render: (i) => html`<${Badge} s=${i.active ? 'active' : 'inactive'} />` },
        { label: '', render: (i) => html`<button class="icon-btn" title=${t('Edit')} onClick=${() => setEdit(i)}><${Ico} n="pencil" /></button>` }]} /></${Card}>
      <p class="muted small pad">${t('Cost rate is the average purchase rate from vendor stock receipts (own farm stock has no cost). Profit is only shown where cost is known.')}</p>
      ${edit && html`<${ItemForm} value=${edit} onClose=${() => setEdit(null)} />`}
    </${Page}>`;
  }
  function ItemForm({ value, onClose }) {
    const [f, setF] = useState({ name_en: '', name_ur: '', unit: 'kg', rate: '', cost: '', opening: 0, active: true, ...value });
    const save = () => {
      if (!f.name_en && !f.name_ur) return toast(t('Enter the name'), 'error');
      Store.saveItem({ ...f, rate: +f.rate || 0, cost: f.cost === '' || f.cost == null ? null : +f.cost, opening: +f.opening || 0 }); toast(t('Saved'), 'success'); onClose();
    };
    return html`<${Modal} title=${t(f.id ? 'Edit item' : 'Add item')} onClose=${onClose} footer=${html`<${Btn} kind="ghost" onClick=${onClose}>${t('Back')}</${Btn}><${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <${NameFields} value=${f} onChange=${(v) => setF({ ...f, ...v })} label=${t('Item name')} />
      <div class="grid-2"><${Field} label=${t('Unit')}><select class="inp" value=${f.unit} onChange=${(e) => setF({ ...f, unit: e.target.value })}>${['kg', 'piece', 'dozen'].map((u) => html`<option value=${u}>${t(u)}</option>`)}</select></${Field}>
        <${Field} label=${t('Default selling rate')} req><input class="inp num" type="number" value=${f.rate} onInput=${(e) => setF({ ...f, rate: e.target.value })} /></${Field}>
        <${Field} label=${t('Cost rate')} hint=${t('Optional — only if you want profit for own-farm stock')}><input class="inp num" type="number" value=${f.cost == null ? '' : f.cost} onInput=${(e) => setF({ ...f, cost: e.target.value })} /></${Field}>
        <${Field} label=${t('Opening stock')} hint=${t('Quantity on the go-live date')}><input class="inp num" type="number" value=${f.opening} onInput=${(e) => setF({ ...f, opening: e.target.value })} /></${Field}>
        ${f.id && html`<label class="check span-2"><input type="checkbox" checked=${f.active} onChange=${(e) => setF({ ...f, active: e.target.checked })} /> <span>${t('Active')}</span></label>`}</div>
    </${Modal}>`;
  }

  Object.assign(Screens, { stock: () => html`<${Stock} />`, 'stock-item': (p) => html`<${StockItem} ...${p} />`, items: () => html`<${Items} />` });
})();
