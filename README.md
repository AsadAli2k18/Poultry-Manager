# Poultry Manager

Offline desktop software for a poultry and meat shop run by one owner. It covers sales bills, stock received from vendors and the owner's own farm, customer and vendor ledgers (کھاتہ), recoveries, vendor payments, expenses, reports, a print designer and weekly backups. The interface is Urdu first, with English one click away.

> **Status: working desktop app (v1.0).** Data is saved in a SQLite database on the PC, backups run on schedule, and every correction is kept on record. The sample shop names, people and phone numbers that can be loaded for practice are all made up.

## Install on the shop PC

1. Run `PoultryManager-Setup-1.0.0.exe` (built with `npm run dist`, found in `dist/`).
2. Open **Poultry Manager** from the desktop shortcut. The first-time password is `1234`. Change it in **Settings → Password**.
3. In **Settings → Shop profile**, enter the shop name, address and phone numbers.
4. Add items and opening stock (**Items & rates**), then customers and vendors with their opening balances.
5. In **Settings → Backup**, choose the backup day and folder, then press **Backup now** once.

Nothing else is needed: no XAMPP, no browser, no internet.

## Where the data lives

| What | Where |
|---|---|
| Database (one file) | `Documents\PoultryManager\data\poultry.db` |
| Backups | `Documents\PoultryManager\Backups` (or the folder chosen in Settings), plus `PoultryManager-Backups` on a USB drive if one is plugged in |
| Safety copies (taken before a restore, an erase, or loading sample data) | `Documents\PoultryManager\data\safety` |
| Backup history | `Documents\PoultryManager\backup-log.json` |

Uninstalling the program never deletes this folder.

## Backups and restore

- **Automatic:** weekly by default (Sunday 22:00), or daily or monthly. If the PC is off at that time, the backup runs as soon as the app opens.
- **Each backup** is a complete copy of the database, checked before it is kept. The last N are kept (12 by default), and older ones are deleted.
- **Restore:** in **Settings → Backup → Choose backup file…**, pick a `.db` backup. The app shows how many bills it holds and asks for confirmation, then takes a safety copy of the current data, restores, and reopens.

## Corrections

Nothing is ever deleted. Every change is kept in the activity log.

| Entry | Cancel | Correct |
|---|---|---|
| Sale invoice / stock receipt | ✓ stock and balance reversed | ✓ old one cancelled with a reason, new one linked to it |
| Recovery / vendor payment | ✓ | ✓ |
| Expense | ✓ | ✓ |
| Stock correction (mortality, weight loss…) | ✓ stock goes back | add a new one |
| Customer, vendor, item | edit (opening balance changes are logged) | |

## For developers

```bash
npm install          # Electron, SQLite (rebuilt for Electron automatically), build tools
npm start            # run the app
npm test             # end-to-end checks of the real app on a throwaway data folder
npm run dist         # build dist/PoultryManager-Setup-<version>.exe
npm run demo         # browser-only demo with dummy data at http://localhost:5180
```

| Path | Contents |
|---|---|
| `desktop/main.js` | Electron shell: window, data folder, IPC, printing |
| `desktop/db.js` | SQLite schema and storage. Each record is kept as JSON, and its key fields are also real columns (dates, parties, totals, status) plus `doc_lines`, so the data can be queried outside the app. |
| `desktop/backup.js` | Scheduler, verified backups, keep-N, USB copy, restore with a safety copy |
| `desktop/preload.js` | The only functions the screens can call (`window.PM`) |
| `app/js/store.js` | Data layer for the screens. It computes stock, balances, ledgers and statuses from the entries, and saves each change to SQLite before the screen moves on. |
| `app/` | Front end: Preact + htm with no build step. Libraries and the Urdu font are bundled in `app/vendor/`. |
| `tools/selftest/` | The `npm test` scripts |
| `docs/` | Requirements (`SRS-v2.md`) and the build plan |
