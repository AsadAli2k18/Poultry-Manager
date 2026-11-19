/* ID card (CNIC) and fingerprint: both optional extras on a customer.
 * - CNIC details can be typed on the customer form (Pakistani card layout), with photos of the front and back.
 * - A fingerprint is enrolled later, from the customer's page, when a scanner is plugged in.
 * - With the scanner listening, placing an enrolled finger anywhere in the app shows that customer;
 *   in an open bill or recovery with no customer chosen yet, it fills the customer in instead.
 * Nothing depends on the scanner: every screen works the same without it. */
(function () {
  'use strict';
  const { html, useState, useEffect, useRef, useStore, Ico, Btn, Field, Card, Modal, Seg, Side, toast, confirmBox } = UI;
  const { t, tf, nm, money, dmy } = I18N;
  const DESK = !!(window.PM && PM.bio);
  const FINGERS = [
    { value: 'R1', label: 'Right thumb' }, { value: 'R2', label: 'Right index finger' },
    { value: 'L1', label: 'Left thumb' }, { value: 'L2', label: 'Left index finger' },
  ];
  const fingerName = (v) => t((FINGERS.find((f) => f.value === v) || { label: v }).label);

  /* ---------- scanner status, shared by every screen ---------- */
  let status = { state: DESK ? 'starting' : 'none' };
  const subs = new Set();
  const setStatus = (s) => { status = s; subs.forEach((f) => f()); };
  function useBio() { const [, n] = useState(0); useEffect(() => { const f = () => n((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []); return status; }
  const ready = () => status.state === 'ready';

  // customer pickers waiting for a finger (only one in the visible tab counts)
  const claims = new Set();
  const visible = (el) => el && el.isConnected && !el.closest('main[hidden]');
  function claim(ref, fn) { const c = { ref, fn }; claims.add(c); return () => claims.delete(c); }

  let foundSubs = new Set(); // the "customer found" popup host
  const showFound = (partyId) => foundSubs.forEach((f) => f(partyId));
  const go = (route, params) => { const a = App.tabs.find((x) => x.active); if (a && /-new$/.test(a.route)) App.openTab(route, params); else App.nav(route, params); };

  function onEvent(ev) {
    if (ev.type === 'status') return setStatus(ev.status);
    if (!foundSubs.size) return; // locked: the app is not open
    if (ev.type === 'match') {
      const p = Store.party('customer', ev.partyId); if (!p) return;
      for (const c of claims) if (visible(c.ref.current) && c.fn(p.id)) { toast(t('Customer found by fingerprint') + ': ' + nm(p), 'success'); return; }
      showFound(p.id);
    }
    if (ev.type === 'nomatch') toast(t('Fingerprint not recognised. Search by name, or enroll this customer.'), 'warn');
  }
  let started = false;
  function init() {
    if (!DESK || started) return; started = true;
    PM.bio.onEvent(onEvent);
    configure();
  }
  const configure = () => DESK && PM.bio.configure(Store.s.settings.bio).then(setStatus).catch(() => {});

  // one finger, on request (the fingerprint button): resolves to a customer id, or null
  async function scanOnce() {
    const r = await PM.bio.capture({ ms: 15000, minQuality: 40 });
    if (!r.ok) { toast(r.timeout ? t('No finger was placed') : t('Scanner not ready'), 'warn'); return null; }
    const hit = await PM.bio.identify(r.template);
    if (!hit) { toast(t('Fingerprint not recognised. Search by name, or enroll this customer.'), 'warn'); return null; }
    return hit.partyId;
  }

  /* ---------- top bar: scanner status ---------- */
  function Pill() {
    const s = useStore(); const st = useBio(); const [busy, setBusy] = useState(false);
    if (!DESK || !s.settings.bio.enabled) return null;
    const on = st.state === 'ready';
    const label = on ? t('Scanner ready') : st.state === 'starting' ? t('Starting scanner…') : st.state === 'nosdk' ? t('Scanner software missing') : t('No scanner');
    const click = async () => {
      if (!on) return App.nav('settings', { tab: 'bio' });
      setBusy(true); toast(t('Place a finger on the scanner'), 'info');
      try { const id = await scanOnce(); if (id) showFound(id); } finally { setBusy(false); }
    };
    return html`<button class=${'net bio-pill ' + (on ? 'on' : 'off') + (busy ? ' busy' : '')} onClick=${click}
      title=${on ? t('Place an enrolled finger to find the customer. Click to scan now.') : t('Fingerprint is optional. Everything works without it.')}><${Ico} n="fingerprint" /> ${busy ? t('Scanning…') : label}</button>`;
  }

  /* ---------- customer found ---------- */
  function FoundHost() {
    const [id, setId] = useState(null);
    useEffect(() => { const f = (x) => setId(x); foundSubs.add(f); return () => foundSubs.delete(f); }, []);
    useStore();
    if (!id) return null;
    const p = Store.party('customer', id); if (!p) return null;
    const close = () => setId(null);
    const bal = Store.balance('customer', id);
    const bills = Store.s.invoices.filter((d) => d.customerId === id && Store.active(d)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 5);
    const act = (r, prm) => { close(); go(r, prm); };
    return html`<${Modal} title=${html`<${Ico} n="fingerprint" /> ${t('Customer found')}`} onClose=${close}
      footer=${html`<${Btn} kind="ghost" onClick=${close}>${t('Close')}</${Btn}>
        <${Btn} icon="journal-text" onClick=${() => act('customer', { id })}>${t('Open ledger')}</${Btn}>
        <${Btn} icon="cash-coin" onClick=${() => act('recoveries-new', { partyId: id })}>${t('Recovery')}</${Btn}>
        <${Btn} kind="primary" icon="plus-lg" onClick=${() => act('sales-new', { partyId: id })}>${t('New bill')}</${Btn}>`}>
      <div class="found">
        <div class="found-head"><div class="found-av"><${Ico} n="person-check" /></div>
          <div><div class="found-name">${nm(p)}</div><div class="muted"><span class="num">${p.code}</span>${p.phone ? html` · <span class="num">${p.phone}</span>` : ''}${p.cnic ? html` · ${t('CNIC')} <span class="num">${Util.cnicMask(p.cnic)}</span>` : ''}</div></div>
          <div class="found-bal"><div class="muted small">${t('Current balance')}</div><b class="num">${money(bal)}</b> <${Side} v=${bal} kind="customer" /></div></div>
        ${!p.active && html`<div class="warn-box">${t('This customer is marked inactive.')}</div>`}
        <div class="muted small" style="margin-top:12px">${t('Last bills')}</div>
        ${bills.length ? html`<table class="tbl tbl-mini"><tbody>${bills.map((d) => html`<tr class="clickable" onClick=${() => act('sales-view', { id: d.id })}><td class="num">#${d.no}</td><td>${dmy(d.date)}</td><td class="small">${Util.linesText(d.lines)}</td><td class="r num">${money(Store.total(d))}</td></tr>`)}</tbody></table>`
          : html`<div class="muted">${t('No bills yet')}</div>`}
      </div></${Modal}>`;
  }

  /* ---------- customer form: ID card section ---------- */
  function IdCardFields({ f, setF }) {
    const [open, setOpen] = useState(!!(f.cnic || f.fatherName || f.cnicFront));
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const onCnic = (e) => { const v = Util.fmtCnic(e.target.value); const g = Util.cnicGender(v); setF({ ...f, cnic: v, gender: f.gender || g }); };
    const photo = (k) => (e) => { const file = e.target.files[0]; if (file) Util.readImage(file, 1400).then((d) => setF({ ...f, [k]: d })); };
    const d = Util.cnicDigits(f.cnic);
    const bad = d.length > 0 && d.length < 13;
    const g = Util.cnicGender(d);
    const exp = f.cnicExpiry && f.cnicExpiry < Store.today();
    if (!open) return html`<button type="button" class="link-btn span-2" onClick=${() => setOpen(true)}><${Ico} n="person-vcard" /> ${t('Add ID card (CNIC) details')} <span class="muted small">— ${t('optional')}</span></button>`;
    return html`<fieldset class="idcard span-2"><legend><${Ico} n="person-vcard" /> ${t('ID card (CNIC)')} <span class="muted small">— ${t('optional')}</span></legend>
      <div class="grid-2">
        <${Field} label=${t('CNIC number')} hint=${bad ? t('13 digits: 12345-1234567-1') : ''}><input class=${'inp num' + (bad ? ' inp-bad' : '')} dir="ltr" inputmode="numeric" value=${f.cnic || ''} onInput=${onCnic} placeholder="12345-1234567-1" /></${Field}>
        <${Field} label=${t('Father / husband name')}><input class="inp" value=${f.fatherName || ''} onInput=${set('fatherName')} /></${Field}>
        <${Field} label=${t('Gender')} hint=${g && f.gender && g !== f.gender ? t('The CNIC number suggests otherwise — please check') : ''}>
          <${Seg} value=${f.gender || ''} onChange=${(v) => setF({ ...f, gender: v })} options=${[{ value: 'M', label: t('Male') }, { value: 'F', label: t('Female') }]} /></${Field}>
        <${Field} label=${t('Date of birth')}><input class="inp" type="date" value=${f.dob || ''} onInput=${set('dob')} /></${Field}>
        <${Field} label=${t('Date of issue')}><input class="inp" type="date" value=${f.cnicIssue || ''} onInput=${set('cnicIssue')} /></${Field}>
        <${Field} label=${t('Date of expiry')} hint=${exp ? t('This card has expired') : ''}><input class=${'inp' + (exp ? ' inp-bad' : '')} type="date" value=${f.cnicExpiry || ''} onInput=${set('cnicExpiry')} /></${Field}>
        <${Field} label=${t('Address on card')} span="2"><input class="inp" value=${f.cnicAddress || ''} onInput=${set('cnicAddress')} /></${Field}>
        <${Field} label=${t('Card photo — front')}><div class="photo-row"><input type="file" accept="image/*" onChange=${photo('cnicFront')} />${f.cnicFront && html`<img class="thumb" src=${Store.photoSrc(f.cnicFront)} />`}</div></${Field}>
        <${Field} label=${t('Card photo — back')}><div class="photo-row"><input type="file" accept="image/*" onChange=${photo('cnicBack')} />${f.cnicBack && html`<img class="thumb" src=${Store.photoSrc(f.cnicBack)} />`}</div></${Field}>
      </div></fieldset>`;
  }
  // checks before the customer is saved: returns false to stop
  async function checkIdCard(kind, f) {
    const d = Util.cnicDigits(f.cnic);
    if (d.length && d.length !== 13) { toast(t('CNIC must have 13 digits: 12345-1234567-1'), 'error'); return false; }
    const other = d && Store.cnicOwner(d, f.id);
    if (other && !(await confirmBox(t('Same CNIC already saved'), tf('{name} ({code}) already has this CNIC. Save anyway?', { name: nm(other.p), code: other.p.code }), { okLabel: t('Save anyway') }))) return false;
    return true;
  }

  /* ---------- customer page: ID card and fingerprint ---------- */
  function IdPanel({ kind, p }) {
    const s = useStore(); const st = useBio();
    const [show, setShow] = useState(false); const [big, setBig] = useState(null); const [enroll, setEnroll] = useState(false);
    const fingers = kind === 'customer' ? Store.fingersOf(p.id) : [];
    const bioOn = DESK && kind === 'customer' && s.settings.bio.enabled;
    if (!p.cnic && !p.fatherName && !p.cnicFront && !bioOn) return null;
    const exp = p.cnicExpiry && p.cnicExpiry < Store.today();
    const soon = p.cnicExpiry && !exp && p.cnicExpiry < Store.addDays(Store.today(), 60);
    const remove = async (b) => { if (await confirmBox(t('Remove fingerprint?'), tf('The {finger} of {name} will no longer be recognised.', { finger: fingerName(b.finger), name: nm(p) }), { okLabel: t('Remove') })) { Store.removeBiometric(b.id); toast(t('Removed'), 'success'); } };
    return html`<${Card} title=${html`<${Ico} n="person-vcard" /> ${t(bioOn ? 'ID card & fingerprint' : 'ID card (CNIC)')}`}>
      <div class="idpanel">
        <div class="id-info">${p.cnic ? html`
          <div class="id-row"><span class="muted">${t('CNIC')}</span> <b class="num">${show ? Util.fmtCnic(p.cnic) : Util.cnicMask(p.cnic)}</b> <button class="link-btn" onClick=${() => setShow(!show)}>${t(show ? 'Hide' : 'Show')}</button>
            ${exp ? html`<span class="badge badge-red">${t('Expired')}</span>` : soon ? html`<span class="badge badge-yellow">${t('Expires soon')}</span>` : ''}</div>`
          : html`<div class="muted">${t('No ID card details.')} <button class="link-btn" onClick=${() => App.openPartyForm(kind, p)}>${t('Add')}</button></div>`}
          ${p.fatherName && html`<div class="id-row"><span class="muted">${t('Father / husband name')}</span> ${p.fatherName}</div>`}
          ${(p.gender || p.dob) && html`<div class="id-row">${p.gender && html`<span><span class="muted">${t('Gender')}</span> ${t(p.gender === 'F' ? 'Female' : 'Male')}</span>`} ${p.dob && html`<span><span class="muted">${t('Date of birth')}</span> <span class="num">${dmy(p.dob)}</span></span>`}</div>`}
          ${(p.cnicIssue || p.cnicExpiry) && html`<div class="id-row">${p.cnicIssue && html`<span><span class="muted">${t('Date of issue')}</span> <span class="num">${dmy(p.cnicIssue)}</span></span>`} ${p.cnicExpiry && html`<span><span class="muted">${t('Date of expiry')}</span> <span class="num">${dmy(p.cnicExpiry)}</span></span>`}</div>`}
          ${p.cnicAddress && html`<div class="id-row"><span class="muted">${t('Address on card')}</span> ${p.cnicAddress}</div>`}
          ${(p.cnicFront || p.cnicBack) && html`<div class="id-photos">${[p.cnicFront, p.cnicBack].filter(Boolean).map((ph) => html`<img class="thumb clickable" src=${Store.photoSrc(ph)} onClick=${() => setBig(ph)} />`)}</div>`}
        </div>
        ${bioOn && html`<div class="id-bio">
          <div class="muted small">${t('Fingerprint')}</div>
          ${fingers.length ? fingers.map((b) => html`<div class="finger-row"><${Ico} n="fingerprint" /> <b>${fingerName(b.finger)}</b> <span class="muted small">${dmy(b.enrolledAt.slice(0, 10))}</span>
              <button class="link-btn tx-red" onClick=${() => remove(b)}>${t('Remove')}</button></div>`)
            : html`<div class="muted">${t('Not enrolled. Optional — the customer can be served without it.')}</div>`}
          ${fingers.length < 2 && html`<${Btn} icon="fingerprint" disabled=${st.state !== 'ready'} onClick=${() => setEnroll(true)} title=${st.state !== 'ready' ? t('Connect the scanner first') : ''}>${t(fingers.length ? 'Enroll another finger' : 'Enroll fingerprint')}</${Btn}>`}
          ${st.state !== 'ready' && html`<div class="muted small">${t('Scanner not connected.')}</div>`}
        </div>`}
      </div>
      ${big && html`<${Modal} title=${t('ID card (CNIC)')} size="lg" onClose=${() => setBig(null)}><img class="id-big" src=${Store.photoSrc(big)} /></${Modal}>`}
      ${enroll && html`<${EnrollModal} p=${p} taken=${fingers.map((b) => b.finger)} onClose=${() => setEnroll(false)} />`}
    </${Card}>`;
  }

  /* ---------- enrolment: the same finger three times ---------- */
  const TOUCHES = 3;
  function EnrollModal({ p, taken, onClose }) {
    const [finger, setFinger] = useState((FINGERS.find((x) => !taken.includes(x.value)) || FINGERS[0]).value);
    const [consent, setConsent] = useState(false);
    const [phase, setPhase] = useState('idle'); // idle | touch | lift | done | error
    const [samples, setSamples] = useState([]); const [msg, setMsg] = useState('');
    const live = useRef(true);
    useEffect(() => { PM.bio.pause(true); return () => { live.current = false; PM.bio.pause(false); }; }, []);
    async function waitLift() {
      for (let i = 0; i < 20 && live.current; i++) { const r = await PM.bio.capture({ ms: 400, minQuality: 30 }); if (!r.ok) return; }
    }
    async function run(from) {
      const got = samples.slice(0, from);
      setMsg('');
      for (let i = from; i < TOUCHES; i++) {
        if (!live.current) return;
        setPhase('touch'); setSamples(got.slice());
        const r = await PM.bio.capture({ ms: 20000, minQuality: 50 });
        if (!live.current) return;
        if (!r.ok) { setPhase('error'); setMsg(r.timeout ? t('No finger detected. Place the finger flat and press gently.') : t('Scanner not ready')); return; }
        if (i === 0) {
          const dup = await PM.bio.identify(r.template, p.id);
          const other = dup && Store.party('customer', dup.partyId);
          if (other) { setPhase('error'); setMsg(tf('This finger is already enrolled for {name} ({code}).', { name: nm(other), code: other.code })); return; }
        } else if (!(await PM.bio.match(got[0].template, r.template))) {
          setPhase('error'); setMsg(t('This touch did not match the first one. Use the same finger.')); return;
        }
        got.push(r); setSamples(got.slice());
        if (i < TOUCHES - 1) { setPhase('lift'); await waitLift(); }
      }
      if (!live.current) return;
      const q = got.reduce((a, x) => a + x.quality, 0) / got.length;
      Store.saveBiometric(p.id, finger, got.map((x) => x.template), q, 'secugen');
      setPhase('done'); toast(t('Fingerprint enrolled'), 'success');
    }
    const n = samples.length;
    const busy = phase === 'touch' || phase === 'lift';
    return html`<${Modal} title=${html`<${Ico} n="fingerprint" /> ${t('Enroll fingerprint')} — ${nm(p)}`} onClose=${onClose}
      footer=${phase === 'done' ? html`<${Btn} kind="primary" onClick=${onClose}>${t('Done')}</${Btn}>` : html`<${Btn} kind="ghost" onClick=${onClose}>${t('Cancel')}</${Btn}>
        ${phase === 'error' ? html`<${Btn} kind="primary" icon="arrow-repeat" onClick=${() => run(n)}>${t('Try again')}</${Btn}>`
          : html`<${Btn} kind="primary" icon="fingerprint" disabled=${!consent || busy} onClick=${() => run(0)}>${t('Start')}</${Btn}>`}`}>
      ${phase === 'idle' && html`
        <${Field} label=${t('Which finger')}><${Seg} value=${finger} onChange=${setFinger} options=${FINGERS.filter((x) => !taken.includes(x.value)).map((x) => ({ value: x.value, label: t(x.label) }))} /></${Field}>
        <label class="check"><input type="checkbox" checked=${consent} onChange=${(e) => setConsent(e.target.checked)} /> <span>${t('The customer agrees to have their fingerprint saved in this shop, to find their account quickly.')}</span></label>
        <p class="muted small">${t('Only a fingerprint code is saved, not a picture of the finger. It can be removed any time.')}</p>`}
      ${phase !== 'idle' && html`<div class="enroll">
        <div class=${'enroll-ic ' + phase}><${Ico} n=${phase === 'done' ? 'check-circle-fill' : phase === 'error' ? 'exclamation-circle' : 'fingerprint'} /></div>
        <div class="enroll-msg">${phase === 'touch' ? tf('Place the {finger} on the scanner ({n} of {total})', { finger: fingerName(finger), n: n + 1, total: TOUCHES })
          : phase === 'lift' ? t('Lift the finger, then place it again') : phase === 'done' ? t('Fingerprint enrolled') : msg}</div>
        <div class="enroll-steps">${Array.from({ length: TOUCHES }, (_, i) => html`<span class=${i < n ? 'on' : i === n && busy ? 'now' : ''}>${i < n ? samples[i].quality : i + 1}</span>`)}</div>
        ${n > 0 && html`<div class="muted small">${t('Quality of each touch (out of 100)')}</div>`}
      </div>`}
    </${Modal}>`;
  }

  /* ---------- settings ---------- */
  function Settings() {
    const s = useStore(); const st = useBio(); const b = s.settings.bio;
    const set = (k, v) => { Store.setSettings('bio', { ...b, [k]: v }); configure(); };
    const enrolled = new Set(s.biometrics.filter((x) => x.active).map((x) => x.partyId)).size;
    const stateTxt = { ready: 'Scanner ready', starting: 'Starting scanner…', nodevice: 'No scanner connected', nosdk: 'Scanner software missing', off: 'Turned off' }[st.state] || 'No scanner connected';
    return html`<${Card} title=${html`<${Ico} n="fingerprint" /> ${t('Fingerprint scanner')}`}>
      <p class="muted">${t('Optional. Customers can be found by fingerprint once enrolled; everything works the same without a scanner.')}</p>
      <label class="check"><input type="checkbox" checked=${b.enabled} onChange=${(e) => set('enabled', e.target.checked)} /> <span>${t('Use a fingerprint scanner')}</span></label>
      ${b.enabled && html`
        <div class="bio-status"><span class=${'dot ' + (st.state === 'ready' ? 'on' : 'off')}></span> <b>${t(stateTxt)}</b>
          ${st.device && html`<span class="muted small"> · SecuGen · <span class="num">${st.device.sn}</span> · ${st.device.dpi} dpi${st.sim ? ' · ' + t('simulator') : ''}</span>`}</div>
        ${st.state === 'nosdk' && html`<p class="muted small">${t('The SecuGen library was not found with the app. Reinstall the app, or ask for help.')}</p>`}
        ${st.state === 'nodevice' && html`<p class="muted small">${t('Plug in the SecuGen scanner. It is found automatically within a few seconds.')}</p>`}
        <label class="check"><input type="checkbox" checked=${b.listen} onChange=${(e) => set('listen', e.target.checked)} /> <span>${t('Recognise a finger as soon as it is placed (otherwise use the fingerprint button)')}</span></label>
        <${Field} label=${t('How sure a match must be')} hint=${t('Normal suits most shops. Higher means fewer wrong matches, but a finger may need placing twice.')}>
          <${Seg} value=${String(b.level)} onChange=${(v) => set('level', +v)} options=${[{ value: '4', label: t('Relaxed') }, { value: '5', label: t('Normal') }, { value: '7', label: t('Strict') }]} /></${Field}>
        <div class="muted">${tf('{n} customers enrolled', { n: enrolled })}</div>`}
    </${Card}>`;
  }

  window.Bio = { init, configure, useBio, claim, ready, scanOnce, showFound, Pill, FoundHost, Settings, IdCardFields, checkIdCard, IdPanel, FINGERS, fingerName, get status() { return status; } };
})();
