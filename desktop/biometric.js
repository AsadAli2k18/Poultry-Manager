// Fingerprint scanner (optional). Everything in the app works without it; a scan only finds or fills in a customer.
//
// Scanner (USB) ── SecuGen sgfplib.dll ── helper process (PowerShell + C#, JSON lines on stdin/stdout)
//                                              │
// this file (main process): one request at a time, "listening" loop, matching against enrolled customers ── IPC ── screens
//
// The vendor library runs in its own process: if the driver hangs or crashes, the app keeps running and shows "No scanner".
// Only templates (numbers describing the ridges) are stored, never fingerprint pictures.
// PM_BIO_SIM=1 swaps in a simulated scanner for the checks (fingers are "placed" with bio:sim).
const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const os = require('os');

const LISTEN_MS = 1500; // one listening attempt; a request waits at most this long
const OPEN_RETRY_MS = 5000; // scanner unplugged: try again this often
const MATCH_HOLD_MS = 3000; // after a match, ignore the same finger still lying on the glass

const HELPER = String.raw`$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class PmSg {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool SetDllDirectory(string p);
  [StructLayout(LayoutKind.Sequential, Pack = 1)] struct DevInfo {
    public uint DeviceID; [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)] public byte[] SN;
    public uint ComPort, ComSpeed, ImageWidth, ImageHeight, Contrast, Brightness, Gain, ImageDPI, FWVersion; }
  [StructLayout(LayoutKind.Sequential)] struct FingerInfo { public ushort FingerNumber, ViewNumber, ImpressionType, ImageQuality; }
  [DllImport("sgfplib.dll")] static extern uint SGFPM_Create(out IntPtr h);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_Init(IntPtr h, uint dev);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_OpenDevice(IntPtr h, uint id);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_CloseDevice(IntPtr h);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_Terminate(IntPtr h);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetDeviceInfo(IntPtr h, ref DevInfo i);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetImageEx(IntPtr h, byte[] buf, uint time, IntPtr wnd, uint quality);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetImageQuality(IntPtr h, uint w, uint hh, byte[] img, out uint q);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetMaxTemplateSize(IntPtr h, out uint size);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_CreateTemplate(IntPtr h, ref FingerInfo fi, byte[] img, byte[] tpl);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetTemplateSize(IntPtr h, byte[] tpl, out uint size);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_MatchTemplate(IntPtr h, byte[] a, byte[] b, uint level, out int matched);
  [DllImport("sgfplib.dll")] static extern uint SGFPM_GetMatchingScore(IntPtr h, byte[] a, byte[] b, out uint score);
  static IntPtr h = IntPtr.Zero; static bool open = false; static uint W, H, maxT;
  static string Err(string step, uint code) { return "{\"ok\":false,\"step\":\"" + step + "\",\"code\":" + code + "}"; }
  static uint Init() { if (h != IntPtr.Zero) return 0; uint r = SGFPM_Create(out h); if (r != 0) { h = IntPtr.Zero; return r; } r = SGFPM_Init(h, 0xFF); if (r != 0) { SGFPM_Terminate(h); h = IntPtr.Zero; } return r; }
  public static string Open() {
    if (open) { SGFPM_CloseDevice(h); open = false; }
    if (h != IntPtr.Zero) { SGFPM_Terminate(h); h = IntPtr.Zero; } // a fresh start finds a re-plugged scanner
    uint r = Init(); if (r != 0) return Err("init", r);
    r = SGFPM_OpenDevice(h, 0x3BD); if (r != 0) r = SGFPM_OpenDevice(h, 0);
    if (r != 0) return Err("open", r);
    open = true;
    DevInfo i = new DevInfo(); i.SN = new byte[16];
    r = SGFPM_GetDeviceInfo(h, ref i); if (r != 0) return Err("info", r);
    W = i.ImageWidth; H = i.ImageHeight; SGFPM_GetMaxTemplateSize(h, out maxT);
    string sn = Encoding.ASCII.GetString(i.SN).Trim('\0', ' ');
    return "{\"ok\":true,\"sn\":\"" + sn + "\",\"width\":" + W + ",\"height\":" + H + ",\"dpi\":" + i.ImageDPI + ",\"fw\":" + i.FWVersion + "}";
  }
  public static string Capture(uint ms, uint minQ) {
    if (!open) return Err("closed", 0);
    byte[] img = new byte[W * H];
    uint r = SGFPM_GetImageEx(h, img, ms, IntPtr.Zero, minQ);
    if (r == 54) return "{\"ok\":false,\"timeout\":true}";
    if (r != 0) return Err("capture", r);
    uint q; SGFPM_GetImageQuality(h, W, H, img, out q);
    FingerInfo fi = new FingerInfo(); fi.ImageQuality = (ushort)q;
    byte[] t = new byte[maxT];
    r = SGFPM_CreateTemplate(h, ref fi, img, t); if (r != 0) return Err("template", r);
    uint sz; SGFPM_GetTemplateSize(h, t, out sz); Array.Resize(ref t, (int)sz);
    return "{\"ok\":true,\"quality\":" + q + ",\"template\":\"" + Convert.ToBase64String(t) + "\"}";
  }
  // best match of one finger among many templates (keys tell whose they are)
  public static string Identify(string probe, string[] keys, string[] temps, uint level) {
    uint r = Init(); if (r != 0) return Err("init", r);
    byte[] p = Convert.FromBase64String(probe); int best = -1; uint bestScore = 0;
    for (int k = 0; k < temps.Length; k++) {
      byte[] t = Convert.FromBase64String(temps[k]); int m; uint s;
      if (SGFPM_MatchTemplate(h, p, t, level, out m) != 0 || m == 0) continue;
      SGFPM_GetMatchingScore(h, p, t, out s);
      if (best < 0 || s > bestScore) { best = k; bestScore = s; }
    }
    if (best < 0) return "{\"ok\":true,\"key\":null}";
    return "{\"ok\":true,\"key\":\"" + keys[best] + "\",\"score\":" + bestScore + "}";
  }
}
'@
[PmSg]::SetDllDirectory($env:PM_SG_DIR) | Out-Null
while ($true) {
  $line = [Console]::In.ReadLine(); if ($line -eq $null) { break }
  $c = $line | ConvertFrom-Json; $r = ''
  try {
    switch ($c.cmd) {
      'open' { $r = [PmSg]::Open() }
      'capture' { $r = [PmSg]::Capture([uint32]$c.ms, [uint32]$c.minQuality) }
      'identify' { $r = [PmSg]::Identify([string]$c.probe, [string[]]@($c.keys), [string[]]@($c.temps), [uint32]$c.level) }
      default { $r = '{"ok":false,"step":"unknown"}' }
    }
  } catch { $r = '{"ok":false,"step":"exception","message":' + (ConvertTo-Json ([string]$_.Exception.Message)) + '}' }
  [Console]::Out.WriteLine('@@' + $c.id + ' ' + $r); [Console]::Out.Flush()
}`;

