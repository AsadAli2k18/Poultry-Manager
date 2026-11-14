# Poultry Manager

Offline desktop software for a poultry and meat shop run by one owner. It covers sales bills, stock received from vendors and the owner's own farm, customer and vendor ledgers (کھاتہ), recoveries, vendor payments, expenses, reports, a print designer and weekly backups. The interface is Urdu first, with English one click away.

> **Status: front-end demo.** Every screen and flow works on dummy data so the design can be reviewed and approved. The backend (SQLite database, real backup files, Windows installer) comes next. See [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md).
>
> All names, phone numbers and shop details in the demo data are made up.

## Run the demo

```bash
npm install
npm start
```

- `npm install` downloads Electron and the front-end libraries, once.
- `npm start` opens the app as a desktop window. The demo password is `1234`.

To view it in a browser instead:

```bash
npm run demo
```

Then open http://localhost:5180.

## What's inside

| Path | Contents |
|---|---|
| `app/` | The front end: Preact + htm with no build step. Libraries and the Urdu font are bundled in `app/vendor/`, so nothing loads from the internet. |
| `app/js/store.js` | Demo data layer. Stock, balances, ledgers and statuses are calculated from the entries, the same way the backend will. |
| `app/js/i18n-ur.js` | Urdu dictionary. `node tools/i18n-keys.js --list` lists any UI text without a translation. |
| `app/js/print.js` | Printable bills, receipts, vouchers, ledgers and reports (3 templates, A4/A5/A6, Urdu/English/both). |
| `desktop/main.js` | Electron shell, so it runs as a standalone Windows program with no XAMPP and no browser. |
| `docs/` | Requirements (`SRS-v2.md`) and build/deployment plan. |

## Highlights

- **Sales and stock:**
  - Sale invoices with several items and an editable rate per line.
  - Stock receipts from vendors. The own farm records KG only, with no payable.
  - Stock moves automatically with every bill.
- **Customer and vendor ledgers** in the paper register's layout (نام / جمع / لینا-دینا / بقایا).
- **Payments:**
  - Payments settle the oldest bills first.
  - Each payment records method, transaction ID, from/to account, who handled it, and on whose behalf.
- **Corrections:** cancelling or correcting a bill never deletes it. Every change is kept in an activity log.
- **Language:** Urdu/English switch, and a Roman Urdu → Urdu converter that falls back to offline conversion when there's no internet.
- **Backups:** weekly automatic backup by default, with daily and monthly options, a folder, a USB copy, history, and restore.
