/* App shell: login, sidebar, top bar, hash router, dashboard, global modals. */
(function () {
  'use strict';
  const { html, useState, useEffect, useStore, Ico, Num, D, Btn, Field, Toasts, Dialogs, Page, Card, Table, Kpi, toast } = UI;
  const { render } = window.htmPreact;
  const { t, tf, nm, money, qty } = I18N;

  /* ---------- router (hash based so Back works everywhere) ---------- */
  function parse() {
    const h = location.hash.replace(/^#\/?/, ''); const [r, q] = h.split('?');
    let p = {}; try { p = q ? JSON.parse(decodeURIComponent(q)) : {}; } catch (e) { p = {}; }
    return { route: r || 'home', params: p };
  }
  function nav(route, params, replace) {
    const h = '#/' + route + (params && Object.keys(params).length ? '?' + encodeURIComponent(JSON.stringify(params)) : '');
    if (replace) location.replace(h); else location.hash = h;
    document.querySelector('.main') && document.querySelector('.main').scrollTo(0, 0);
  }
  const modalSubs = new Set();
  const openModal = (m) => modalSubs.forEach((f) => f(m));
  function applyTheme() { document.documentElement.dataset.theme = Store.s.settings.theme === 'dark' ? 'dark' : 'light'; }

  const NAV = [
    { sec: null, items: [{ r: 'home', l: 'Dashboard', i: 'speedometer2' }] },
    { sec: 'Sales', items: [{ r: 'sales', l: 'Sale Invoices', i: 'receipt', m: ['sales'] }, { r: 'customers', l: 'Customers', i: 'people', m: ['customer'] }, { r: 'recoveries', l: 'Recoveries', i: 'cash-coin' }] },
    { sec: 'Purchases', items: [{ r: 'receipts', l: 'Stock Receipts', i: 'truck', m: ['receipts'] }, { r: 'vendors', l: 'Vendors', i: 'shop', m: ['vendor'] }, { r: 'payments', l: 'Vendor Payments', i: 'send' }] },
    { sec: 'Stock', items: [{ r: 'stock', l: 'Stock', i: 'box-seam', m: ['stock'] }, { r: 'items', l: 'Items & rates', i: 'tags' }] },
    { sec: 'Accounts', items: [{ r: 'expenses', l: 'Expenses', i: 'wallet2' }, { r: 'reports', l: 'Reports', i: 'bar-chart-line' }, { r: 'settings', l: 'Settings', i: 'gear' }] },
  ];
  const isActive = (it, route) => route === it.r || (it.m || []).some((m) => route === m || route.startsWith(m + '-'));

  function Login({ onIn }) {
    useStore(); const shop = Store.s.settings.shop;
    const [pw, setPw] = useState(''); const [err, setErr] = useState('');
    const [isDefault] = useState(() => Store.defaultPassword());
    const go = (e) => { e.preventDefault(); if (Store.checkPassword(pw)) { Store.logLogin(); onIn(); } else setErr(t('Wrong password')); };
    return html`<div class="login"><form class="login-card" onSubmit=${go}>
      <div class="login-logo"><${Logo} size=${56} /></div>
      <h1>${nm(shop)}</h1><div class="muted">${I18N.lang === 'ur' ? shop.sub_ur : shop.sub_en}</div>
      <${Field} label=${t('Owner password')}><input class="inp big-num" type="password" autoFocus value=${pw} onInput=${(e) => { setPw(e.target.value); setErr(''); }} /></${Field}>
      ${err && html`<div class="tx-red">${err}</div>`}
      <${Btn} kind="primary" size="lg" block type="submit" icon="box-arrow-in-left">${t('Open')}</${Btn}>
      ${isDefault && html`<div class="demo-hint"><${Ico} n="info-circle" /> ${t(Store.desktop ? 'First-time password' : 'Demo password')}: <b class="num">1234</b>${Store.desktop ? html`<div class="small">${t('Change it in Settings → Password')}</div>` : ''}</div>`}
      <div class="login-lang"><button type="button" class=${I18N.lang === 'ur' ? 'on' : ''} onClick=${() => I18N.setLang('ur')}>اردو</button><button type="button" class=${I18N.lang === 'en' ? 'on' : ''} onClick=${() => I18N.setLang('en')}>English</button></div>
    </form></div>`;
  }
  function Logo({ size = 38 }) {
    return html`<svg width=${size} height=${size} viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5" /><stop offset="1" stop-color="#7C3AED" /></linearGradient></defs>
      <rect width="40" height="40" rx="10" fill="url(#lg1)" /><path d="M13 27c0-6 3-11 8-11 3 0 5 2 5 5 0 4-3 6-7 6h-6z" fill="#fff" /><circle cx="24" cy="14" r="3.2" fill="#fff" /><path d="M26.5 12.5l3-1.5-2 3z" fill="#F59E0B" /><path d="M23 10.5c.5-1.6 1.6-2.2 2.6-2-.3 1-.8 1.6-1.6 2z" fill="#F43F5E" /><path d="M17 27v4M21 27v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" /></svg>`;
  }

  function Shell() {
    const s = useStore();
    const [loc, setLoc] = useState(parse());
    const [online, setOnline] = useState(navigator.onLine);
    const [modal, setModal] = useState(null);
    const [menu, setMenu] = useState(false);
    useEffect(() => { const f = () => { setLoc(parse()); setMenu(false); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
    useEffect(() => { const a = () => setOnline(true), b = () => setOnline(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
    useEffect(() => { const f = (m) => setModal(m); modalSubs.add(f); return () => modalSubs.delete(f); }, []);
    const Screen = Screens[loc.route] || Screens.home;
    const shop = s.settings.shop;
    const nowD = Store.today();
    return html`<div class=${'shell' + (menu ? ' menu-open' : '')}>
      <aside class="sidebar">
        <div class="sb-logo"><${Logo} /><div><div class="sb-label">${nm(shop)}</div><div class="sb-sub">${t('Poultry Manager')}</div></div></div>
        <nav>${NAV.map((g) => html`${g.sec && html`<div class="sb-sec">${t(g.sec)}</div>`}${g.items.map((it) => html`<button class=${'nav-item' + (isActive(it, loc.route) ? ' on' : '')} onClick=${() => nav(it.r)}><${Ico} n=${it.i} /><span>${t(it.l)}</span></button>`)}`)}</nav>
        <div class="sb-foot">${!Store.desktop ? html`<span class="demo-tag">${t('DEMO — dummy data')}</span>` : s.settings.sample ? html`<span class="demo-tag">${t('Sample data')}</span>` : ''}</div>
      </aside>
      <div class="sb-scrim" onClick=${() => setMenu(false)}></div>
      <div class="main-wrap">
        <header class="topbar">
          <button class="icon-btn menu-btn" onClick=${() => setMenu(!menu)} aria-label="menu"><${Ico} n="list" /></button>
          <div class="tb-date"><${Ico} n="calendar3" /> ${I18N.dayName(Store.dow(nowD))} <b class="num">${I18N.dmy(nowD)}</b></div>
          <span class="grow"></span>
          <span class=${'net ' + (online ? 'on' : 'off')} title=${t(online ? 'Internet connected' : 'No internet — everything still works offline')}><${Ico} n=${online ? 'wifi' : 'wifi-off'} /> ${t(online ? 'Online' : 'Offline')}</span>
          <div class="lang-sw"><button class=${I18N.lang === 'ur' ? 'on' : ''} onClick=${() => I18N.setLang('ur')}>اردو</button><button class=${I18N.lang === 'en' ? 'on' : ''} onClick=${() => I18N.setLang('en')}>EN</button></div>
          <button class="icon-btn" title=${t('Theme')} onClick=${() => { Store.setSettings('theme', s.settings.theme === 'dark' ? 'light' : 'dark'); applyTheme(); }}><${Ico} n=${s.settings.theme === 'dark' ? 'sun' : 'moon'} /></button>
          <${Btn} kind="primary" icon="plus-lg" onClick=${() => nav('sales-new')}>${t('New bill')}</${Btn}>
          <button class="icon-btn" title=${t('Lock')} onClick=${() => App.lock()}><${Ico} n="lock" /></button>
        </header>
        <main class="main" key=${loc.route + JSON.stringify(loc.params)}>${Screen(loc.params)}</main>
      </div>
      ${modal && modal.type === 'party' && html`<${Screens.PartyForm} kind=${modal.kind} value=${modal.value} onSaved=${modal.onSaved} onClose=${() => setModal(null)} />`}
      ${modal && modal.type === 'payment' && html`<${Screens.PaymentModal} id=${modal.id} onClose=${() => setModal(null)} />`}
    </div>`;
  }

  /* ---------------- dashboard ---------------- */
  function Home() {
    const s = useStore();
    const d = Store.today(); const r = Store.summary(d, d);
    const b = s.settings.backup; const last = Store.backupHistory().find((h) => h.ok && h.kind !== 'safety' && h.kind !== 'restore');
    const recent = [].concat(
      s.invoices.slice(-12).map((x) => ({ at: x.date + x.time, icon: 'receipt', tone: 'brand', text: html`${t('Sale')} <b class="num">#${x.no}</b> — ${nm(Store.party('customer', x.customerId))}`, amt: Store.total(x), go: () => nav('sales-view', { id: x.id }), c: x.status === 'cancelled' })),
      s.receipts.slice(-8).map((x) => ({ at: x.date + x.time, icon: 'truck', tone: 'teal', text: html`${t('Stock in')} <b class="num">SR-${x.no}</b> — ${nm(Store.party('vendor', x.vendorId))} · <span class="num">${qty(x.lines.reduce((a, l) => a + +l.qty, 0))}</span> kg`, amt: Store.total(x), go: () => nav('receipts-view', { id: x.id }), c: x.status === 'cancelled' })),
      s.payments.slice(-10).map((x) => ({ at: x.date + x.time, icon: x.dir === 'in' ? 'arrow-down-left-circle' : 'arrow-up-right-circle', tone: x.dir === 'in' ? 'green' : 'yellow', text: html`${t(x.dir === 'in' ? 'Recovery' : 'Paid')} — ${nm(Store.partyOf(x.partyId))} · ${nm(Store.method(x.method))}`, amt: x.amount, go: () => openModal({ type: 'payment', id: x.id }), c: x.status === 'cancelled' })),
    ).sort((a, b2) => b2.at.localeCompare(a.at)).slice(0, 9);
    const topDue = s.customers.map((c) => ({ c, b: Store.balance('customer', c.id) })).filter((x) => x.b > 0).sort((a, b2) => b2.b - a.b).slice(0, 6);
    const tile = (route, icon, label, sub, tone) => html`<button class=${'tile tile-' + tone} onClick=${() => nav(route)}><${Ico} n=${icon} /><b>${t(label)}</b><small>${t(sub)}</small></button>`;
    const h = +Store.nowTime().slice(0, 2);
    return html`<div class="page">
      <div class="hello"><h1>${t(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')}</h1><div class="muted">${t("Here is today's business at a glance")}</div></div>
      <div class="tiles">${tile('sales-new', 'receipt', 'New sale', 'Make a bill', 'brand')}${tile('receipts-new', 'truck', 'Stock received', 'From vendor or farm', 'teal')}
        ${tile('recoveries-new', 'cash-coin', 'Recovery', 'Money from customer', 'green')}${tile('payments-new', 'send', 'Pay vendor', 'Money to vendor', 'yellow')}${tile('expenses', 'wallet2', 'Expense', 'Bills, transport…', 'red')}</div>
      <div class="kpis kpis-6">
        <${Kpi} icon="receipt" label=${t("Today's sales")} value=${money(r.sales)} sub=${r.invoiceCount + ' ' + t('bills') + ' · ' + qty(r.items.reduce((a, i) => a + i.sold, 0)) + ' kg'} onClick=${() => nav('reports')} />
        <${Kpi} icon="truck" tone="teal" label=${t('Stock received today')} value=${qty(r.items.reduce((a, i) => a + i.recv, 0)) + ' kg'} sub=${r.receiptCount + ' ' + t('receipts')} onClick=${() => nav('receipts')} />
        <${Kpi} icon="cash-coin" tone="green" label=${t('Recovered today')} value=${money(r.recov)} onClick=${() => nav('recoveries')} />
        <${Kpi} icon="send" tone="yellow" label=${t('Paid to vendors today')} value=${money(r.paidOut)} onClick=${() => nav('payments')} />
        <${Kpi} icon="arrow-down-left-circle" tone="green" label=${t('Total receivable')} value=${money(r.receivable)} onClick=${() => nav('reports', { tab: 'recv' })} />
        <${Kpi} icon="arrow-up-right-circle" tone="red" label=${t('Total payable')} value=${money(r.payable)} onClick=${() => nav('reports', { tab: 'pay' })} />
      </div>
      <div class="grid-dash">
        <${Card} title=${t('Stock now')} actions=${html`<${Btn} kind="ghost" size="sm" onClick=${() => nav('stock')}>${t('Open stock')}</${Btn}>`}>
          <div class="mini-stock">${s.items.filter((i) => i.active).map((i) => { const q = Store.stockOf(i.id); return html`<div class=${'ms' + (q < 0 ? ' neg' : q < 20 ? ' low' : '')} onClick=${() => nav('stock-item', { id: i.id })}><span>${nm(i)}</span><b class="num">${qty(q)}</b><small>${t(i.unit)} · ${t('rate')} <span class="num">${money(i.rate)}</span></small></div>`; })}</div>
        </${Card}>
        <${Card} title=${t('Recent activity')} pad=${false}>
          <div class="feed">${recent.map((x) => html`<button class=${'feed-row' + (x.c ? ' row-cancel' : '')} onClick=${x.go}><span class=${'feed-ic tone-' + x.tone}><${Ico} n=${x.icon} /></span><span class="feed-t">${x.text}<small class="muted num">${I18N.dmy(x.at.slice(0, 10))} ${x.at.slice(10)}</small></span><b class="num">${money(x.amt)}</b></button>`)}</div>
        </${Card}>
        <${Card} title=${t('Highest balances to receive')} pad=${false} actions=${html`<${Btn} kind="ghost" size="sm" onClick=${() => nav('reports', { tab: 'credit' })}>${t('Daily credit list')}</${Btn}>`}>
          <${Table} rows=${topDue} onRow=${(x) => nav('customer', { id: x.c.id })} columns=${[{ label: t('Customer'), render: (x) => html`<b>${nm(x.c)}</b>` }, { label: t('Balance'), num: true, render: (x) => html`<b><${Num} v=${x.b} /></b>` }]} />
        </${Card}>
        <${Card} title=${t('Backup')} actions=${html`<${Btn} kind="ghost" size="sm" onClick=${() => nav('settings', { tab: 'backup' })}>${t('Settings')}</${Btn}>`}>
          <div class=${'backup-mini ' + (b.enabled ? 'ok' : 'off')}><${Ico} n=${b.enabled ? 'shield-check' : 'shield-exclamation'} />
            <div><b>${t(b.enabled ? (b.frequency === 'weekly' ? 'Weekly backup is on' : 'Automatic backup is ON') : 'Automatic backup is OFF')}</b>
              <div class="muted small">${t('Last backup')}: <span class="num">${last ? last.at : '—'}</span></div>
              ${b.frequency === 'weekly' && html`<div class="muted small">${t('Every')} ${I18N.dayName(b.day)} <span class="num">${b.time}</span></div>`}</div></div>
        </${Card}>
      </div></div>`;
  }
  Screens.home = () => html`<${Home} />`;

  /* ---------------- boot ---------------- */
  function Root() {
    useStore();
    const [inside, setIn] = useState(() => { try { return sessionStorage.getItem('pm.in') === '1'; } catch (e) { return false; } });
    App.lock = () => { try { sessionStorage.removeItem('pm.in'); } catch (e) { /* ignore */ } setIn(false); };
    const enter = () => { try { sessionStorage.setItem('pm.in', '1'); } catch (e) { /* ignore */ } setIn(true); };
    return html`${inside ? html`<${Shell} />` : html`<${Login} onIn=${enter} />`}<${Toasts} /><${Dialogs} />`;
  }
  window.App = {
    nav, applyTheme, lock: () => {},
    openPartyForm: (kind, value, onSaved) => openModal({ type: 'party', kind, value, onSaved }),
    openPayment: (id) => openModal({ type: 'payment', id }),
  };
  applyTheme();
  render(html`<${Root} />`, document.getElementById('app'));
})();