// SecuGen library folder: PM_SECUGEN_DIR, or desktop/vendor/secugen/x64 (copied there by "npm run secugen"; unpacked from the installer's archive)
function sdkDir() {
  const cands = [process.env.PM_SECUGEN_DIR, path.join(__dirname, 'vendor', 'secugen', 'x64').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)];
  return cands.find((d) => d && fs.existsSync(path.join(d, 'sgfplib.dll'))) || null;
}

/* ---------- SecuGen helper process ---------- */
class SecuGen {
  constructor(dir) { this.dir = dir; this.proc = null; this.waiting = new Map(); this.n = 0; this.buf = ''; }
  start() {
    if (this.proc) return;
    const file = path.join(os.tmpdir(), 'poultry-bio-helper.ps1');
    fs.writeFileSync(file, HELPER, 'utf8');
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    this.proc = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { env: { ...process.env, PM_SG_DIR: this.dir }, windowsHide: true });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => {
      this.buf += d; let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        const m = /^@@(\d+) (.*)$/.exec(line); if (!m) continue; // the vendor library prints its own notes; ignore them
        const w = this.waiting.get(+m[1]); if (!w) continue;
        this.waiting.delete(+m[1]); clearTimeout(w.timer);
        try { w.resolve(JSON.parse(m[2])); } catch (e) { w.resolve({ ok: false, step: 'reply' }); }
      }
    });
    this.proc.stderr.on('data', () => {});
    this.proc.on('exit', () => {
      this.proc = null;
      for (const w of this.waiting.values()) { clearTimeout(w.timer); w.resolve({ ok: false, step: 'helper-exit' }); }
      this.waiting.clear();
    });
  }
  request(cmd, args = {}, timeout = 20000) {
    this.start();
    const id = ++this.n;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.waiting.delete(id); resolve({ ok: false, step: 'no-reply' }); this.stop(); }, timeout); // hung driver: restart the helper
      this.waiting.set(id, { resolve, timer });
      this.proc.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
    });
  }
  stop() { if (this.proc) { try { this.proc.kill(); } catch (e) { /* ignore */ } this.proc = null; } }
}

