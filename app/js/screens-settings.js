/* Settings: shop profile, print designer, expense categories, payment methods, backup, display, security, audit log. */
(function () {
  'use strict';
  const { html, useState, useStore, Ico, Btn, Field, Badge, toast, confirmBox, Modal, Page, Card, Table, Seg, NameFields } = UI;
  const { t, tf, nm, dmy } = I18N;
  const TABS = [
    { value: 'shop', label: 'Shop profile', icon: 'shop-window' }, { value: 'print', label: 'Print designer', icon: 'printer' },
    { value: 'backup', label: 'Backup', icon: 'cloud-arrow-up' }, { value: 'categories', label: 'Expense categories', icon: 'tags' },
    { value: 'methods', label: 'Payment methods', icon: 'credit-card' }, { value: 'display', label: 'Language & display', icon: 'translate' },
    { value: 'security', label: 'Password', icon: 'shield-lock' }, { value: 'audit', label: 'Activity log', icon: 'clock-history' },
  ];
  function Settings({ tab: tab0 }) {
    useStore();
    const [tab, setTab] = useState(tab0 || 'shop');
    const V = { shop: Shop, print: PrintDesigner, backup: Backup, categories: () => html`<${Lookup} kind="categories" />`, methods: () => html`<${Lookup} kind="methods" />`, display: Display, security: Security, audit: Audit }[tab];
    return html`<${Page} title=${t('Settings')} icon="gear"><div class="settings"><nav class="set-nav">${TABS.map((x) => html`<button class=${tab === x.value ? 'on' : ''} onClick=${() => setTab(x.value)}><${Ico} n=${x.icon} /> ${t(x.label)}</button>`)}</nav>
      <div class="set-body"><${V} /></div></div></${Page}>`;
  }

  function Shop() {
    const s = useStore(); const shop = s.settings.shop;
    const [f, setF] = useState(() => JSON.parse(JSON.stringify(shop)));
    const [acc, setAcc] = useState(s.settings.accounts.join('\n'));
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const setO = (i, k) => (e) => { const owners = f.owners.slice(); owners[i] = { ...owners[i], [k]: e.target.value }; setF({ ...f, owners }); };
    const logo = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => setF({ ...f, logo: r.result }); r.readAsDataURL(file); };
    const save = () => { Store.setSettings('shop', f); Store.setSettings('accounts', acc.split('\n').map((x) => x.trim()).filter(Boolean)); toast(t('Saved'), 'success'); };
    return html`<${Card} title=${t('Shop profile')} actions=${html`<${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <p class="muted">${t('These details appear at the top of every printed bill and report.')}</p>
      <div class="grid-2">
        <${Field} label=${t('Shop name') + ' — ' + t('Urdu')}><input class="inp urdu" dir="rtl" value=${f.name_ur} onInput=${set('name_ur')} /></${Field}>
        <${Field} label=${t('Shop name') + ' — English'}><input class="inp" dir="ltr" value=${f.name_en} onInput=${set('name_en')} /></${Field}>
        <${Field} label=${t('Second line') + ' — ' + t('Urdu')}><input class="inp urdu" dir="rtl" value=${f.sub_ur} onInput=${set('sub_ur')} /></${Field}>
        <${Field} label=${t('Second line') + ' — English'}><input class="inp" dir="ltr" value=${f.sub_en} onInput=${set('sub_en')} /></${Field}>
        <${Field} label=${t('Address') + ' — ' + t('Urdu')}><input class="inp urdu" dir="rtl" value=${f.addr_ur} onInput=${set('addr_ur')} /></${Field}>
        <${Field} label=${t('Address') + ' — English'}><input class="inp" dir="ltr" value=${f.addr_en} onInput=${set('addr_en')} /></${Field}>
        ${f.owners.map((o, i) => html`<${Field} label=${tf('Contact {n}', { n: i + 1 })}><div class="inline3"><input class="inp urdu" dir="rtl" value=${o.name_ur} onInput=${setO(i, 'name_ur')} /><input class="inp" dir="ltr" value=${o.name_en} onInput=${setO(i, 'name_en')} /><input class="inp num" dir="ltr" value=${o.phone} onInput=${setO(i, 'phone')} /></div></${Field}>`)}
        <${Field} label=${t('Logo')} hint=${t('Optional')}><div class="photo-row"><input type="file" accept="image/*" onChange=${logo} />${f.logo && html`<img class="thumb" src=${f.logo} /><${Btn} kind="ghost" size="sm" onClick=${() => setF({ ...f, logo: '' })}>${t('Remove')}</${Btn}>`}</div></${Field}>
        <${Field} label=${t('Our bank / wallet accounts')} hint=${t('One per line — offered as suggestions in payment forms')} span="2"><textarea class="inp num" dir="ltr" rows="3" value=${acc} onInput=${(e) => setAcc(e.target.value)}></textarea></${Field}>
      </div></${Card}>`;
  }

  /* ---------------- print designer ---------------- */
  const DOCS = [{ value: 'sale', label: 'Sale invoice' }, { value: 'receipt', label: 'Stock receipt' }, { value: 'recovery', label: 'Recovery receipt' }, { value: 'payment', label: 'Payment voucher' }, { value: 'report', label: 'Reports & ledgers' }];
  const ACCENTS = ['#B4141F', '#4F46E5', '#0E7C74', '#1F7A3D', '#BC5F0A', '#111827'];
  const TOGGLES = [['showBillNo', 'Bill number'], ['showRate', 'Rate column'], ['showPrev', 'Previous balance'], ['showReceived', 'Amount received / paid'], ['showNewBal', 'New balance'], ['showPayDetails', 'Payment details (method, TID…)'], ['showSignature', 'Signature line'], ['showLogo', 'Logo']];
  function sampleFor(type) {
    const s = Store.s; const last = (l) => l.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
    if (type === 'sale') return last(s.invoices.filter((d) => d.customerId === 'c2' && Store.active(d))) || last(s.invoices);
    if (type === 'receipt') return last(s.receipts.filter((d) => d.vendorId === 'v1')) || last(s.receipts);
    if (type === 'recovery') return last(s.payments.filter((p) => p.dir === 'in' && p.method !== 'cash')) || last(s.payments);
    if (type === 'payment') return last(s.payments.filter((p) => p.dir === 'out'));
    const r = Store.creditList('customer', Store.today(), Store.today());
    return { title: 'Daily Credit List', subtitle: dmy(Store.today()), sections: [{ columns: [{ label: 'Customer' }, { label: 'Previous balance', num: true }, { label: 'New credit', num: true }, { label: 'Received', num: true }, { label: 'Closing balance', num: true }],
      rows: r.rows.map((x) => [Print.esc(nm(x.party)), I18N.money(x.prev), I18N.money(x.add), I18N.money(x.paid), I18N.money(x.closing)]) }] };
  }
  function PrintDesigner() {
    const s = useStore();
    const [type, setType] = useState('sale');
    const cfg = s.settings.print[type];
    const set = (k, v) => Store.setSettings('print.' + type + '.' + k, v);
    const sample = sampleFor(type);
    const w = { A4: 794, A5: 560, A6: 400 }[cfg.paper];
    return html`<div class="designer">
      <${Card} title=${t('Print designer')} actions=${html`<${Btn} kind="ghost" size="sm" icon="arrow-counterclockwise" onClick=${async () => { if (await confirmBox(t('Reset designs?'), t('All documents go back to the default design.'))) Store.resetPrint(); }}>${t('Reset')}</${Btn}>`}>
        <${Field} label=${t('Document')}><select class="inp" value=${type} onChange=${(e) => setType(e.target.value)}>${DOCS.map((d) => html`<option value=${d.value}>${t(d.label)}</option>`)}</select></${Field}>
        <${Field} label=${t('Template')}><div class="tpl-cards">${[['classic', 'Classic', 'Like the bill pad'], ['modern', 'Modern', 'Clean, coloured bar'], ['minimal', 'Minimal', 'Plain, saves ink']].map(([v, l, d]) => html`
          <button type="button" class=${'tpl' + (cfg.template === v ? ' on' : '')} onClick=${() => set('template', v)}><span class=${'tpl-art tpl-' + v}><i></i><i></i><i></i></span><b>${t(l)}</b><small>${t(d)}</small></button>`)}</div></${Field}>
        <${Field} label=${t('Paper size')}><${Seg} value=${cfg.paper} onChange=${(v) => set('paper', v)} options=${[{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }, { value: 'A6', label: t('A6 (bill pad)') }]} /></${Field}>
        <${Field} label=${t('Print language')}><${Seg} value=${cfg.lang} onChange=${(v) => set('lang', v)} options=${[{ value: 'ur', label: 'اردو' }, { value: 'en', label: 'English' }, { value: 'both', label: t('Both') }]} /></${Field}>
        <${Field} label=${t('Text size')}><${Seg} value=${cfg.font} onChange=${(v) => set('font', v)} options=${[{ value: 's', label: t('Small') }, { value: 'm', label: t('Medium') }, { value: 'l', label: t('Large') }]} /></${Field}>
        <${Field} label=${t('Colour')}><div class="swatches">${ACCENTS.map((c) => html`<button type="button" class=${'sw' + (cfg.accent === c ? ' on' : '')} style=${'background:' + c} onClick=${() => set('accent', c)} aria-label=${c}></button>`)}</div></${Field}>
        <${Field} label=${t('Show on the document')}><div class="toggles">${TOGGLES.map(([k, l]) => html`<label class="check"><input type="checkbox" checked=${!!cfg[k]} onChange=${(e) => set(k, e.target.checked)} /> <span>${t(l)}</span></label>`)}</div></${Field}>
        <${Field} label=${t('Footer text') + ' — ' + t('Urdu')}><input class="inp urdu" dir="rtl" value=${cfg.footer_ur} onInput=${(e) => set('footer_ur', e.target.value)} /></${Field}>
        <${Field} label=${t('Footer text') + ' — English'}><input class="inp" dir="ltr" value=${cfg.footer_en} onInput=${(e) => set('footer_en', e.target.value)} /></${Field}>
      </${Card}>
      <div class="designer-preview"><div class="muted small">${t('Live preview')} — ${t(DOCS.find((d) => d.value === type).label)} · ${cfg.paper}</div>
        ${sample ? html`<${UI.FitFrame} doc=${Print.build(type, sample)} width=${w} />` : html`<div class="muted">${t('No sample yet')}</div>`}
        ${sample && html`<${Btn} icon="printer" onClick=${() => Print.print(type, sample)}>${t('Test print')}</${Btn}>`}</div>
    </div>`;
  }

  /* ---------------- backup ---------------- */
  function nextRun(b) {
    const [hh, mm] = b.time.split(':').map(Number);
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    for (let i = 0; i < 40; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i); d.setHours(hh, mm, 0, 0);
      if (d <= now) continue;
      if (b.frequency === 'daily' || (b.frequency === 'weekly' && d.getDay() === +b.day) || (b.frequency === 'monthly' && d.getDate() === 1)) return d;
    }
    return null;
  }
  function Backup() {
    const s = useStore(); const b = s.settings.backup;
    const set = (k, v) => Store.setSettings('backup.' + k, v);
    const nx = b.enabled ? nextRun(b) : null;
    const last = b.history[0];
    const fileName = () => 'PoultryManager-backup-' + Store.today() + '-' + Store.nowTime().replace(':', '') + '.json';
    const backupNow = () => {
      const data = Store.exportData();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = fileName(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      Store.recordBackup({ kind: 'manual', size: Math.round(data.length / 1024), where: b.folder, usb: false });
      toast(t('Backup created'), 'success');
    };
    const restore = (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      const r = new FileReader();
      r.onload = async () => {
        if (!(await confirmBox(t('Restore this backup?'), tf('All current data will be replaced with the backup "{f}". Make a fresh backup first if unsure.', { f: file.name }), { danger: true, okLabel: t('Restore') }))) return;
        try { Store.importData(r.result); toast(t('Data restored'), 'success'); } catch (err) { toast(t('This file is not a valid Poultry Manager backup'), 'error'); }
      };
      r.readAsText(file);
    };
    return html`<div class="stack">
      <div class=${'backup-hero ' + (b.enabled ? 'ok' : 'off')}><${Ico} n=${b.enabled ? 'shield-check' : 'shield-exclamation'} />
        <div><b>${b.enabled ? t('Automatic backup is ON') : t('Automatic backup is OFF')}</b>
          <div>${t('Last backup')}: <span class="num">${last ? last.at : '—'}</span>${nx ? html` · ${t('Next backup')}: <b class="num">${dmy(nx.toISOString().slice(0, 10))} ${b.time}</b> (${I18N.dayName(nx.getDay())})` : ''}</div></div>
        <span class="grow"></span><${Btn} kind="primary" size="lg" icon="cloud-arrow-up" onClick=${backupNow}>${t('Backup now')}</${Btn}></div>
      <${Card} title=${t('Automatic backup schedule')}>
        <div class="grid-2">
          <label class="check span-2"><input type="checkbox" checked=${b.enabled} onChange=${(e) => set('enabled', e.target.checked)} /> <span><b>${t('Back up automatically')}</b></span></label>
          <${Field} label=${t('How often')}><${Seg} value=${b.frequency} onChange=${(v) => set('frequency', v)} options=${[{ value: 'daily', label: t('Daily') }, { value: 'weekly', label: t('Weekly') }, { value: 'monthly', label: t('Monthly') }]} /></${Field}>
          ${b.frequency === 'weekly' && html`<${Field} label=${t('Day')}><select class="inp" value=${b.day} onChange=${(e) => set('day', +e.target.value)}>${[0, 1, 2, 3, 4, 5, 6].map((d) => html`<option value=${d}>${I18N.dayName(d)}</option>`)}</select></${Field}>`}
          ${b.frequency === 'monthly' && html`<${Field} label=${t('Day')}><input class="inp" disabled value=${t('1st of every month')} /></${Field}>`}
          <${Field} label=${t('Time')}><input class="inp num" type="time" value=${b.time} onChange=${(e) => set('time', e.target.value)} /></${Field}>
          <${Field} label=${t('Keep last')} hint=${t('Older backups are deleted automatically')}><select class="inp" value=${b.keep} onChange=${(e) => set('keep', +e.target.value)}>${[4, 8, 12, 26, 52].map((n) => html`<option value=${n}>${n} ${t('backups')}</option>`)}</select></${Field}>
          <${Field} label=${t('Backup folder')} span="2"><div class="inline2"><input class="inp num" dir="ltr" value=${b.folder} onInput=${(e) => set('folder', e.target.value)} /><${Btn} icon="folder2-open" onClick=${() => toast(t('Folder picker opens in the desktop app'), 'info')}>${t('Browse')}</${Btn}></div></${Field}>
          <label class="check span-2"><input type="checkbox" checked=${b.usb} onChange=${(e) => set('usb', e.target.checked)} /> <span>${t('Also copy to a USB drive when one is plugged in')}</span></label>
        </div>
        <div class="alert alert-teal"><${Ico} n="info-circle" /> ${t('If the computer is off at backup time, the backup runs as soon as the app is opened next.')}</div>
      </${Card}>
      <${Card} title=${t('Restore')}>
        <p class="muted">${t('Bring back data from a backup file (for example after changing the computer).')}</p>
        <label class="btn btn-default"><${Ico} n="cloud-arrow-down" /><span>${t('Choose backup file…')}</span><input type="file" accept=".json,application/json" hidden onChange=${restore} /></label>
      </${Card}>
      <${Card} title=${t('Backup history')} pad=${false}>
        <${Table} limit=${12} rows=${b.history} columns=${[
          { label: t('Date / time'), render: (h) => html`<span class="num">${h.at}</span>` }, { label: t('Type'), render: (h) => html`<span class=${'badge ' + (h.kind === 'auto' ? 'badge-brand' : 'badge-yellow')}>${t(h.kind === 'auto' ? 'Automatic' : 'Manual')}</span>` },
          { label: t('Saved to'), render: (h) => html`<span class="num small">${h.where}</span>${h.usb ? html` <span class="badge badge-teal">USB</span>` : ''}` },
          { label: t('Size'), num: true, render: (h) => html`<span class="num">${h.size} KB</span>` }, { label: t('Status'), render: (h) => html`<span class="badge badge-green">${t('OK')}</span>` }]} /></${Card}>
    </div>`;
  }

  function Lookup({ kind }) {
    const s = useStore(); const list = s[kind];
    const [edit, setEdit] = useState(null);
    const isCat = kind === 'categories';
    return html`<${Card} title=${t(isCat ? 'Expense categories' : 'Payment methods')} actions=${html`<${Btn} kind="primary" icon="plus-lg" onClick=${() => setEdit({ name_en: '', name_ur: '' })}>${t('Add')}</${Btn}>`} pad=${false}>
      <${Table} rows=${list} rowCls=${(x) => (x.active ? '' : 'row-cancel')} columns=${[
        { label: t('Name') + ' — ' + t('Urdu'), render: (x) => html`<b>${x.name_ur}</b>` }, { label: t('Name') + ' — English', render: (x) => x.name_en },
        { label: t('Status'), render: (x) => html`<${Badge} s=${x.active ? 'active' : 'inactive'} />` },
        { label: '', render: (x) => html`<button class="icon-btn" onClick=${() => setEdit(x)}><${Ico} n="pencil" /></button>` }]} />
      ${edit && html`<${Modal} title=${t(isCat ? 'Expense category' : 'Payment method')} onClose=${() => setEdit(null)} size="sm" footer=${html`<${Btn} kind="ghost" onClick=${() => setEdit(null)}>${t('Back')}</${Btn}>
        <${Btn} kind="primary" icon="check2" onClick=${() => { if (!edit.name_en && !edit.name_ur) return; (isCat ? Store.saveCategory : Store.saveMethod)(edit); setEdit(null); toast(t('Saved'), 'success'); }}>${t('Save')}</${Btn}>`}>
        <${NameFields} value=${edit} onChange=${(v) => setEdit({ ...edit, ...v })} />
        ${edit.id && html`<label class="check"><input type="checkbox" checked=${edit.active} onChange=${(e) => setEdit({ ...edit, active: e.target.checked })} /> <span>${t('Active')}</span></label>`}
      </${Modal}>`}
    </${Card}>`;
  }

  function Display() {
    const s = useStore();
    return html`<${Card} title=${t('Language & display')}>
      <${Field} label=${t('Language')}><${Seg} value=${I18N.lang} onChange=${(v) => I18N.setLang(v)} options=${[{ value: 'ur', label: 'اردو' }, { value: 'en', label: 'English' }]} /></${Field}>
      <${Field} label=${t('Theme')}><${Seg} value=${s.settings.theme} onChange=${(v) => { Store.setSettings('theme', v); App.applyTheme(); }} options=${[{ value: 'light', label: t('Light'), icon: 'sun' }, { value: 'dark', label: t('Dark'), icon: 'moon' }]} /></${Field}>
      <${Field} label=${t('Go-live date')} hint=${t('Opening stock and opening balances are as of this date')}><input class="inp num" disabled value=${dmy(s.settings.goLive)} /></${Field}>
    </${Card}>`;
  }
  function Security() {
    const [f, setF] = useState({ old: '', a: '', b: '' });
    const save = () => {
      if (f.old !== Store.s.settings.password) return toast(t('Current password is wrong'), 'error');
      if (f.a.length < 4) return toast(t('New password must be at least 4 characters'), 'error');
      if (f.a !== f.b) return toast(t('The two new passwords do not match'), 'error');
      Store.setSettings('password', f.a); setF({ old: '', a: '', b: '' }); toast(t('Password changed'), 'success');
    };
    return html`<${Card} title=${t('Owner password')} actions=${html`<${Btn} kind="primary" icon="check2" onClick=${save}>${t('Save')}</${Btn}>`}>
      <div class="grid-2"><${Field} label=${t('Current password')} span="2"><input class="inp" type="password" value=${f.old} onInput=${(e) => setF({ ...f, old: e.target.value })} /></${Field}>
        <${Field} label=${t('New password')}><input class="inp" type="password" value=${f.a} onInput=${(e) => setF({ ...f, a: e.target.value })} /></${Field}>
        <${Field} label=${t('Repeat new password')}><input class="inp" type="password" value=${f.b} onInput=${(e) => setF({ ...f, b: e.target.value })} /></${Field}></div></${Card}>`;
  }
  function Audit() {
    const s = useStore();
    return html`<${Card} title=${t('Activity log')} pad=${false}>
      <${Table} limit=${50} rows=${s.audit} empty=${t('No activity yet')} columns=${[
        { label: t('Date / time'), render: (a) => html`<span class="num">${a.at}</span>` }, { label: t('Action'), render: (a) => html`<span class="badge badge-brand">${t(a.action)}</span>` },
        { label: t('Record'), render: (a) => html`<span class="num">${a.ref}</span>` }, { label: t('Details'), render: (a) => a.detail }]} />
      <div class="pad"><${Btn} kind="danger-ghost" icon="arrow-counterclockwise" onClick=${async () => { if (await confirmBox(t('Reset demo data?'), t('All demo entries are replaced with fresh dummy data.'), { danger: true, okLabel: t('Reset') })) { Store.resetDemo(); toast(t('Demo data reset'), 'success'); } }}>${t('Reset demo data')}</${Btn}></div>
    </${Card}>`;
  }

  Object.assign(Screens, { settings: (p) => html`<${Settings} ...${p} />` });
})();
