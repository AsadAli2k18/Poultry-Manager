// End-to-end check of the desktop app: starts the real app with a throwaway data folder,
// runs a script inside the window, prints the result and exits.
// Usage: npx electron tools/selftest.js <script.js> <dataDir>
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const [script, dataDir] = process.argv.slice(-2);
if (!script || !dataDir || !fs.existsSync(script)) { console.error('usage: electron tools/selftest.js <script.js> <dataDir>'); process.exit(2); }
process.env.PM_DATA_DIR = path.resolve(dataDir);
process.env.PM_NO_MAXIMIZE = '1';

let mainSeen = false;
app.on('browser-window-created', (_e, win) => {
  if (mainSeen) return; mainSeen = true; // only the app window, not the hidden print windows
  let runs = 0;
  win.webContents.on('did-finish-load', async () => {
    if (runs++) return; // a restore reloads the window; the next run checks the result
    try {
      const code = fs.readFileSync(script, 'utf8');
      const r = await win.webContents.executeJavaScript('(async () => {' + code + '\n})()', true);
      console.log('SELFTEST ' + JSON.stringify(r, null, 1));
    } catch (e) {
      console.log('SELFTEST_ERR ' + (e && e.stack ? e.stack : e));
    }
    setTimeout(() => app.exit(0), 1500);
  });
});
require('../desktop/main.js');
