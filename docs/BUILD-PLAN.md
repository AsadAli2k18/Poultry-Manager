# Poultry Manager — Build & Deployment Plan (v2)

Built to `SRS-v2.md`. Changed from v1: **no XAMPP**. The software ships as a standalone Windows desktop program, and the work goes **front end first** (approved visually with dummy data), then backend.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** | Own window, own installer and shortcut. Runs the same front end with no browser or server. |
| Front end | Preact 10 + htm, no build step (same approach as DistroManager) | Already built in `app/`, works offline, easy to change during design review |
| Database (backend phase) | **SQLite** (one file on the PC, via `better-sqlite3`) | No database server to install or run. Backup = copying one file. |
| Backups | Scheduler in Electron's main process | Weekly by default, runs on next start if the PC was off |
| Installer | `electron-builder` → one `PoultryManager-Setup.exe` | Owner double-clicks to install. No other software needed. |
| Fonts, icons, libraries | Bundled in `app/vendor/` | Nothing loads from the internet |

## Phase 1 — Front-end demo (done)

The whole interface, with dummy data and working flows:

- Every screen: dashboard, sale invoices, stock receipts, stock, items & rates, customers, vendors, ledgers (khata), recoveries, vendor payments, expenses, reports, settings.
- Real rules in a mock data layer (`app/js/store.js`):
  - stock moves with bills and corrections
  - balances and ledgers are calculated from the entries
  - payments settle the oldest bills first
  - cancel and correct keep the original on record
  - duplicate-save and negative-stock warnings
- Urdu/English switch, and the Roman → Urdu converter with an offline fallback.
- Print designer: 3 templates, A4/A5/A6, Urdu/English/both, field toggles, live preview.
- Backup screen: weekly schedule, folder, USB copy, history, Backup Now and Restore. In the demo, Backup Now downloads a file.
- Data is saved in the demo window's local storage. **Settings → Activity log → Reset demo data** regenerates fresh dummy data.

**Review loop:** the owner and you go through each screen and flow, list the changes, and I apply them. Repeat until the design is approved.

## Phase 2 — Backend (done in v1.0)

1. **SQLite schema** for every record in SRS §5, plus a migration runner.
2. **Data API in Electron's main process** that mirrors the `Store` functions the screens already call (save document, payment, ledger, summary…). The screens don't change; only `store.js` switches from local storage to the API.
3. **Backup service:**
   - Copy the database file safely while the app is running (SQLite online backup).
   - Weekly/daily/monthly schedule, plus a catch-up run on start when one was missed.
   - Keep the last N backups. Copy to USB when present.
   - Restore with a safety copy of the current data taken first.
4. **Real folder picker and printing** through Electron (Windows printer dialog, plus silent print to a default printer if wanted).
5. **Owner password** stored hashed (scrypt). The first-time password is 1234 until it is changed. Auto-lock after idle time is still to do.
6. **Audit log** written for every change.

## Phase 3 — Packaging and testing

Done: `npm run dist` builds the NSIS installer, and `npm test` runs end-to-end checks of the real app: every entry type, corrections, cancels, restart persistence, the catch-up backup, restore, erase, and sample data. Still to do: the checks on the shop PC below.


- `electron-builder` NSIS installer with a desktop and Start-menu shortcut. Data and backups go in `Documents\PoultryManager`, so uninstalling never deletes data.
- Acceptance checks from SRS §7 on a clean Windows PC with the network unplugged.
- Re-enter sample rows from the paper registers and compare the balances.

## Phase 4 — Go-live at the shop

1. Run the installer on the shop PC.
2. Set the printer and shop header, then print a test invoice.
3. Enter opening stock, and opening customer and vendor balances.
4. Choose the backup day and folder, and run the first backup.
5. Walk the owner through the daily flows, then run the register alongside the software for a week.

## How to run the demo

```bash
npm install
npm run vendor
npm start
```

- `npm install` downloads Electron and the libraries, once.
- `npm run vendor` copies the libraries and fonts into `app/vendor` (already done).
- `npm start` opens Poultry Manager as a desktop app. The demo password is `1234`.

To view it in a browser instead, run `node tools/serve.js` and open http://localhost:5180.
