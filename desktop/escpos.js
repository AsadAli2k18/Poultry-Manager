// Direct printing for receipt printers (ESC/POS). Many cheap receipt-printer drivers print blank slips from Chrome/Electron,
// so a thermal bill is drawn as a black-and-white picture at the printer's own resolution (8 dots per mm, 203 dpi)
// and sent straight to the printer, bypassing the driver. Urdu prints exactly as on screen, and the paper is cut after the last line.
const { BrowserWindow, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DOTS_PER_MM = 8;
const ZOOM = DOTS_PER_MM * 25.4 / 96; // CSS px -> printer dots
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Draws the bill and returns { width, height, bits } with one bit per dot (1 = black), rows padded to whole bytes.
async function rasterize(html, contentMm) {
  const file = path.join(os.tmpdir(), 'poultry-receipt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.html');
  fs.writeFileSync(file, html, 'utf8');
  const width = Math.round(contentMm * DOTS_PER_MM);
  const w = new BrowserWindow({ show: false, width: Math.ceil(width * 1.3), height: 800, useContentSize: true, backgroundColor: '#ffffff',
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, javascript: true } });
  try {
    await w.loadFile(file);
    await w.webContents.insertCSS('html{overflow:hidden}::-webkit-scrollbar{display:none}'); // a scrollbar would shift the bill sideways
    w.webContents.setZoomFactor(ZOOM);
    await w.webContents.executeJavaScript('document.fonts.ready.then(() => 1)');
    await wait(300);
    const measure = async () => {
      const r = await w.webContents.executeJavaScript("(() => { const b = document.querySelector('.rc').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()");
      return { x: Math.floor(r.x * ZOOM), y: Math.floor(r.y * ZOOM), width: Math.ceil(r.w * ZOOM), height: Math.ceil(r.h * ZOOM) + 4 };
    };
    let rect = await measure();
    // make the window tall enough for the whole bill, then measure again (the layout can move when the window changes)
    w.setContentSize(Math.max(rect.x + rect.width + 16, Math.ceil(width * 1.3)), rect.y + rect.height + 16);
    await wait(300);
    rect = await measure();
    w.webContents.invalidate(); await wait(400);
    const img = await w.webContents.capturePage(rect);
    const sz = img.getSize(); const bmp = img.toBitmap(); // BGRA
    const sx = sz.width / rect.width; // 1 unless the screen scale crept in
    const height = Math.round(sz.height / sx); const bpr = Math.ceil(width / 8);
    const bits = Buffer.alloc(bpr * height);
    const off = Math.round((rect.width - width) / 2); // centre the drawing on the printable width
    for (let y = 0; y < height; y++) {
      const py = Math.min(sz.height - 1, Math.round(y * sx));
      for (let x = 0; x < width; x++) {
        const px = Math.round((x + off) * sx); if (px < 0 || px >= sz.width) continue;
        const i = (py * sz.width + px) * 4;
        const lum = 0.114 * bmp[i] + 0.587 * bmp[i + 1] + 0.299 * bmp[i + 2];
        if (lum < 165) bits[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    // drop blank rows at the bottom
    let last = height - 1;
    while (last > 0 && !bits.subarray(last * bpr, (last + 1) * bpr).some((b) => b)) last--;
    return { width, height: last + 1, bpr, bits: bits.subarray(0, (last + 1) * bpr) };
  } finally {
    w.destroy(); fs.unlink(file, () => {});
  }
}

// ESC/POS: reset, the picture in bands (GS v 0), feed, then cut.
function toEscPos(r, opts = {}) {
  const parts = [Buffer.from([0x1b, 0x40])];
  const BAND = 128;
  for (let y = 0; y < r.height; y += BAND) {
    const h = Math.min(BAND, r.height - y);
    parts.push(Buffer.from([0x1d, 0x76, 0x30, 0, r.bpr & 0xff, r.bpr >> 8, h & 0xff, h >> 8]));
    parts.push(r.bits.subarray(y * r.bpr, (y + h) * r.bpr));
  }
  parts.push(Buffer.from([0x1b, 0x64, 4])); // feed past the cutter
  if (opts.cut !== false) parts.push(Buffer.from([0x1d, 0x56, 66, 0])); // partial cut
  return Buffer.concat(parts);
}

// Sends bytes to a Windows printer as a RAW job (winspool), using the PowerShell built into Windows. No extra software needed.
const PS = `$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class PmRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern int StartDocPrinter(IntPtr h, int level, DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static void Send(string printer, string doc, byte[] data) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("Cannot open printer (" + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = doc; di.pDataType = "RAW";
      if (StartDocPrinter(h, 1, di) == 0) throw new Exception("Printer refused the job (" + Marshal.GetLastWin32Error() + ")");
      try { StartPagePrinter(h); int w; if (!WritePrinter(h, data, data.Length, out w) || w != data.Length) throw new Exception("Sending failed (" + Marshal.GetLastWin32Error() + ")"); EndPagePrinter(h); }
      finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@
[PmRaw]::Send($env:PM_RAW_PRINTER, $env:PM_RAW_DOC, [System.IO.File]::ReadAllBytes($env:PM_RAW_FILE))
Write-Output 'OK'`;

function sendRaw(printer, data, doc) {
  const file = path.join(os.tmpdir(), 'poultry-receipt-' + Date.now() + '.bin');
  fs.writeFileSync(file, data);
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const enc = Buffer.from(PS, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], {
      env: { ...process.env, PM_RAW_PRINTER: printer, PM_RAW_FILE: file, PM_RAW_DOC: doc || 'Poultry Manager receipt' }, windowsHide: true, timeout: 30000,
    }, (err, stdout, stderr) => {
      fs.unlink(file, () => {});
      if (!err && /OK/.test(stdout)) resolve({ ok: true, reason: '' });
      else resolve({ ok: false, reason: ((stderr || '').split('\n').find((l) => /Exception|refused|Cannot|failed/i.test(l)) || (err && err.message) || 'print failed').trim() });
    });
  });
}

async function printReceipt(html, { printer, cut, contentMm }) {
  const r = await rasterize(html, contentMm);
  // checks only: PM_RECEIPT_DIR saves what would be printed as a PNG and sends nothing
  if (process.env.PM_RECEIPT_DIR) {
    const px = Buffer.alloc(r.width * r.height * 4, 255);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.bits[y * r.bpr + (x >> 3)] & (0x80 >> (x & 7))) px.fill(0, (y * r.width + x) * 4, (y * r.width + x) * 4 + 3);
    const file = path.join(process.env.PM_RECEIPT_DIR, 'receipt-' + Date.now() + '.png');
    fs.writeFileSync(file, nativeImage.createFromBitmap(px, { width: r.width, height: r.height }).toPNG());
    return { ok: true, reason: '', file, dots: { width: r.width, height: r.height }, bytes: toEscPos(r, { cut }).length };
  }
  return { ...(await sendRaw(printer, toEscPos(r, { cut }))), dots: { width: r.width, height: r.height } };
}

module.exports = { printReceipt, rasterize, toEscPos, sendRaw };
