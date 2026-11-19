// Copies the SecuGen runtime (64-bit DLLs) from the FDx SDK Pro for Windows into desktop/vendor/secugen/x64,
// where the app and the installer pick it up. The DLLs are SecuGen's, so they are not kept in git.
// Usage: npm run secugen -- "<path to FDx_SDK_Pro_Windows_...zip or its unpacked folder>"
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: npm run secugen -- "<FDx SDK Pro zip or folder>"'); process.exit(2); }
if (/\.zip$/i.test(src)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secugen-'));
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath $env:SRC -DestinationPath $env:DST'], { env: { ...process.env, SRC: src, DST: tmp }, stdio: 'inherit' });
  src = tmp;
}
// find the folder holding the 64-bit sgfplib.dll
function find(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(p); if (r) return r; } else if (e.name.toLowerCase() === 'sgfplib.dll' && /[\\/]bin[\\/]x64$/i.test(dir)) return dir;
  }
  return null;
}
const bin = find(src);
if (!bin) { console.error('No bin\\x64\\sgfplib.dll found in ' + src); process.exit(1); }
const dest = path.join(__dirname, '..', 'desktop', 'vendor', 'secugen', 'x64');
fs.mkdirSync(dest, { recursive: true });
const files = fs.readdirSync(bin).filter((f) => /\.dll$/i.test(f));
files.forEach((f) => fs.copyFileSync(path.join(bin, f), path.join(dest, f)));
console.log('SecuGen runtime copied to desktop/vendor/secugen/x64: ' + files.join(', '));
