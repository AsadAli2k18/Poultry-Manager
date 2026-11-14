# Poultry Management Software — Requirements Specification v2

Prepared for a poultry and meat shop run by a single owner. Stock comes from the owner's own farm and from outside vendors.

v2 replaces v1 (`Poultry_Management_Software_Requirements_Updated.pdf`). It adds:
- a vendor module
- an open-ended item list
- bilingual Urdu/English screens with Roman Urdu input
- a configurable print designer
- owner-defined expense categories

It also records how the owner's paper registers and bill pad work today.

---

## 1. Project overview

- Simple software for one shop owner who is not technical. Urdu first, with English available.
- One owner login. No employees, payroll, attendance or user roles.
- **Works fully offline** on the shop PC. Internet is only used for the higher-quality Roman Urdu converter (see FR-01).
- **Installed as a standalone Windows desktop program** (own installer, desktop shortcut, own window). No XAMPP, no web server and no browser needed. Data is kept in a local database file on the PC.
- All amounts are in PKR, in whole rupees, shown with Pakistani digit grouping (12,92,841). Quantities are in KG with up to 2 decimals unless an item uses a different unit. Dates and times use Pakistan local time and are shown as d/m/yy.
- Main menu (large buttons):
  - Sale Invoices
  - Stock Receipts
  - Stock
  - Customers
  - Recoveries
  - Vendors
  - Vendor Payments
  - Expenses
  - Reports
  - Settings & Backup

## 2. How the shop works today (from the registers)

The software copies the existing paper ledger (کھاتہ) so the owner recognises it.

