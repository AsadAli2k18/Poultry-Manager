// Minimal static server for previewing the front-end demo in a browser: node tools/serve.js [port]
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', 'app'); const port = +process.argv[2] || 5180;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const p = path.normalize(u).replace(/^[\\/]+/, '');
  const file = path.join(root, p || 'index.html');
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('Poultry Manager demo on http://localhost:' + port));
