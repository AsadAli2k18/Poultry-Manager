/* Automatic updates: a bar when a new version is ready, and Settings → Updates. Desktop app only. */
(function () {
  'use strict';
  const { html, useState, useEffect, Ico, Btn, Card, confirmBox } = UI;
  const { t, tf } = I18N;
  const ON = !!(window.PM && PM.update);
  let st = { state: ON ? 'idle' : 'off' }; let hidden = null; // "Later" hides the bar for that version
  const subs = new Set();
  const set = (s) => { st = s; subs.forEach((f) => f()); };
  if (ON) { PM.update.onEvent(set); PM.update.status().then(set).catch(() => {}); }
  function useUpdate() { const [, n] = useState(0); useEffect(() => { const f = () => n((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []); return st; }

  async function install() {
    const open = App.tabs.some((x) => /-new$/.test(x.route));
    if (open && !(await confirmBox(t('Restart to install the update?'), t('A bill or entry is open. Anything not saved will be lost. Use "Save as draft" to keep a bill.'), { okLabel: t('Restart now') }))) return;
    PM.update.install();
  }

  function Bar() {
    const s = useUpdate();
    if (s.state !== 'ready' || hidden === s.available) return null;
    return html`<div class="update-bar"><${Ico} n="arrow-up-circle-fill" />
      <span>${tf('Update {v} is ready. It installs when you restart the app.', { v: s.available })}</span>
      <span class="grow"></span>
      <${Btn} size="sm" kind="ghost" onClick=${() => { hidden = s.available; set({ ...st }); }}>${t('Later')}</${Btn}>
      <${Btn} size="sm" kind="primary" icon="arrow-repeat" onClick=${install}>${t('Restart to install')}</${Btn}></div>`;
  }

  function Settings() {
    const s = useUpdate(); const [busy, setBusy] = useState(false);
    const check = async () => { setBusy(true); try { set(await PM.update.check()); } finally { setBusy(false); } };
    const msg = {
      dev: t('Updates work in the installed app only.'), off: t('Updates are not available here.'), idle: t('Checks for updates shortly after the app opens.'),
      checking: t('Checking for updates…'), current: t('You have the latest version.'),
      downloading: tf('Downloading version {v}… {p}%', { v: s.available, p: s.progress || 0 }),
      ready: tf('Version {v} is ready. Restart the app to install it.', { v: s.available }),
      error: t('Could not check for updates. This is normal without internet; it tries again later.'),
    }[s.state] || '';
    return html`<${Card} title=${html`<${Ico} n="arrow-up-circle" /> ${t('Updates')}`}>
      <p class="muted">${t('The app checks GitHub for a new version when it opens and every few hours. New versions download in the background; a backup is taken before installing. Your data is always kept.')}</p>
      <div class="bio-status"><span class=${'dot ' + (s.state === 'current' || s.state === 'ready' ? 'on' : 'off')}></span>
        <span>${t('This version')}: <b class="num">${(window.Store && Store.info && Store.info.version) || s.version || ''}</b></span></div>
      <p>${msg}</p>
      ${s.state === 'error' && s.error && html`<p class="muted small" dir="ltr">${s.error}</p>`}
      <div class="row-gap">
        ${s.state === 'ready' ? html`<${Btn} kind="primary" icon="arrow-repeat" onClick=${install}>${t('Restart to install')}</${Btn}>`
          : html`<${Btn} icon="arrow-clockwise" disabled=${busy || !ON || s.state === 'dev' || s.state === 'checking' || s.state === 'downloading'} onClick=${check}>${t('Check for updates')}</${Btn}>`}
      </div></${Card}>`;
  }

  window.Updates = { Bar, Settings, useUpdate };
})();
