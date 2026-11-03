# ThriftOS v1.0.0-demo — release notes

**v1 in one line:** a landa business — importer, sorting workshop or bale trader — runs its day from a cheap Android
phone, in Urdu or English, with or without internet, and the owner sees which container and which supplier make money.

## What v1 does

| | |
|---|---|
| **Maal aya** (receive) | A container (supplier, country, invoice weight, price in USD/GBP/EUR/PKR with the dollar rate, duty, clearing, freight, transport, other charges) or a loose lot. Landed cost per kg is shown while typing. Ready stock (bales bought to resell) for traders. |
| **Chhantai** (sort) | Stage 1: category tiles + keypad, 5 seconds per line, undo. Stage 2: grade A / B / C the same way. Closing a lot puts the rest in waste after one question; yield and cost per kg of each category / grade follow. `sortingStages` 0, 1 or 2 per business. |
| **Bales and QR** | Make a bale from a category or grade (cost taken oldest stock first, adds up to the paisa); QR stickers on A4 (3×8) or 50×30 thermal; scan with the phone camera to sell. Open a ready bale into pieces at 2–3 price tiers. |
| **Becho** (sell) | By bale, kg or piece; cash, udhaar or part payment; the customer's last price comes up; bill as a WhatsApp message with a link to a bill page (no login). |
| **Khata** | Who owes what and since how many days; payments by cash, JazzCash, Easypaisa, Raast or bank, with an optional photo; WhatsApp reminder in Urdu or English. |
| **Owner home** | Profit per container (last 5), udhaar owed, stock ready, today's sales and profit; each opens its list; comparison of suppliers and countries by profit per kg and A-grade %. |
| **People** | Owner signs in with email and password; munshi with phone number + 4-digit PIN (locks after 5 wrong tries, owner unlocks). |
| **Phone first** | Installable app (PWA), works offline (entries wait on the phone and are sent once, never twice), Urdu right-to-left with Western digits, 360 px screens, big touch targets. |
| **Setup** | 5-minute wizard with a Karachi template (categories, grades, waste type). |
| **Demo** | `npm run demo:reset` fills a separate database, `thriftos_demo`, with 3 months of a Sher Shah importer and a Lahore trader. Script: [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md). |

Measured (details in [`PROGRESS.md`](PROGRESS.md)): owner home on Slow 3G + 4× slower CPU at 360 px shows its numbers
in about 1.3 s (installed app); Lighthouse mobile 92 performance / 100 accessibility / 100 best practices / PWA installable
([`lighthouse/`](lighthouse/)).

## Turned off in v1 (hidden in the app and refused by the server)

These exist in the code but are not part of v1. The app hides them and the server answers 403 (`MODULE_DISABLED`)
unless the module is in the business's `Tenant.enabledModules`:

| Module | What it switches on |
|---|---|
| `REPORTS` | the detailed reports (yield, cost, inventory, waste, procurement…) and their CSV exports |
| `EXPORT` | export sales |
| `WAREHOUSES` | more than one store |
| `PURCHASE_ORDERS` | purchase orders before the container ships |
| `BILLING` | super admin plans and billing — read from the `SYSTEM` business, since the super admin has none |

An owner turns the first four on under Settings → Advanced → "How the business works" → modules. `BILLING` is switched on
in the database by the platform owner.

## Not in v1 (deferred)

- **FBR e-invoicing** (sales tax integration).
- **Export packs** (export documents, packing lists, export pricing).
- **Payroll** (piece-rate pay for munshis; the `PAYROLL` module name is reserved).
- **Multi-warehouse** stock (transfers between godowns; one store per business in v1).
- Printing straight to a Bluetooth thermal printer (v1 prints from the browser).
- Push notifications, SMS.

## Known limits

- Profit per container is the profit **already made** on what has been sold from it; a container with little sold
  shows little profit. Bales take their cost from the oldest stock of that category / grade first, so a new sale's
  profit can land on an older container.
- The service worker and the camera need HTTPS (or `localhost`). Over plain `http://` on a LAN address the app works
  but does not install, does not work offline and cannot scan — see "Demo on a phone" below.
- Offline: an entry made offline that the server refuses later (e.g. the bale was sold from another phone) shows as
  "needs attention" on the phone; it is not merged automatically.
- The old desktop screens (Settings → Advanced, Receive/Sell "records") are still English-only.
- `docker compose up` was not run while building v1 (no Docker in the build environment); the browser tests run the
  production build with `thriftos-frontend/e2e/serve.mjs`.
- GitHub Actions has not run this workflow yet; every CI step was run locally and passes.

