# ThriftOS v1 — App Flow (screens and journeys)

One app (Angular PWA). What a user sees depends on role and tenant settings. Phone-first; the same screens widen on desktop.

## Navigation (bottom tab bar on phone, side bar on desktop)
| Tab | Urdu label | Roles | Purpose |
|---|---|---|---|
| Home | ہوم | Owner, Munshi | Owner: 3 numbers + alerts. Munshi: today's tasks |
| Maal Aya (Receive) | مال آیا | Owner, Munshi | New container/lot, direct stock |
| Chhantai (Sort) | چھانٹی | Owner, Munshi | Open lot, record outputs |
| Stock | اسٹاک | All | Bales and sorted stock, QR scan |
| Becho (Sell) | بیچو | Owner, Munshi | New sale, bills |
| Khata | کھاتہ | Owner, Munshi | Customer balances, payments, reminders |
| More | مزید | Owner/Admin | Settings, users, categories/grades, suppliers |

Hidden unless enabled in settings: Reports, Export, Warehouses, Payroll.

## Journey 1 — Container arrives (Munshi, < 60 s)
1. Maal Aya → "Container" (or "Ready stock" for Journey 5).
2. Pick supplier (search; "+ new" with name + country only) and origin country (defaults from supplier).
3. Enter: container number (optional), invoice weight kg, weighbridge weight kg (optional), purchase cost + currency (defaults PKR; FX rate if USD).
4. Charges: quick chips Duty, Clearing, Freight, Transport, Other → amount each. Can be added later.
5. Save → shows landed cost per kg. Lot is now "Ready to sort". Works offline.

## Journey 2 — Sorting (Munshi, < 10 s per line)
1. Chhantai → pick lot (shows remaining kg).
2. Screen = grid of big category tiles (tenant's list, most-used first).
3. Tap tile → kg keypad → Save. Repeat. Running total + "remaining from lot" visible at top.
4. Waste/rags tile always present.
5. If tenant uses 2 stages: from a category output, "Grade it" → grade tiles (A/B/C/Cream — tenant names) → kg.
6. "Close lot" → shows yield (% per category/grade, waste %) and cost per kg of each output. Allowed with a remainder: remainder goes to waste with a confirm.

## Journey 3 — Make bales (Munshi)
1. Stock → "Make bale" → pick grade/category (or scan) → enter bale weight kg (and pieces, optional) → Save.
2. Stock is deducted FIFO by default from matching sorted outputs (manual pick available under "Advanced").
3. Print QR sticker (A4 sheet or thermal). Bale gets status Ready.

## Journey 4 — Sell (Munshi/Owner, < 30 s)
1. Becho → pick customer (search; "+ new" with name + phone only).
2. Add items: scan bale QR, or pick grade + kg, or pick item + pieces. Price defaults to last price for this customer/grade.
3. Payment: Cash now / Udhaar / Part paid.
4. Save → "Share bill on WhatsApp" (opens wa.me with text + link to bill PDF).

## Journey 5 — Direct stock (small merchant / trader)
1. Maal Aya → "Ready stock" → supplier → item (bale type/grade or piece type) → quantity (bales / kg / pieces) → total cost.
2. Stock is ready to sell immediately. Optional "Open bale" → count pieces into price tiers (e.g., 300 / 500 / 800 PKR).

## Journey 6 — Khata (udhaar)
1. Khata → list of customers sorted by amount owed, with days overdue.
2. Customer → ledger (sales, payments, balance).
3. "Payment received" → amount, method (Cash/Bank/Raast/JazzCash/Easypaisa), optional screenshot → Save → share receipt.
4. "Remind" → WhatsApp message with balance (Urdu or English template).

## Journey 7 — Owner home
Top cards: **Profit (this month / per container)**, **Udhaar owed**, **Stock ready (kg / bales)**, **Today's sales**.
Below: last 5 containers with profit and yield %, supplier/origin comparison (profit per kg, A-grade %), top 5 customers owing.
Tap any number → the list behind it.

## Journey 8 — Setup (first login, < 5 minutes)
Wizard: business name → currency (PKR) → language → "Do you sort?" (No / 1 stage / 2 stages) → pick category template (Karachi default list, editable) → grade names → add munshi user (phone + PIN). Creates sensible defaults; everything editable later.

## Offline behaviour
Journeys 1–6 work offline: actions are queued with an idempotency key, shown as "Not synced yet" badge, and synced when online. Conflicts (e.g., stock already sold) are shown in Home → "Needs attention".