| Register column | Meaning | Software field |
|---|---|---|
| تاریخ | Date | Entry date |
| تفصیل | Details: `مال 1864 کلو` (goods), `وصول` (payment received), `گوشت 55 کلو` (meat) | Item, KG, bill no., payment details |
| صفحہ | Used as the **rate** column (1864 × 387 = 721,368) | Rate |
| نام | Debit (blue) | Sale or receipt amount |
| جمع | Credit (red), often with who handled the payment (a collector's name) | Payment amount + handler |
| جمع یا نام | `لینا` = we will receive, `دینا` = we will pay | Balance side |
| بقایا | Running balance; a red "نل" means settled | Running balance; "settled" marker at zero |

What the registers show:
- Customers often pay round lump sums that cover several bills. Some keep a standing balance from week to week.
- Bill numbers are noted in the ledger, e.g. نمبر (426).
- Vendor payments are often collected by the vendor's own person (a named collector) and sent by online transfer.
- Single entries reach 30 lakh rupees and 8,000 KG.

The shop's printed bill pad has:
- an Urdu header (shop name, address, two owner names with phones)
- buyer name and date
- a blank body

The Classic print template reproduces this layout.

## 3. Functional requirements

### FR-01 Language
- Every screen, form, message and printout is available in Urdu (right to left) and English. A switch on every screen changes language instantly.
- Names and notes are stored in both scripts (`name_ur`, `name_en`).
- **Roman Urdu converter:** each name and note field has a convert button that turns Roman text ("javed iqbal") into Urdu script (جاوید اقبال). The result can be edited before saving.
  - Online, a transliteration service is used (more accurate).
  - Offline, a built-in phonetic converter is used. A notice tells the owner there is no internet and that basic conversion is in use.
- An Urdu font is bundled with the software, so text displays correctly without internet.

### FR-02 Items
- The owner can add, edit and deactivate items. The list is open-ended (chicken, gosht, drumstick, fish and future meat products).
- Each item has:
  - Urdu and English names
  - unit (KG by default)
  - default selling rate
  - optional cost rate
  - active flag
  - opening stock
- Chicken (KG) is created at setup. Other items are added by the owner.
- The default rate prefills invoice lines and can be changed on every line.

### FR-03 Inventory
- Each item has its own stock balance:
  `Available = opening + stock receipts − sold ± corrections`
- Stock is plain units of the item: selling 55 KG of gosht reduces gosht by 55 KG. **No yield or conversion factors.**
- Saving a stock receipt adds stock. Saving a sale invoice reduces it.
- Stock corrections need a reason (e.g. mortality, weight loss, count correction) and are kept as dated records.
- A warning appears when an invoice would take stock below zero. The owner can still save it.

### FR-04 Customers
- Add, edit and search customers by name (either script), customer ID or phone.
- Fields:
  - auto-generated ID
  - name (required)
  - phone
  - address
  - opening balance (لینا) as of the go-live date
  - note
  - active flag

### FR-05 Vendors (new)
- Mirrors the customer module: add, edit and search vendors by name, ID or phone.
- Fields:
  - auto-generated ID
  - name (required)
  - phone
  - address
  - opening balance (دینا)
  - note
  - active flag
  - **Own farm** flag
- An **own farm** vendor records KG only: no rate, no amount, no payable. Farm running costs go to Expenses.

### FR-06 Sale invoices
- New invoice:
  1. Choose or add the customer.
  2. Add one or more lines: item, KG, rate (prefilled, editable), amount = KG × rate.
  3. Enter the amount received now (optional, with payment details from FR-09).
  4. Save and print.
- Filled in automatically: invoice number, date and time (date can be changed), total, previous balance, new balance.
- Saving reduces stock and updates the customer balance.
- No discounts, taxes or cashier options on the invoice screen.
- Status: Paid / Partially Paid / Unpaid. Payments are applied to the oldest unpaid invoices first.
- Search past invoices by number, customer, date or amount.

### FR-07 Stock receipts (new: the vendor's bill as recorded by us)
- Header:
  - vendor
  - date and time
  - vendor's own bill number
  - vehicle/driver (optional)
  - note
  - optional photo of the vendor's paper bill
- Lines: item, KG, rate, amount = KG × rate.
- Amount paid now (optional, with payment details from FR-09).
- Saving adds stock, updates the vendor balance (دینا) and stores the cost rate per line.
- Status: Paid / Partially Paid / Unpaid, settled oldest first.
- Own farm receipts take item and KG only.

### FR-08 Recoveries and vendor payments
- **Recovery** = money in from a customer. **Vendor payment** = money out to a vendor. Both use the same form (FR-09).
- Saving updates the balance and the invoice or receipt statuses, and offers a printable receipt or voucher.
- Settlement write-offs (small differences let go) are **out of scope for now**.

### FR-09 Payment details (shared by all money entries)

| Field | Required | Notes |
|---|---|---|
| Date and time | Yes | Defaults to now |
| Amount | Yes | |
| Method | Yes | Cash, Online transfer, Easypaisa, JazzCash, Bank deposit, Cheque (owner can add more) |
| Transaction ID / reference | For non-cash | Cheque no. for cheques |
| From account | No | Sending bank/wallet and account or number |
| To account | No | Receiving bank/wallet and account or number |
| Handled by | No | Person who brought or collected the payment, e.g. the vendor's collector |
| Paid on behalf of / by | No | Third party paying for someone else, e.g. another poultry business |
| Note | No | |

Ledger prints show the handler or third party in the details column, as in the register.

### FR-10 Expenses
- Fields: date, category, amount, description, payment method.
- The owner can add, rename and deactivate categories. Bills and Transport are created at setup.
- Totals are shown for the day, month and year.

### FR-11 Ledgers
- **Customer ledger** and **vendor ledger**, both in the register's column layout:
  `Date | Details | Rate | Debit (نام) | Credit (جمع) | لینا/دینا | Balance`
- Entries are in date order, starting with the opening balance. A settled marker is shown whenever the balance reaches zero.
- Printable for a chosen date range.

### FR-12 Reports (daily, monthly or yearly with one click, all printable)

| Report | Contents |
|---|---|
| Summary | Sales (KG and amount by item), stock received (KG and amount), recoveries, vendor payments, expenses by category, cash movement |
| Daily credit list | Per customer: previous balance, new credit, received, closing balance, with a grand total |
| Daily payable list | Per vendor: previous balance, new receipts, paid, closing balance, with a grand total |
| Receivables / payables | Outstanding balance per customer and per vendor, with shop totals |
| Stock summary | Per item: opening, received, sold, corrections, available |
| Profit | Shown only where cost data exists (vendor receipt rates or item cost rate). Own farm stock has no cost unless an item cost rate is set. |

### FR-13 Print designer (new)
Separate settings screen, modelled on DistroManager's invoice builder:
- **Templates:** Classic (matches the bill pad), Modern, Minimal.
- **Paper:** A4, A5, half-A5. 80 mm thermal is planned for later.
- **Language:** Urdu, English or both.
- **Header:** shop name (both scripts), address, owner names and phones, logo.
- **Field toggles:** bill no., rate column, previous balance, received, new balance, payment details, signature line, footer note.
- **Font size**, and a live preview before printing.
- Applies to sale invoices, stock receipts, recovery receipts, payment vouchers, ledgers and reports.
- Printing goes through the standard Windows printer dialog (works with any printer).

### FR-14 Corrections and history
- Saved invoices, receipts, payments and expenses are never deleted. A correction or cancellation creates a reversal plus a new entry, both visible and linked, with a reason.
- An audit log records every create, change and cancellation with date and time.
- Saving the same entry twice is prevented: double-click protection plus a warning for same customer, same amount, within a few seconds.

### FR-15 Backup and reliability
- Automatic backup on a schedule the owner sets: **weekly by default** (day and time chosen in Settings, e.g. Sunday 22:00), or daily / monthly.
- Backups go to a chosen folder, with an optional copy to a USB drive when one is plugged in. The last N backups are kept (default 12) and older ones are removed automatically.
- If the PC is off at backup time, the backup runs as soon as the app is opened next.
- Settings shows the last backup, the next scheduled backup and a backup history. The dashboard shows backup status.
- One-click Backup Now and Restore (restore asks for confirmation and warns that current data will be replaced).
- Clear confirmation and error messages. Save, Back and Print buttons are always visible.

## 4. Go-live

Records start from the go-live date. Before first use, the owner enters:
1. opening stock per item
2. opening balance per customer (لینا)
3. opening balance per vendor (دینا)

Past register history is not entered.

## 5. Data records

| Record | Stored fields |
|---|---|
| Item | ID, name_ur, name_en, unit, default rate, cost rate, opening stock, active |
| Customer | ID, name_ur, name_en, phone, address, opening balance, note, active |
| Vendor | ID, name_ur, name_en, phone, address, opening balance, own-farm flag, note, active |
| Sale invoice | No., date/time, customer, total, received, status, cancelled-by/replaces link |
| Invoice line | Invoice, item, qty, rate, amount |
| Stock receipt | No., date/time, vendor, vendor bill no., vehicle, photo, total, paid, status, links |
| Receipt line | Receipt, item, qty, rate, amount |
| Payment | No., direction (in/out), party, date/time, amount, method, reference, from/to account, handled by, on behalf of, note, links |
| Payment allocation | Payment, invoice/receipt, amount applied |
| Stock correction | Date, item, ± qty, reason |
| Expense | Date, category, amount, method, description |
| Expense category | Name_ur, name_en, active |
| Payment method | Name_ur, name_en, active |
| Print settings | Template, paper, language, header fields, toggles, font size, per document type |
| Audit log | Time, action, record, before/after |

Balances and stock are always calculated from these records and never stored as running totals.

## 6. Calculations

- Line amount = qty × rate. Invoice/receipt total = sum of lines.
- Customer balance = opening + invoice totals − recoveries (cancelled entries excluded).
- Vendor balance = opening + receipt totals − vendor payments.
- Stock = opening + receipts − sales ± corrections, per item.
- Payments settle invoices/receipts oldest first. Status follows from the amount applied.

## 7. Acceptance checks

1. Opening stock is 100 KG chicken. Receive 20 KG from the own farm, sell 15 KG. Stock shows 105 KG and no payable is created.
2. Invoice for 10 KG at 500 with 2,000 received. Total 5,000, remaining 3,000.
3. Easypaisa recovery of 1,000 with a transaction ID for that customer. Balance becomes 2,000 and the invoice shows Partially Paid.
4. Stock receipt from Vendor A: 50 KG at 300, 5,000 paid. Stock rises by 50 and Vendor A's balance is 10,000 دینا.
5. Online payment of 4,000 to Vendor A, handled by the vendor's collector, with a TID. Balance 6,000. The ledger shows the handler.
6. Add the item "Gosht" and sell 55 KG at a rate typed on the invoice. Only gosht stock drops by 55.
7. Cancel the receipt from check 4. Stock and vendor balance are reversed and both entries stay visible.
8. Add an expense category "Labour" and record an expense. It appears in the daily report.
9. Switch the language to English and back. Every label changes. With internet off, the Roman Urdu converter still works and shows the offline notice.
10. Print an invoice in Classic A5 and Modern A4, a customer ledger, a vendor ledger, the daily credit list and the daily payable list. All figures match the saved entries.
11. Re-enter a sample of rows from two of the paper register pages (one vendor, one customer). Running balances match the register.
12. No employee, payroll, attendance or multi-user menus exist.
