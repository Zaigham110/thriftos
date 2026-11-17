# ThriftOS Shop POS

The till for a shop that sells imported bales. It is its own program: its own server, database and sign-in,
separate from ThriftOS (the two share nothing but the name and the plum colour).

It runs in the browser on a laptop, a tablet or a phone, can be installed like an app, keeps selling when the
connection is down, and talks to the shop's receipt printer, cash drawer, sticker printer and scanners.

## What a shop does with it

**Till (opens after sign-in).** Tiles of what is on the shelf, the bill beside them, one Pay button.

- Scan a sticker anywhere on the screen, tap a tile, or type. A closed bale sells whole; an opened bale sells by the
  piece. "Other item" adds things that are not a bale (bags, delivery).
- Whole bales of the same kind share one code (`JEANS-1-45`) and one tile with a count. Scanning the code again adds
  one more; the oldest bales are sold first. See "Shared bale codes".
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
| Bills | The day's bills, search any bill, print again, cancel a bill. **Take a return**: by the bill, or by the goods when the customer has no bill; money back, off the khata, or an exchange for other goods. The day's returns and a return slip |
| Cash drawer | Open with the cash inside, cash in / out / to bank, count and close; expected against counted, shift report |
| Expenses | What was spent, from the drawer or not |
| Stock | One row per code with quantity, kg and value; a row opens the bales behind it. Find any bale, open / close / finish, lost or damaged, new prices for many bales, stickers for many bales, **stock check** (scan the shelf, see what is missing) |
| Shipments | Type the shipment once, upload its bale list (Excel / CSV) in the supplier's currency, see what each shipment cost and earned. Or add a few bales by hand, without a list |
| Between branches | Send bales to another branch; they are "on the way" until that branch receives them |
| Reports | Sales, profit, by day / category / grade / cashier / payment, tax, khata, expenses; stock value and age; every shipment; shifts. CSV export |
| Back to supplier | Bad bales sent back to the supplier, and what each supplier still owes for them |
| Settings | Currency (the shop's own, the suppliers' usual one, live or typed rates), bill header, sales tax (inside the price or on top, NTN / STRN), discount limit, staff, branches and tills, this device's printer and scanner |

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
| **Sticker printer** | Print window at the sticker size (barcode of the shared code), or direct TSPL (TSC, Xprinter label models) over USB, Bluetooth, serial or network | As for receipt printers |

**Not yet tried on real devices.** The printer, drawer and sticker commands are written to the published ESC/POS and
TSPL command sets and are covered by tests on the exact bytes; network printing is tested against a stand-in printer;
the scanner detection is tested with timed key presses. No real printer, drawer, label printer, scanner or phone
camera was available while building. Before a shop relies on it, do this once on its own hardware: print the test
bill, open the drawer, print the test sticker and scan it at the till, all from Manage → Printer and scanner.

## Shared bale codes

Bales with the same category, grade, weight and pieces are one **kind** and share one code. Every bale is still its
own record behind it, with its own number (`B-00012`), cost and shipment.

- The code reads `CATEGORY-GRADE-KG`: `JEANS-1-45`. Counted in pieces it ends in P (`JEANS-1-200P`), with both
  `JEANS-1-45-200P`, without a grade `JEANS-45`. Latin letters and digits, upper case; "Grade A" reads as A; a name
  with no Latin letters reads as K. A bale with no category goes by its item name. 45 kg and 45.5 kg are two kinds.
- If two different kinds would read the same, the later one ends in `-2`, `-3`… A code never changes once made, even
  if the category is renamed. Codes are unique per business.
- All stickers of a kind are the same: the shared code as text and barcode. A sticker printed earlier with the
  bale's own number still scans, and means that very bale.
- A shared code scanned or typed means the kind: the oldest whole bale of this branch, and one more each time.
- A bill line can be "kind × quantity". The server takes the oldest bales and keeps one line per bale, so cost,
  profit, khata, cancel and return work per bale. If fewer are in stock it sells nothing: "Only 2 of JEANS-1-45 in
  stock". Bills and printouts show one row per kind and price (`JEANS-1-45 x 5`).
- An opened bale carries the same sticker as its closed siblings, so a scan always means a whole bale; pieces are
  sold by tapping the opened bale's own tile.
- Stock check: each scan of a shared code counts the next bale of that kind.
- Bales saved before this get their code when the server starts, by the same rule.

## Currency

Every price, bill and report is in the shop's own currency, set once in **Manage → Currency** (PKR to start with).

- A supplier's list is often in another currency. On import the app reads which one from the file (`$`, `£`,
  `GBP`, a header such as "Cost (USD)", a line such as "All prices in GBP"); the owner can choose another.
- The rate into the shop's currency is today's rate, fetched with one tap (or by itself, when Currency is set to
  "Today's rate"), or typed by hand: the rate actually paid. A list in another currency cannot be saved without one.
- Only the supplier's costs are converted. Charges (freight, duty…) and selling prices are typed in the shop's
  currency. Each bale keeps its cost as it was on the list, and the shipment keeps the currency and the rate.
