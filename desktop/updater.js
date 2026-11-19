// Automatic updates from GitHub Releases (installed app only).
// On start, and every 6 hours, the app asks GitHub for a newer release. Without internet it just tries again later.
// A newer version downloads in the background; a safety backup is taken; the screen then offers "Restart to install".
// If the user picks "Later", it installs the next time the app is closed.
// Publishing: npm run release (see tools/release.js). Plain commits and pushes never reach the shop.
const { app } = require('electron');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 15 * 1000;

function setupUpdates({ send, backup }) {
  let state = { state: 'idle', version: app.getVersion(), available: null, progress: 0, error: '', checkedAt: null };
  const set = (patch) => { state = { ...state, ...patch }; send(state); };
  const testFeed = process.env.PM_UPDATE_TEST; // checks only: "x.y.z" pretends to be that version, against the real GitHub feed
  if (!app.isPackaged && !testFeed) {
    state.state = 'dev';
    return { status: () => state, check: async () => state, install: () => {} };
  }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { state.state = 'off'; state.error = e.message; return { status: () => state, check: async () => state, install: () => {} }; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = !testFeed; // "Later": installs when the app is closed (never in a test run)
  autoUpdater.logger = null;
  if (testFeed) {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.setFeedURL({ provider: 'github', owner: 'AsadAli2k18', repo: 'Poultry-Manager' });
    const semver = require(require.resolve('semver', { paths: [require.resolve('electron-updater')] })); // the updater's own copy
    autoUpdater.currentVersion = new semver.SemVer(testFeed);
    state.version = testFeed;
  }

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: '' }));
  autoUpdater.on('update-not-available', () => set({ state: 'current', checkedAt: new Date().toISOString() }));
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', available: info.version, progress: 0, checkedAt: new Date().toISOString() }));
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', progress: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', async (info) => {
    try { await backup('Before update to ' + info.version); } catch (e) { /* the update still waits for the user */ }
    set({ state: 'ready', available: info.version, progress: 100 });
  });
  autoUpdater.on('error', (err) => set({ state: state.state === 'ready' ? 'ready' : 'error', error: String((err && err.message) || err).split('\n')[0].slice(0, 200) }));

  const check = async () => {
    if (state.state === 'downloading' || state.state === 'ready') return state;
    try { await autoUpdater.checkForUpdates(); } catch (e) { set({ state: 'error', error: String(e.message || e).split('\n')[0].slice(0, 200) }); }
    return state;
  };
  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_EVERY_MS).unref();
  return {
    status: () => state,
    check,
    install: () => { if (state.state === 'ready') setImmediate(() => autoUpdater.quitAndInstall(true, true)); }, // silent install, then reopen
  };
}

module.exports = { setupUpdates };
