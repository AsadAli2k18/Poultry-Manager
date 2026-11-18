// Builds desktop/icon.ico (16–256 px) and desktop/icon.png from the app's logo (same drawing as Logo in app/js/app.js).
// Usage: npx electron tools/make-icon.js
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs>
<rect width="40" height="40" rx="10" fill="url(#g)"/><path d="M13 27c0-6 3-11 8-11 3 0 5 2 5 5 0 4-3 6-7 6h-6z" fill="#fff"/><circle cx="24" cy="14" r="3.2" fill="#fff"/><path d="M26.5 12.5l3-1.5-2 3z" fill="#F59E0B"/><path d="M23 10.5c.5-1.6 1.6-2.2 2.6-2-.3 1-.8 1.6-1.6 2z" fill="#F43F5E"/><path d="M17 27v4M21 27v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 300, height: 300, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,' + encodeURIComponent('<html><body style="margin:0;background:transparent"></body></html>'));
  const pngs = [];
  for (const n of SIZES) {
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((res) => {
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = ${n};
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, ${n}, ${n}); res(c.toDataURL('image/png')); };
      img.src = 'data:image/svg+xml;base64,' + btoa(${JSON.stringify(SVG)}); })`);
    pngs.push(Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  // ICO with PNG-compressed entries (supported since Windows Vista)
  const head = Buffer.alloc(6 + 16 * SIZES.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
  let off = head.length;
  SIZES.forEach((n, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(n >= 256 ? 0 : n, e); head.writeUInt8(n >= 256 ? 0 : n, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
    off += pngs[i].length;
  });
  const dir = path.join(__dirname, '..', 'desktop');
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([head, ...pngs]));
  fs.writeFileSync(path.join(dir, 'icon.png'), pngs[SIZES.length - 1]);
  console.log('icon written: desktop/icon.ico, desktop/icon.png');
  app.exit(0);
});
