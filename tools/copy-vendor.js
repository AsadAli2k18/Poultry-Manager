// Copies front-end libraries and fonts from node_modules into app/vendor so the app runs fully offline.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..'); const nm = (p) => path.join(root, 'node_modules', p); const out = (p) => path.join(root, 'app', 'vendor', p);
const cp = (a, b) => { fs.mkdirSync(path.dirname(out(b)), { recursive: true }); fs.copyFileSync(nm(a), out(b)); };
cp('htm/preact/standalone.umd.js', 'htm-preact.umd.js');
cp('bootstrap-icons/font/bootstrap-icons.min.css', 'bootstrap-icons/bootstrap-icons.min.css');
for (const f of fs.readdirSync(nm('bootstrap-icons/font/fonts'))) cp('bootstrap-icons/font/fonts/' + f, 'bootstrap-icons/fonts/' + f);
for (const w of [400, 700]) cp(`@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-${w}-normal.woff2`, `fonts/noto-nastaliq-urdu-${w}.woff2`);
console.log('vendor files copied');
