// Run 5: tabs (several screens open, each keeps its state and Back history) and draft bills.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { checks: {} };
const ok = (name, cond, extra) => { out.checks[name] = cond ? 'ok' : 'FAIL' + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''); };
const typeIn = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const activeMain = () => document.querySelector('.main:not([hidden])');
const btnIn = (root, txt) => [...root.querySelectorAll('button')].find((x) => x.textContent.trim() === txt);
I18N.setLang('en');

const pw = document.querySelector('.login input[type=password]');
if (pw) { typeIn(pw, '1234'); await wait(150); document.querySelector('.login form, form.login-card').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(300); }
ok('tab bar shown', !!document.querySelector('.tabbar .tab'));

const chicken = Store.s.items[0];
Store.saveItem({ ...chicken, rate: 400, opening: 100 });
const cust = Store.saveParty('customer', { name_en: 'Draft Customer', name_ur: 'ڈرافٹ گاہک', phone: '0300-5', opening: 5000 });

// ---- drafts: no number, no stock or balance change
const counter = Store.s.counters.invoice; const stock0 = Store.stockOf(chicken.id);
const d = Store.saveDraft('customer', { partyId: cust.id, date: Store.today(), lines: [{ itemId: chicken.id, qty: '12.5', rate: '410' }], paidNow: '' });
ok('draft saved', Store.drafts('customer').length === 1);
ok('draft: no bill, no number', Store.s.invoices.length === 0 && Store.s.counters.invoice === counter);
ok('draft: balance and stock unchanged', Store.balance('customer', cust.id) === 5000 && Store.stockOf(chicken.id) === stock0);
ok('draft on disk', (PM.load().state.drafts || []).some((x) => x.id === d.id));

App.nav('sales'); await wait(300);
ok('drafts listed on Sale Invoices', /Drafts \(1\)/.test(activeMain().innerText) && /Draft Customer/.test(activeMain().innerText));
btnIn(activeMain(), 'Continue').click(); await wait(400);
const qtyIn = activeMain().querySelector('.lines input[type=number]');
ok('draft opens in the form', qtyIn && qtyIn.value === '12.5' && /Draft — not saved/.test(activeMain().innerText), qtyIn && qtyIn.value);
btnIn(activeMain(), 'Save').click(); await wait(500);
ok('saving a draft makes a real bill', Store.s.invoices.length === 1 && Store.total(Store.s.invoices[0]) === Math.round(12.5 * 410));
ok('draft removed after saving', Store.drafts('customer').length === 0 && !(PM.load().state.drafts || []).length);
ok('balance after bill', Store.balance('customer', cust.id) === 5000 + Math.round(12.5 * 410));

// ---- tabs
App.nav('home'); await wait(200);
const n0 = App.tabs.length;
App.openTab('sales-new'); await wait(400);
ok('new tab opened and active', App.tabs.length === n0 + 1 && App.tabs.find((x) => x.active).route === 'sales-new');
typeIn(activeMain().querySelector('.lines input[type=number]'), '7.25'); await wait(150);
const formTab = App.tabs.find((x) => x.active).id;
// switch to the first tab and back: the typed quantity is still there
document.querySelectorAll('.tabbar .tab')[0].click(); await wait(250);
ok('first tab shows its own screen', App.tabs[0].active && /Good (morning|afternoon|evening)/.test(activeMain().innerText));
[...document.querySelectorAll('.tabbar .tab')].find((el, i) => App.tabs[i].id === formTab).click(); await wait(250);
ok('half-typed bill kept when switching tabs', activeMain().querySelector('.lines input[type=number]').value === '7.25');
// Ctrl+click on a menu item opens a new tab
const before = App.tabs.length;
[...document.querySelectorAll('.sidebar .nav-item')].find((b) => /Customers/.test(b.textContent)).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
await wait(300);
ok('Ctrl+click opens a new tab', App.tabs.length === before + 1 && App.tabs.find((x) => x.active).route === 'customers');
// Back stays inside its own tab
App.nav('stock'); await wait(150); App.back(); await wait(150);
ok('Back returns within the tab', App.tabs.find((x) => x.active).route === 'customers');
App.back(); await wait(150);
ok('Back with no history goes to the dashboard', App.tabs.find((x) => x.active).route === 'home');
// close a plain tab; the form tab stays
await App.closeTab(App.tabs.find((x) => x.active).id); await wait(200);
ok('tab closed', App.tabs.length === before && App.tabs.some((x) => x.id === formTab));
ok('only the active tab is visible', document.querySelectorAll('.main:not([hidden])').length === 1);

out.failed = Object.entries(out.checks).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ': ' + v);
return out;
