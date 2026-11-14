// Lists every UI string that goes through t()/tf() (plus labels in config arrays) and reports the ones
// missing from app/js/i18n-ur.js. Run: node tools/i18n-keys.js
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'app', 'js');
const files = ['ui.js', 'util.js', 'print.js', 'screens-docs.js', 'screens-parties.js', 'screens-money.js', 'screens-stock.js', 'screens-reports.js', 'screens-settings.js', 'app.js'];
const set = new Set();
const add = (x) => x && /[A-Za-z]/.test(x) && set.add(x.replace(/\\'/g, "'"));
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of s.matchAll(/\b(?:t|tf|tr)\(\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
  for (const m of s.matchAll(/\b(?:t|tf|tr)\(\s*"([^"]*)"/g)) add(m[1]);
  for (const m of s.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"([^"]*)"/g)) add(q[1] || q[2]);
  for (const m of s.matchAll(/\b(?:label|l|one|title|newLabel|partyLabel|sec|newDoc|newPay|side|k)\s*:\s*'([A-Z][^']*)'/g)) add(m[1]);
  for (const m of s.matchAll(/\[\s*'(?:show\w+|classic|modern|minimal)'\s*,\s*'([^']+)'(?:\s*,\s*'([^']+)')?/g)) { add(m[1]); add(m[2]); }
  for (const m of s.matchAll(/REASONS = \[([^\]]*)\]/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) add(q[1]);
  for (const m of s.matchAll(/map\(\(?\[?[a-z, ]*\]?\)? => [^;]*?\{\s*paid: '([^']*)', partial: '([^']*)', unpaid: '([^']*)', cancelled: '([^']*)', farm: '([^']*)'/g)) for (let i = 1; i < 6; i++) add(m[i]);
}
['kg', 'piece', 'dozen', 'create', 'update', 'cancel', 'correct', 'login', 'backup', 'restore', 'Weight loss / mortality', 'Paid', 'Partially paid', 'Unpaid', 'Cancelled', 'Own farm', 'Active', 'Inactive',
 'Debit', 'Credit', 'To receive / To pay', 'Opening', 'Closing', 'Corrections', 'Received', 'Sold', 'Sales', 'Profit', 'Item', 'Details', 'Amount', 'Phone', 'Name', 'Balance', 'Customer', 'Vendor', 'Previous balance', 'New credit', 'New stock', 'Closing balance', 'Date', 'Rate', 'Total', 'Quantity',
 'Opening balance', 'Recoveries', 'Expenses', 'Net profit', 'Stock purchases', 'Paid to vendors', 'Total receivable', 'Total payable', 'By item', 'Money in and out'].forEach(add);
let ur = {};
try { const src = fs.readFileSync(path.join(dir, 'i18n-ur.js'), 'utf8'); const w = {}; new Function('window', src)(w); ur = w.I18N_UR || {}; } catch (e) { /* none yet */ }
const missing = [...set].filter((k) => !(k in ur)).sort();
console.log(set.size + ' keys, ' + missing.length + ' missing');
if (process.argv[2] === '--list') console.log(missing.join('\n'));
