# Fingerprint and ID card: design proposal

Status: **proposal for review.** Nothing here is built yet. Revise the requirements first, then build.

## Goal

- Enroll a customer's fingerprint (one or two fingers) and CNIC (number plus photos of the front and back) on their customer record.
- When a scanner is plugged in and someone places a finger, the app finds the customer and shows their details: name, phone, balance and recent bills, plus buttons for **New bill**, **Recovery** and **Ledger**.
- **Everything works without the scanner.** Biometrics are an optional shortcut, never a required step. No screen or save may depend on the device.

## Recommended hardware

A USB optical reader with a free Windows SDK that does **1:N matching on the PC** (finds one customer among all enrolled ones without asking who they are):

| Option | Why | Notes |
|---|---|---|
| **ZKTeco ZK9500 / SLK20R** (recommended) | Cheap, sold widely in Pakistan, free ZKFinger SDK for Windows with 1:N matching | Check local price and that the seller includes the Windows driver |
| SecuGen Hamster Pro 20 | Good quality, FDx SDK Pro (free for Windows) | Usually more expensive |
| HID DigitalPersona 4500 | Very common, U.are.U SDK | SDK licensing is less simple |

Buy the device first and build against that exact model. Each SDK uses a different template format, so templates from one brand cannot be matched by another. Changing brands later means re-enrolling customers.

**Not possible:** verifying against NADRA's database. That needs a licensed NADRA BVS service. This design only matches fingerprints enrolled in this shop.

## How it fits the app

```
Scanner (USB) ── vendor DLL ── biometric helper (small .exe, one per brand)
                                   │  JSON lines over stdin/stdout
desktop/biometric.js (main process) ── IPC ── window.PM.bio.* ── screens
                                   │
                           SQLite: biometrics table
```

- **Helper process, not a Node native module.** The vendor DLL runs in a small separate program (C#/.NET or C++) that the app starts and talks to over stdin/stdout. If the driver crashes or hangs, the app keeps running and only shows "scanner not connected". Electron upgrades also cannot break it.
- **One adapter per brand** behind one interface: `status()`, `capture()`, `enroll(customerId, finger)` (three touches merged into one template), `identify()` (1:N, returns the customer ID and a score), `remove(customerId)`. A **simulator adapter** gives tests and development a working path with no hardware.
- **Live listening:** while the app is open and the device is connected, the helper waits for a finger. On a match, the main process sends `bio:match` to the screen.

## Data

New SQLite table, kept apart from the customer JSON:

`biometrics(id, party_id, finger, template BLOB, sdk, quality, enrolled_at, active)`

- Store **templates only, never fingerprint images**.
- CNIC: `cnic` (13 digits, shown as 12345-1234567-1) on the customer record, with a check for duplicates. The two card photos are saved like the vendor bill photos (`photos` table, shrunk).
- Included in backups and restores like everything else. Removing an enrollment marks it inactive and logs it in the activity log, the same as other corrections.
- Settings → **Fingerprint scanner**: device brand, status, a test scan and a match threshold, plus an off switch.

## Screens

1. **Customer form → "Fingerprint & ID card" section:** CNIC number, front and back photos (camera or file), and **Enroll finger** (place the finger three times, with a quality bar). This shows "Enrolled ✓ (right thumb)" and a Remove button.
2. **Top bar status pill**, like the Online pill: 🟢 Scanner ready / ⚪ No scanner. Clicking it opens a test scan.
3. **Customer found popup** on any screen when a finger matches: photo, name, phone, CNIC (partly hidden), current balance, last 5 bills, and buttons for New bill, Recovery and Open ledger. No match shows "Not recognised. Search by name instead."
4. **In the bill and recovery forms:** if the customer field is empty, a scan fills it. A fingerprint icon next to the customer picker starts a scan.

## Privacy and safety

- Ask for consent before enrolling (a checkbox on the form) and be able to delete an enrollment.
- Hide the CNIC on printouts by default.
- A match only fills in or opens a customer. It never posts an entry, so a wrong match cannot change money.

## Build steps (once approved)

1. Simulator adapter, IPC, the `biometrics` table, CNIC fields and the screens. Fully testable with `npm test`.
2. Helper for the chosen device model, tested on the real scanner.
3. Package the helper and vendor runtime with the installer. Driver install steps go in the README.

## Questions for the owner

- Which scanner model will be bought?
- One finger or two per customer?
- Should vendors (sellers) also be enrollable, or customers only?
- Should a match also show a photo of the customer's face (taken at enrollment)?
