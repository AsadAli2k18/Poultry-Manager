// Publishes a new version to GitHub Releases. Installed apps pick it up automatically.
// Usage: npm run release -- 1.1.1 "What changed (one line, optional)"
//   1. checks that the work is committed and pushed
//   2. sets the version in package.json, commits and pushes it
//   3. builds the installer and uploads it with latest.yml (what the apps read) to a GitHub Release
// Needs the GitHub CLI signed in (gh auth login). Commits and pushes on their own never reach the shop.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts });
// npx is a .cmd file on Windows: it needs the shell (its arguments here have no spaces)
const npx = (args, opts) => run(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { shell: process.platform === 'win32', ...opts });
const [version, notes] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '')) { console.error('usage: npm run release -- <x.y.z> "notes"'); process.exit(2); }

const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
if (!newer(version, pkg.version)) { console.error(`Version ${version} must be higher than the current ${pkg.version}.`); process.exit(2); }
if (run('git', ['status', '--porcelain'], { quiet: true }).trim()) { console.error('Commit your changes first.'); process.exit(1); }
if (!fs.existsSync(path.join(root, 'desktop', 'vendor', 'secugen', 'x64', 'sgfplib.dll'))) { console.error('SecuGen runtime missing: npm run secugen -- "<SDK zip>"'); process.exit(1); }

const token = run('gh', ['auth', 'token'], { quiet: true }).trim();
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
run('git', ['commit', '-am', `Release ${version}`]);
run('git', ['push', 'origin', 'HEAD']);
const publish = () => npx(['electron-builder', '--win', '--publish', 'always'], { env: { ...process.env, GH_TOKEN: token } });
try { publish(); } catch (e) { console.log('Upload failed (often a slow connection). Trying once more...'); publish(); } // large uploads sometimes drop
const repo = pkg.build.publish[0];
if (notes) run('gh', ['release', 'edit', 'v' + version, '--repo', `${repo.owner}/${repo.repo}`, '--notes', notes + '\n\nDeveloped by AASolutions · 0305-8592435']);
console.log(`\nReleased ${version}: https://github.com/${repo.owner}/${repo.repo}/releases/tag/v${version}`);
