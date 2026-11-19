# ID card (CNIC) and fingerprint

Status: **built** for the SecuGen Hamster Pro 20 (U20-AP) with the FDx SDK Pro for Windows v4.3.1.

## Principles

- **Optional.** Every screen works without a CNIC, without an enrolled finger and without a scanner. A customer is registered as before; the ID card and fingerprint can be added any time later.
- **A match never changes money.** It only opens a customer, or fills in the customer on an open bill or recovery.
- **Templates only.** The app keeps the scanner's fingerprint code (ANSI-378 template), never a picture of the finger.
- **The scanner can't take the app down.** The vendor library runs in a separate helper process. If it hangs or the scanner is unplugged, the app shows "No scanner" and keeps working.

## What the shop sees

- **Customer form:** an optional "Add ID card (CNIC) details" section with these fields:
  - CNIC number, typed as digits and shown as 12345-1234567-1 (13 digits are checked)
  - father or husband name
  - gender, suggested from the last digit of the CNIC
  - date of birth, issue date and expiry date
  - address on the card
  - photos of the front and back

  A second customer or vendor with the same CNIC is flagged before saving.
- **Customer page → "ID card & fingerprint":**
  - The CNIC is masked as 35202-•••••67-1, with a Show button.
  - Badges mark a card as expired or expiring soon.
  - Card photos can be opened full size.
  - Enrolled fingers are listed (up to two) with **Enroll fingerprint** and **Remove** buttons.
- **Enrolment:**
  1. Choose a finger and tick the customer's consent.
  2. Place the same finger three times. The quality of each touch is shown.
  3. The first touch is checked against everyone already enrolled ("already enrolled for …"). Each later touch must match the first.
- **Top bar pill:** Scanner ready / No scanner. Clicking it scans one finger right away.
- **Finger placed anywhere** (when "Recognise a finger as soon as it is placed" is on):
  - If an open bill or recovery in the visible tab has no customer yet, that customer is filled in.
  - Otherwise a **Customer found** popup shows the balance, the last 5 bills, and **New bill / Recovery / Open ledger**.
  - An unknown finger shows "not recognised".
- **Customer picker:** a fingerprint button scans on request. Customer search also finds CNIC numbers.
- **Settings → Fingerprint scanner:** on/off, status with the scanner's serial number, listen on/off, and match strictness (Relaxed 4 / Normal 5 / Strict 7, SecuGen's security levels).

## How it is built

```
SecuGen U20-AP ── sgfplib.dll ── helper (PowerShell + C# P/Invoke, JSON lines over stdin/stdout)
                                      │
desktop/biometric.js (main process) ── IPC (window.PM.bio) ── app/js/bio.js (screens)
                                      │
                         SQLite: biometrics table, customers.cnic column
```

- `desktop/biometric.js`
  - Sends the scanner one request at a time.
  - Runs a listening loop of 1.5-second capture attempts. A screen that asks for a capture pauses it, and any finger caught meanwhile is handed to that screen.
  - Matches 1:N by comparing the finger with every active enrolled template (the SDK's 1:1 `MatchTemplate`), then keeps the highest score.
  - Re-opens the scanner every 5 s while it is unplugged.
- **Helper:** compiled at start-up by Windows' own PowerShell, so no extra runtime is needed. Start-up takes about 3 s.
- **Simulator:** `PM_BIO_SIM=1` replaces the scanner for the automated checks (`tools/selftest/6-fingerprint.js`, 30 checks).
- **Database:** schema version 3 adds the `cnic` column on customers and vendors, and the `biometrics` table.
  - The table's columns are id, party_id, finger, sdk, quality, enrolled_at, active and data (which holds the templates).
  - Removing a finger keeps it as inactive and logs it in the activity log.
  - Backups and restores include these records like everything else.

## Setting up a PC

1. Install the SecuGen driver for the U20-AP. The WBF driver that is already installed works, and so does the regular "SecuGen Windows Driver".
2. Developer machine only: `npm run secugen -- "<FDx_SDK_Pro_Windows_….zip>"` copies SecuGen's 64-bit DLLs into `desktop/vendor/secugen/x64`. They are not kept in git. The installer unpacks them next to the app (`asarUnpack`).
3. Templates are SecuGen-specific. Changing to another scanner brand means enrolling customers again.

Not possible: checking a fingerprint against NADRA. That needs a licensed NADRA BVS service. Matching is only against fingers enrolled in this shop.
