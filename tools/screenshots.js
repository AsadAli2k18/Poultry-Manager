// Takes the README screenshots (docs/screenshots/*.png) from the real app, using the made-up sample shop
// and the simulated fingerprint scanner, on a throwaway data folder.
// Usage: npm run screenshots
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow } = require('electron');

process.env.PM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-shots-'));
process.env.PM_NO_MAXIMIZE = '1';
process.env.PM_BIO_SIM = '1';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// each step runs inside the app window, then the window is captured
const PRE = `const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (root, txt) => [...root.querySelectorAll('button')].find((x) => x.textContent.trim() === txt);
  const main = () => document.querySelector('.main:not([hidden])');`;
const STEPS = [
  ['setup', `const pw = document.querySelector('.login input[type=password]');
    if (pw) { pw.value = '1234'; pw.dispatchEvent(new Event('input', { bubbles: true })); await wait(150); document.querySelector('form.login-card').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(400); }
    await Store.loadSample(); await wait(500);
    const c = Store.s.customers.find((x) => x.active && Store.balance('customer', x.id) > 0) || Store.s.customers[0];
    Store.saveParty('customer', { ...c, cnic: '35202-1234567-1', fatherName: 'Muhammad Aslam', gender: 'M', dob: '1985-03-14', cnicIssue: '2021-06-01', cnicExpiry: '2031-06-01' });
    Store.saveBiometric(c.id, 'R1', [btoa('SIM:demo-finger')], 82, 'secugen');
    window.__c = c.id; I18N.setLang('en'); App.nav('home'); await wait(2500);`],
  ['dashboard', `App.nav('home'); await wait(700);`],
  ['dashboard-urdu', `I18N.setLang('ur'); await wait(900);`],
  ['new-sale', `I18N.setLang('en'); App.nav('sales-new', { partyId: window.__c }); await wait(700);`],
  ['receipt-preview', `const inv = Store.s.invoices.filter((d) => Store.active(d) && d.lines.length > 1).slice(-1)[0] || Store.s.invoices.slice(-1)[0];
    App.nav('sales-view', { id: inv.id }); await wait(500); btn(main(), 'Print').click(); await wait(400);
    const seg = [...document.querySelectorAll('.modal .seg button')].find((b) => /80/.test(b.textContent)); if (seg) seg.click(); await wait(1500);`],
  ['customer-ledger', `document.querySelector('.ovl') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait(300);
    App.nav('customer', { id: window.__c }); await wait(800);`],
  ['id-card-fingerprint', `main().querySelector('.idpanel').scrollIntoView({ block: 'center' }); await wait(400);`],
  ['fingerprint-found', `App.nav('home'); await wait(500); await PM.bio.sim('put', 'demo-finger'); await wait(2500);`],
  ['reports', `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait(300); App.nav('reports'); await wait(900);`],
  ['stock', `App.nav('stock'); await wait(700);`],
  ['print-designer', `App.nav('settings', { tab: 'print' }); await wait(600);
    const seg = [...main().querySelectorAll('.seg button')].find((b) => /80 mm|80mm|Thermal/.test(b.textContent)); if (seg) seg.click(); await wait(1500);`],
];

app.on('browser-window-created', (_e, win) => {
  if (app._shots) return; app._shots = true;
  win.setContentSize(1440, 900);
  win.webContents.once('did-finish-load', async () => {
    try {
      for (const [name, js] of STEPS) {
        await win.webContents.executeJavaScript('(async () => {' + PRE + js + '\n})()', true);
        if (name === 'setup') continue;
        await wait(300);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
        console.log('shot ' + name);
      }
    } catch (e) { console.error('SHOTS_ERR', e); }
    setTimeout(() => app.exit(0), 500);
  });
});
require('../desktop/main.js');