/* ---------- simulated scanner (checks and demos) ---------- */
class Simulator {
  constructor() { this.queue = []; this.plugged = true; }
  put(name) { this.queue.push(name); }
  async request(cmd, args = {}) {
    if (cmd === 'open') return this.plugged ? { ok: true, sn: 'SIMULATOR', width: 300, height: 400, dpi: 500 } : { ok: false, step: 'open', code: 55 };
    if (cmd === 'capture') {
      if (!this.plugged) return { ok: false, step: 'capture', code: 55 };
      const end = Date.now() + (args.ms || 0);
      while (!this.queue.length && Date.now() < end) await new Promise((r) => setTimeout(r, 40));
      if (!this.queue.length) return { ok: false, timeout: true };
      const f = this.queue.shift();
      return { ok: true, quality: /low/.test(f) ? 20 : 80, template: Buffer.from('SIM:' + f.replace(/-low$/, '')).toString('base64') };
    }
    if (cmd === 'identify') {
      const i = (args.temps || []).findIndex((t) => t === args.probe);
      return i < 0 ? { ok: true, key: null } : { ok: true, key: args.keys[i], score: 199 };
    }
    return { ok: false, step: 'unknown' };
  }
  stop() {}
}

/* ---------- the scanner as the app sees it ---------- */
class Biometrics extends EventEmitter {
  constructor({ gallery }) {
    super();
    this.gallery = gallery; // () => [{ partyId, templates: [base64] }] from the database
    this.cfg = { enabled: false, listen: true, level: 5 };
    this.state = 'off'; this.device = null; this.message = '';
    this.queue = Promise.resolve(); this.paused = 0; this.loopOn = false; this.lastMatch = null;
    const sim = process.env.PM_BIO_SIM === '1';
    this.dir = sim ? 'sim' : sdkDir();
    this.dev = sim ? new Simulator() : this.dir ? new SecuGen(this.dir) : null;
  }
  get sim() { return this.dev instanceof Simulator; }
  status() { return { state: this.state, device: this.device, message: this.message, sim: this.sim, enabled: this.cfg.enabled, listen: this.cfg.listen }; }
  setState(state, extra = {}) {
    const before = JSON.stringify(this.status());
    this.state = state; if ('device' in extra) this.device = extra.device; this.message = extra.message || '';
    if (JSON.stringify(this.status()) !== before) this.emit('event', { type: 'status', status: this.status() });
  }
  // one request at a time to the scanner
  run(cmd, args, timeout) { const p = this.queue.then(() => this.dev.request(cmd, args, timeout)); this.queue = p.catch(() => {}); return p; }

