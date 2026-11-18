// npm test — runs the desktop checks (PM_PDF_DIR=<folder> keeps the thermal PDFs) in order on a throwaway data folder (your real data is never touched).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-selftest-'));
const electron = require('electron'); // path to the Electron binary
let failed = 0;
const pdfDir = process.env.PM_PDF_DIR || path.join(dir, 'pdf'); fs.mkdirSync(pdfDir, { recursive: true });
for (const s of ['1-flows', '2-restart-restore', '3-after-restore', '4-thermal']) {
  const script = path.join(__dirname, 'selftest', s + '.js');
  const dataDir = s === '4-thermal' ? path.join(dir, 'thermal') : dir; // fresh shop for the thermal checks
  const out = execFileSync(electron, [path.join(__dirname, 'selftest.js'), script, dataDir], { encoding: 'utf8', timeout: 150000, env: { ...process.env, PM_PDF_DIR: pdfDir } });
  const m = /SELFTEST(_ERR)? ([\s\S]*)/.exec(out);
  if (!m || m[1]) { console.log('✗ ' + s + ': ' + (m ? m[2] : 'no result')); failed++; continue; }
  const r = JSON.parse(m[2].slice(0, m[2].lastIndexOf('}') + 1));
  const n = Object.keys(r.checks).length;
  if (r.failed.length) { failed++; console.log('✗ ' + s + ' (' + r.failed.length + ' of ' + n + ' failed)\n  ' + r.failed.join('\n  ')); } else console.log('✓ ' + s + ' (' + n + ' checks)');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); // let the app close before the next run
}
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
