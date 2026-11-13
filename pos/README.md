# ThriftOS Shop POS

The till for a shop that sells imported bales. It is its own program: its own server, database and sign-in,
separate from ThriftOS (the two share nothing but the name and the plum colour).

It runs in the browser on a laptop, a tablet or a phone, can be installed like an app, keeps selling when the
connection is down, and talks to the shop's receipt printer, cash drawer, sticker printer and scanners.

## What a shop does with it

**Till (opens after sign-in).** Tiles of what is on the shelf, the bill beside them, one Pay button.

- Scan a sticker anywhere on the screen, tap a tile, or type. A closed bale sells whole; an opened bale sells by the
  piece. "Other item" adds things that are not a bale (bags, delivery).
- Tap a line to change price, pieces or give a discount on it. Discount on the whole bill in rupees or percent
  (a cashier is held to the limit the owner set).
- Pay: cash, bank / card, Easypaisa / JazzCash, mixed as needed. What is not paid goes on the chosen customer's
  khata. The screen shows the change to give back. Then Print, WhatsApp, New sale.
- Hold a bill and take it back later on any till of the branch.
- Keyboard tills: F2 search, F4 customer, F8 hold, F9 pay, digits and Enter in the pay sheet, Esc to close.
- A shared till can be locked; each person unlocks it with their own PIN.

**Around the till**

| | |
|---|---|
| Khata | Customers, what each owes, credit limit, receive payment, statement, WhatsApp reminder |
| Bills | The day's bills, search any bill, print again, **return** some lines or pieces (back on the shelf or damaged; refund by cash, bank, wallet or off the khata), cancel a bill |
| Cash drawer | Open with the cash inside, cash in / out / to bank, count and close; expected against counted, shift report |
| Expenses | What was spent, from the drawer or not |
| Stock | Find any bale, open / close / finish, lost or damaged, new prices for many bales, stickers for many bales, **stock check** (scan the shelf, see what is missing) |
| Shipments | Type the shipment once, upload its bale list (Excel / CSV), see what each shipment cost and earned |
| Between branches | Send bales to another branch; they are "on the way" until that branch receives them |
| Reports | Sales, profit, by day / category / grade / cashier / payment, tax, khata, expenses; stock value and age; every shipment; shifts. CSV export |
| Settings | Bill header, sales tax (inside the price or on top, NTN / STRN), discount limit, staff, branches and tills, this device's printer and scanner |

**People:** the **owner** (everything, every branch), **managers** (one branch: returns, cancelling, expenses,
reports, prices, sending stock; cost and profit only if the owner allows) and **cashiers** (sell, khata payments,
drawer; never costs). Cancels, returns, price changes, drawer differences and drawer openings without a sale are kept
in the owner's activity record.

## Hardware

Set up once per device in **Manage → Printer and scanner**. Settings belong to the device, not the shop.

| Thing | How it connects | Where it works |
|---|---|---|
| USB or Bluetooth **scanner** | It types like a keyboard: no setup | Everywhere |
| **Camera** scanning | The camera button on the till and in stock check | Phones and tablets, on an https address |
| **Receipt printer**, direct (ESC/POS, 80 mm or 58 mm, cuts the paper) | USB, Bluetooth, serial / COM | Chrome or Edge, on an https address or on the shop computer itself |
| **Receipt printer**, network | Its address on the shop network (port 9100). The shop server sends the print | Every device, iPhone and iPad too |
| **Receipt printer**, print window | Whatever printer the device has, 80 mm / 58 mm layout | Everywhere (shows the print window each time) |
| **Cash drawer** | Plugged into the receipt printer; opens on cash sales, and with "Open drawer" (recorded) | With a direct or network receipt printer |
| **Sticker printer** | Print window at the sticker size, or direct TSPL (TSC, Xprinter label models) over USB, Bluetooth, serial or network | As for receipt printers |

**Not yet tried on real devices.** The printer, drawer and sticker commands are written to the published ESC/POS and
TSPL command sets and are covered by tests on the exact bytes; network printing is tested against a stand-in printer;
the scanner detection is tested with timed key presses. No real printer, drawer, label printer, scanner or phone
camera was available while building. Before a shop relies on it, do this once on its own hardware: print the test
bill, open the drawer, print the test sticker and scan it at the till, all from Manage → Printer and scanner.