  configure(cfg) {
    this.cfg = { ...this.cfg, ...(cfg || {}) };
    if (!this.cfg.enabled) { this.loopOn = false; if (this.dev) this.dev.stop(); this.setState('off', { device: null }); return this.status(); }
    if (!this.dev) { this.setState('nosdk', { device: null, message: 'SecuGen library not found' }); return this.status(); }
    if (!this.loopOn) { this.loopOn = true; this.setState('starting'); this.loop(); }
    return this.status();
  }
  async loop() {
    let nextOpen = 0;
    while (this.loopOn) {
      if (this.state !== 'ready') {
        if (Date.now() < nextOpen) { await wait(250); continue; }
        const r = await this.run('open', {}, 30000); // first start compiles the helper: a few seconds
        if (!this.loopOn) break;
        if (r.ok) this.setState('ready', { device: { sn: r.sn, width: r.width, height: r.height, dpi: r.dpi } });
        else { this.setState('nodevice', { device: null, message: 'step ' + r.step + (r.code != null ? ' (' + r.code + ')' : '') }); nextOpen = Date.now() + OPEN_RETRY_MS; }
        continue;
      }
      if (!this.cfg.listen || this.paused) { await wait(200); continue; }
      const r = await this.run('capture', { ms: LISTEN_MS, minQuality: 40 }, LISTEN_MS + 15000);
      if (!this.loopOn) break;
      if (r.ok && this.paused) this.handover = { r, at: Date.now() }; // a screen started waiting meanwhile: the finger is for it
      else if (r.ok) await this.recognise(r);
      else if (!r.timeout) { this.setState('nodevice', { device: null, message: 'step ' + r.step }); nextOpen = Date.now() + 1000; }
      else if (this.paused) await wait(50);
    }
  }
  async recognise(cap) {
    const hit = await this.identify(cap.template);
    const key = hit ? hit.partyId : '-';
    if (this.lastMatch && this.lastMatch.key === key && Date.now() - this.lastMatch.at < MATCH_HOLD_MS) { this.lastMatch.at = Date.now(); return; }
    this.lastMatch = { key, at: Date.now() };
    this.emit('event', hit ? { type: 'match', partyId: hit.partyId, score: hit.score, finger: hit.finger } : { type: 'nomatch', quality: cap.quality });
  }
  async identify(template, exceptParty) {
    const keys = []; const temps = [];
    for (const g of this.gallery()) if (g.partyId !== exceptParty) (g.templates || []).forEach((t, i) => { keys.push(g.partyId + '|' + (g.finger || '') + '|' + i); temps.push(t); });
    if (!temps.length || !this.dev) return null;
    const r = await this.run('identify', { probe: template, keys, temps, level: this.cfg.level || 5 }, 20000);
    if (!r.ok || !r.key) return null;
    const [partyId, finger] = r.key.split('|');
    return { partyId, finger, score: r.score };
  }
  // do two touches belong to the same finger? (enrolment checks each touch against the first)
  async match(a, b) {
    if (!this.dev) return false;
    const r = await this.run('identify', { probe: a, keys: ['x'], temps: [b], level: this.cfg.level || 5 }, 20000);
    return !!(r.ok && r.key);
  }
  // a capture asked for by a screen (enrolment, "Scan finger"): listening steps aside meanwhile
  async capture({ ms = 10000, minQuality = 50 } = {}) {
    if (!this.dev || !this.cfg.enabled) return { ok: false, step: 'off' };
    if (this.state !== 'ready') return { ok: false, step: 'nodevice' };
    this.paused++;
    try {
      await this.queue; // the listening attempt in progress may have caught the finger
      const h = this.handover; this.handover = null;
      if (h && Date.now() - h.at < 3000 && h.r.quality >= minQuality) return h.r;
      return await this.run('capture', { ms, minQuality }, ms + 15000);
    } finally { this.paused--; }
  }
  pause(on) { this.paused = Math.max(0, this.paused + (on ? 1 : -1)); }
  simPut(name) { if (this.sim) this.dev.put(name); }
  simPlug(on) { if (this.sim) { this.dev.plugged = !!on; if (!on) this.setState('nodevice', { device: null, message: 'unplugged' }); } }
  stop() { this.loopOn = false; if (this.dev) this.dev.stop(); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { Biometrics, sdkDir };