- Today's rate comes from the public service open.er-api.com, through the shop server, kept for an hour. Only the
  currency code is sent. If it cannot be reached, the rate is typed by hand. (`POS_RATES_URL` points the server at
  another service with the same answer shape.)

## Stock by hand

**Stock → Add stock**: for a local purchase, opening stock or a few bales without a list. One row is one kind of
bale and how many of it; currency, rate, shared codes and costs work as for an imported list. It is saved as a
shipment marked "by hand".

## Returns, exchanges, back to the supplier

- **Take a return** (Bills, or "Return" on the till; managers and the owner): scan or type the bill number. With no
  bill, scan the sticker on the goods: the app lists the bills that sold that kind (or that very bale, for a
  bale's own number), newest first, and the right one is chosen with the customer.
- On the bill: choose what comes back, whether it goes back on the shelf or is damaged, and how it is settled:
  cash, bank, wallet, off the khata, or **an exchange for other goods**.
- **Exchange**: the new goods are chosen on the till. What came back pays first; the customer pays only the
  difference, or gets it back in cash. The return and the new bill are saved together or not at all. An exchange
  needs the connection, and an exchange bill is not cancelled (a return on it gives its worth back).
- Bills → Returns lists the day's returns with what was given back and how; each return prints a slip.
- **Back to supplier** (owner): Stock → Choose bales → Back to supplier. The bales leave the shelf and the supplier
  owes the shop for them (what they cost, or an amount typed) until it is settled in Manage → Back to supplier. A
  return made by mistake can be undone while it is not settled.

## Working offline

- The app can be installed (browser menu → Install / Add to Home Screen) and opens with no connection.
- Each till keeps a copy of its branch's shelf, customers and settings on the device. If the shop server cannot be
  reached, the till still sells, holds bills, prints, and records cash in / out. A banner says so.
- Every till numbers its own bills (`T1-000147`), so a bill printed offline keeps its number.
- When the server is back the waiting bills are sent in order, each exactly once. A bill that no longer fits (the
  bale was sold at another till meanwhile) is **kept** and shown to the owner under Bills → "Offline bills to check".
- Needs the server: returns and exchanges, live rates, cancelling, new customers, imports, transfers, closing the drawer, reports.
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

## On AWS

A copy runs at `https://d18vg2xmnvrhqp.cloudfront.net` (Sydney, `ap-southeast-2`), apart from the ThriftOS server:

- One `t4g.micro` server (`thriftos-pos`, Ubuntu 24.04 ARM, 16 GB disk, Elastic IP) running
  `deploy/docker-compose.aws.yml` in `/opt/thriftos-pos`: the app, its Postgres and Caddy. Secrets were made on the
  server (`/opt/thriftos-pos/.env`, mode 600) and are nowhere else.
- CloudFront distribution `EQ6LWI7901EO1` gives the https address. The server's port 80 is open to CloudFront only,
  and Caddy (`deploy/Caddyfile`) also wants CloudFront's secret header. No SSH port; reach the server with AWS
  Systems Manager.
- A new version: build the image for the server's chip (`docker buildx build --platform linux/arm64 -t
  thriftos-pos:aws --load .`), `docker save thriftos-pos:aws | gzip`, upload it as `image.tar.gz` to the bucket
  `thriftos-pos-deploy-<account>` (files there are removed after a day), then on the server load it and run
  `docker compose -f docker-compose.aws.yml up -d`.
- Network receipt printers (an address on the shop's own network) cannot be reached from AWS. Use a USB / Bluetooth
  printer or the print window with this copy.
- There is no automatic backup yet. By hand, on the server:
  `docker exec thriftos-pos-db-1 pg_dump -U pos thriftos_pos > /opt/thriftos-pos/backups/backup.sql`.

## Work on it

```bash
cd pos && docker compose up -d db          # its own Postgres on port 5434
cd server && cp .env.example .env          # point DATABASE_URL at a database whose name ends in _test
npm install && npx prisma migrate dev && npm run start:dev    # API on :3100
cd ../web && npm install && npm start      # screens on :4300, /api goes to :3100
```

- `cd server && npm test`: reading bale lists, sharing costs, and whole shop days against a real database (setup,
  import (also in another currency, and by hand), live rates, shared codes and selling a quantity of a kind, exchanges, returns to a supplier, bale and piece sales, split payments, khata, tax, drawer shift, returns, cancelling, held bills, branches
  and transfers, offline bills, stock check, reports, network printing, PINs, roles). **They empty the database
  first**, so they refuse to run on a database whose name does not end in `_test`.
- `cd web && npm run test:hardware`: receipt (ESC/POS) and sticker (TSPL) bytes, scanner detection, stickers and bill rows of
  shared codes.
- `server/` NestJS + Prisma (PostgreSQL). Money is Prisma Decimal only; every row and query carries `tenantId`;
  stock, tills, shifts and bills also carry `branchId`.
- `web/` Angular + Tailwind. `hardware/` printers and scanners, `offline/` the device's copy and its outbox,
  `ui/` sheet, number pad, icons, print host, `pages/` the screens.

## Not built yet

Urdu screens, a customer-facing display, weighing scales, loyalty points, price lists per customer, FBR invoice
posting, and returns or new customers while offline.
