// Run 6: ID card (CNIC) details and fingerprints, with the simulated scanner (PM_BIO_SIM=1, set by the runner).
// Fingers are "placed" with PM.bio.sim('put', name); the same name is the same finger.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { checks: {} };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
const typeIn = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const activeMain = () => document.querySelector('.main:not([hidden])');
const btn = (root, txt) => [...root.querySelectorAll('button')].find((x) => x.textContent.trim() === txt);
const until = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (f()) return true; await wait(100); } return false; };
const place = (f) => PM.bio.sim('put', f);
I18N.setLang('en');
try {

const pw = document.querySelector('.login input[type=password]');
if (pw) { typeIn(pw, '1234'); await wait(150); document.querySelector('.login form, form.login-card').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(300); }

// ---- CNIC
ok('CNIC formatting', Util.fmtCnic('3520212345671') === '35202-1234567-1' && Util.cnicMask('3520212345671') === '35202-•••••67-1' && Util.cnicGender('3520212345671') === 'M' && Util.cnicGender('3520212345672') === 'F');
const ali = Store.saveParty('customer', { name_en: 'Ali Raza', name_ur: 'علی رضا', phone: '0300-1111111', opening: 2000, cnic: '35202-1234567-1', fatherName: 'Raza Khan', gender: 'M', cnicExpiry: '2020-01-01' });
const sara = Store.saveParty('customer', { name_en: 'Sara Bibi', name_ur: 'سارہ بی بی', phone: '0300-2222222', opening: 0 });
ok('CNIC stored as 13 digits', ali.cnic === '3520212345671' && PM.load().state.customers.find((c) => c.id === ali.id).cnic === '3520212345671');
ok('customer without CNIC is fine', !sara.cnic && Store.party('customer', sara.id));
ok('duplicate CNIC found', Store.cnicOwner('35202-1234567-1', sara.id).p.id === ali.id && !Store.cnicOwner('35202-1234567-1', ali.id));
ok('short CNIC refused', (await Bio.checkIdCard('customer', { cnic: '35202-12345' })) === false);
App.nav('customers'); await wait(300);
const sIn = activeMain().querySelector('.filters input'); typeIn(sIn, '35202-1234567'); await wait(250);
ok('customer list finds by CNIC', /Ali Raza/.test(activeMain().innerText) && !/Sara Bibi/.test(activeMain().innerText));
App.nav('customer', { id: ali.id }); await wait(300);
ok('profile shows masked CNIC and expired badge', /35202-•••••67-1/.test(activeMain().innerText) && /Expired/.test(activeMain().innerText) && /Raza Khan/.test(activeMain().innerText));

// ---- scanner
ok('scanner ready (simulator)', await until(() => Bio.status.state === 'ready'), Bio.status);
ok('top bar shows scanner ready', /Scanner ready/.test(document.querySelector('.topbar').innerText));

// ---- enrolment on the customer page: same finger three times
btn(activeMain(), 'Enroll fingerprint').click(); await wait(300);
const modal = () => document.querySelector('.modal');
ok('start needs consent', btn(modal(), 'Start').disabled);
modal().querySelector('input[type=checkbox]').click(); await wait(100);
btn(modal(), 'Start').click(); await wait(300);
for (let i = 0; i < 3; i++) { place('ali-thumb'); await wait(1300); }
ok('enrolled after three touches', await until(() => /Fingerprint enrolled/.test(modal() ? modal().innerText : '')) && Store.fingersOf(ali.id).length === 1 && Store.fingersOf(ali.id)[0].templates.length === 3, modal() && modal().innerText);
btn(modal(), 'Done').click(); await wait(200);
ok('fingerprint saved on disk, templates only', (PM.load().state.biometrics || []).some((b) => b.partyId === ali.id && b.active && b.finger === 'R1' && !('image' in b)));
ok('profile lists the finger', /Right thumb/.test(activeMain().innerText));
ok('activity log has the enrolment', Store.s.audit.some((a) => a.action === 'enroll' && a.ref === ali.code));

// ---- a different finger at enrolment does not mix
App.nav('customer', { id: sara.id }); await wait(300);
btn(activeMain(), 'Enroll fingerprint').click(); await wait(300);
modal().querySelector('input[type=checkbox]').click(); await wait(100);
btn(modal(), 'Start').click(); await wait(300);
place('ali-thumb'); await wait(800);
ok('finger of another customer refused', /already enrolled for Ali Raza/.test(modal().innerText), modal().innerText);
place('sara-thumb'); await wait(100); btn(modal(), 'Try again').click(); await wait(900);
place('sara-index'); await wait(1300);
ok('touch from a different finger refused', /did not match the first one/.test(modal().innerText), modal().innerText);
btn(modal(), 'Cancel').click(); await wait(200);
ok('nothing saved after a cancelled enrolment', Store.fingersOf(sara.id).length === 0);

// ---- listening: a finger anywhere finds the customer
App.nav('home'); await wait(300);
place('ali-thumb');
ok('placing the finger shows the customer', await until(() => /Customer found/.test(document.body.innerText) && /Ali Raza/.test(modal() ? modal().innerText : '')));
ok('popup shows balance and buttons', /2,000/.test(modal().innerText) && btn(modal(), 'New bill') && btn(modal(), 'Recovery') && btn(modal(), 'Open ledger'));
btn(modal(), 'New bill').click(); await wait(400);
ok('New bill from the popup chooses the customer', App.tabs.find((x) => x.active).route === 'sales-new' && /Ali Raza/.test(activeMain().querySelector('.picker').innerText));
await wait(3200); // same finger is ignored for a moment after a match
place('nobody');
ok('unknown finger: not recognised message', await until(() => /not recognised/.test(document.querySelector('.toasts').innerText)));

// ---- a bill form with no customer: the finger fills it in
App.openTab('sales-new'); await wait(400);
ok('new bill starts without a customer', /Choose customer/.test(activeMain().querySelector('.picker').innerText));
await wait(3200); place('ali-thumb');
ok('finger fills the customer in the open bill', await until(() => /Ali Raza/.test(activeMain().querySelector('.picker').innerText)) && !document.querySelector('.modal'));
App.openTab('recoveries-new'); await wait(400);
await wait(3200); place('ali-thumb');
ok('finger fills the customer in a recovery', await until(() => /Ali Raza/.test(activeMain().querySelector('.picker').innerText)));

// ---- works without the scanner
await PM.bio.sim('plug', false);
ok('unplugged: top bar says no scanner', await until(() => /No scanner/.test(document.querySelector('.topbar').innerText)));
const inv = Store.saveDoc('customer', { partyId: sara.id, date: Store.today(), lines: [{ itemId: Store.s.items[0].id, qty: 5, rate: 400 }], paidNow: 0 });
ok('bills still work without the scanner', inv && Store.balance('customer', sara.id) === 2000);
await PM.bio.sim('plug', true);
ok('scanner found again after plugging in', await until(() => Bio.status.state === 'ready', 9000), Bio.status);

// ---- remove the fingerprint
App.nav('customer', { id: ali.id }); await wait(300);
const rm = [...activeMain().querySelectorAll('.finger-row button')].find((b) => /Remove/.test(b.textContent)); rm.click(); await wait(300);
btn(document.querySelector('.modal, .dlg') || document.body, 'Remove').click(); await wait(300);
ok('fingerprint removed', Store.fingersOf(ali.id).length === 0 && Store.s.biometrics.some((b) => b.partyId === ali.id && !b.active));
App.nav('home'); await wait(300); await wait(3200);
place('ali-thumb');
ok('removed finger no longer recognised', await until(() => /not recognised/.test(document.querySelector('.toasts').innerText)) && !document.querySelector('.modal'));

// ---- turned off
Store.setSettings('bio', { ...Store.s.settings.bio, enabled: false }); await Bio.configure(); await wait(300);
ok('turned off: no scanner pill', !document.querySelector('.bio-pill') && Bio.status.state === 'off');

} catch (e) { out.checks['script'] = 'FAIL ' + (e.stack || e).toString().slice(0, 300); }
out.failed = Object.entries(out.checks).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
return out;