## Before first deploy

1. **Rotate secrets.** An old `.env` is in git history: set a new `JWT_SECRET` and database password. Never commit `.env`.
2. **Change the super admin password** (`superadmin@thriftos.com` / `SuperAdmin@123` comes from the seed) or create
   your own super admin and deactivate this one.
3. **Do not load the demo** into a real database: `npm run demo:reset` only ever writes `thriftos_demo`; keep it that way.
4. **Migrations:** the Docker entrypoint migrates on start only if the database name ends in `_test` or
   `ALLOW_DEV_MIGRATE=1` is set. Set it deliberately in production (or run the migrations yourself, as with
   `scripts/apply-phase*.sh`).
5. **Set** `PUBLIC_APP_URL` (the address in WhatsApp bill links), `CORS_ORIGIN` (if the app and API are on different
   addresses) and serve over **HTTPS** (needed for install, offline and the camera).
6. Use `thriftos-frontend/nginx.conf` (or the same cache headers): `index.html` and `ngsw.json` must never be cached,
   hashed files may be cached for a year.
7. Back up the database daily; khata is money people owe.
8. Decide which modules each business gets (`Tenant.enabledModules`); new businesses get the five v1 modules.

## Demo on a phone

Your laptop runs the app; the phone opens it over your home Wi-Fi.

1. **Fill the demo** (once per demo day): `npm run demo:reset`.
2. **Find the laptop's Wi-Fi address**: Linux `hostname -I`, macOS `ipconfig getifaddr en0`, Windows `ipconfig`
   ("IPv4 Address"). Say it is `192.168.1.20`.
3. **Start the API** on the demo database, with bill links pointing at the laptop:

   ```bash
   cd server && DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/thriftos_demo?schema=public" JWT_SECRET=any-long-secret PUBLIC_APP_URL=http://192.168.1.20:4300 npm start
   ```

4. **Serve the app** (it also passes `/api` to the API, so the phone needs only one address):

   ```bash
   cd thriftos-frontend && npm run build && PORT=4300 API=http://localhost:3000 node e2e/serve.mjs
   ```

5. **On the phone** (same Wi-Fi), open Chrome at `http://192.168.1.20:4300`. If it does not load, allow port 4300
   in the laptop's firewall.
6. **Make it a real app** (install, offline, camera). A plain `http://192.168.…` address is not trusted by Chrome, so
   pick one:
   - **Easiest, no cables:** in Chrome on the phone open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
     enter `http://192.168.1.20:4300`, set it to *Enabled* and tap *Relaunch*. Open the app again, then
     menu ⋮ → **Install app** (or "Add to Home screen").
   - **With a USB cable:** turn on USB debugging on the phone, then on the laptop `adb reverse tcp:4300 tcp:4300`,
     and open `http://localhost:4300` on the phone (localhost counts as secure).
   - **HTTPS tunnel:** run any HTTPS tunnel to port 4300 (e.g. `cloudflared tunnel --url http://localhost:4300`)
     and open the `https://…` address it prints; set `PUBLIC_APP_URL` to that address too.
7. Sign in as `owner@almadina.demo` / `Demo@1234` and follow [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md).

**What to check on a cheap Android phone** (Android 9+, 2–3 GB RAM, Chrome up to date):

- [ ] Home numbers appear in about a second when you open the installed app; nothing jumps after.
- [ ] Urdu reads right-to-left, numbers stay `Rs 45,000` (Western digits, not reversed); the Nastaliq font loads.
- [ ] Every button is easy to hit with a thumb; nothing is cut off or scrolls sideways at the phone's width.
- [ ] Keypad: typing 900 and OK takes under 5 seconds; the phone's own keyboard does not pop up on keypad fields.
- [ ] **Flight mode:** record a sorting line, a sale and a payment; the badge shows 3 waiting; turn Wi-Fi back on —
      they are sent once (check the khata: one payment, not two).
- [ ] **Camera:** Stock → labels → print or show a QR on the laptop screen; Becho → Scan bale finds it.
- [ ] **WhatsApp:** "Share bill" opens WhatsApp with the Urdu text; the bill link opens on another phone
      (it uses `PUBLIC_APP_URL`, so that phone must be on the same Wi-Fi, or use the tunnel address).
- [ ] Munshi sign-in with phone + PIN; 5 wrong PINs lock it; the owner unlocks it in Settings → Team.
- [ ] Close the app fully and reopen with no internet: it still opens and shows the last numbers.
- [ ] Battery and heat after 10 minutes of use; the screen stays readable outdoors at full brightness.