## Working offline

- The app can be installed (browser menu → Install / Add to Home Screen) and opens with no connection.
- Each till keeps a copy of its branch's shelf, customers and settings on the device. If the shop server cannot be
  reached, the till still sells, holds bills, prints, and records cash in / out. A banner says so.
- Every till numbers its own bills (`T1-000147`), so a bill printed offline keeps its number.
- When the server is back the waiting bills are sent in order, each exactly once. A bill that no longer fits (the
  bale was sold at another till meanwhile) is **kept** and shown to the owner under Bills → "Offline bills to check".
- Needs the server: returns, cancelling, new customers, imports, transfers, closing the drawer, reports.
- Browsers allow installing and offline use only on an https address, or on the shop computer itself
  (`http://localhost`). See "https" below.

## Bale list columns

Only **Item** is needed. Other header names are understood too (Description, Pcs, Net Weight, Amount, Retail …),
title rows above the header and a "Total" row below are skipped, and amounts like `Rs 28,000` are read.

| Column | Meaning |
|---|---|
| Bale no | The supplier's number on the bale (each once) |
| Item | What is in the bale |
| Category, Grade, Brand | Used for searching and filtering stock |
| Weight kg | Charges are shared by weight when every bale has one |
| Pieces | Pieces inside (confirmed when the bale is opened) |
| Cost | What the bale cost. Give it for every bale, or for none and type "Cost of goods" on the shipment |
| Bale sale price | Price of the whole bale |
| Piece price | Usual price of one piece |
| Notes | Anything else |

The import screen has a "Download the sample file" link.

## Put it in a shop

Needs Docker on the shop's computer, or on a server the shop's devices can reach.

```bash
cd pos
cp .env.example .env        # then set POSTGRES_PASSWORD and JWT_SECRET to long random texts
docker compose --profile app up -d --build
```

Open `http://<that computer>:8080`. The first person to open it names the shop and becomes its owner; the shop
starts with one branch ("Main shop") and one till (T1). Add branches, tills and staff under Manage.

**https.** On the shop computer itself (`http://localhost:8080`) everything works. Other devices on a plain `http`
address can sell, use scanners, network printers and the print window, but the browser will not let them use USB /
Bluetooth printers, the camera, or offline mode. For those, put https in front:

```bash
# in .env: POS_DOMAIN=shop.example.com   (a name that points at this computer)
docker compose --profile app --profile https up -d --build
```

A public name gets a real certificate by itself. For a name that exists only on the shop network, also set
`POS_HTTPS_FLAGS=--internal-certs`; each device then has to trust the certificate once.

**Backup.** The data lives in the Docker volume `pos_data`:
`docker exec thriftos-pos-db pg_dump -U pos thriftos_pos > backup.sql`.

One install is one business, with as many branches and tills as it needs.

## Work on it

```bash
cd pos && docker compose up -d db          # its own Postgres on port 5434
cd server && cp .env.example .env          # point DATABASE_URL at a database whose name ends in _test
npm install && npx prisma migrate dev && npm run start:dev    # API on :3100
cd ../web && npm install && npm start      # screens on :4300, /api goes to :3100
```

- `cd server && npm test`: reading bale lists, sharing costs, and whole shop days against a real database (setup,
  import, bale and piece sales, split payments, khata, tax, drawer shift, returns, cancelling, held bills, branches
  and transfers, offline bills, stock check, reports, network printing, PINs, roles). **They empty the database
  first**, so they refuse to run on a database whose name does not end in `_test`.
- `cd web && npm run test:hardware`: receipt (ESC/POS) and sticker (TSPL) bytes, scanner detection.
- `server/` NestJS + Prisma (PostgreSQL). Money is Prisma Decimal only; every row and query carries `tenantId`;
  stock, tills, shifts and bills also carry `branchId`.
- `web/` Angular + Tailwind. `hardware/` printers and scanners, `offline/` the device's copy and its outbox,
  `ui/` sheet, number pad, icons, print host, `pages/` the screens.

## Not built yet

Urdu screens, a customer-facing display, weighing scales, loyalty points, price lists per customer, FBR invoice
posting, and returns or new customers while offline.
