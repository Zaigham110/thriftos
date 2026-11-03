# ThriftOS

**ThriftOS runs a landa (used-clothing) business from a phone.** It is made for container importers, sorting
workshops and bale traders in Karachi, Lahore and Peshawar.

- **Maal aya** — a container or a lot arrives: supplier, weight, price, duty and clearing. ThriftOS works out
  the landed cost per kg.
- **Chhantai** — the munshi taps a category, types the kg, and moves on. Grading into A / B / C works the same way.
  When the lot is closed you see the yield and the cost per kg of every grade.
- **Bales** — make a bale, print its QR sticker, scan it when you sell.
- **Becho** — sell by bale, kg or piece, cash or udhaar, and send the bill on WhatsApp.
- **Khata** — who owes what, since when, and a WhatsApp reminder in Urdu or English.
- **Home** — the owner sees profit per container, udhaar owed, stock ready and today's sales, and which
  supplier and country give the best profit per kg.

It works in **Urdu and English**, on a cheap Android phone, and **without internet**: entries are kept on the phone
and sent when the connection comes back. A trader who does not sort can switch sorting off and only buy and sell.

The docs are in [`docs/v1/`](docs/v1/README.md) (start there). What is in v1 and what is not:
[`docs/v1/V1-RELEASE-NOTES.md`](docs/v1/V1-RELEASE-NOTES.md). A 5-minute demo for an owner:
[`docs/v1/DEMO-SCRIPT.md`](docs/v1/DEMO-SCRIPT.md). Screens: [`docs/v1/screenshots/`](docs/v1/screenshots/README.md).

## Try the demo

The demo is a separate database, `thriftos_demo`, with two businesses already full of data (3 months, 6 containers,
120 bales, 15 customers, 60 sales — today's sales included):

| Who | Sign in with |
|---|---|
| Owner, **Al-Madina Traders (Demo)**, Karachi | `owner@almadina.demo` / `Demo@1234` |
| Munshi of Al-Madina (Munshi tab: phone + PIN) | `0300 7860786` / PIN `1234` |
| Owner, **Lahore Bale House (Demo)** — a trader who does not sort | `owner@lahorebales.demo` / `Demo@1234` |
| Super admin (all businesses) | `superadmin@thriftos.com` / `SuperAdmin@123` |

You need Node.js 20+ and PostgreSQL 16 (or the Postgres from `docker compose up -d postgres`).

```bash
cp .env.example .env          # then set DATABASE_URL and JWT_SECRET
npm ci && npm --prefix server ci && npm --prefix thriftos-frontend ci
npm run demo:reset            # (re)creates thriftos_demo and fills it — about 40 seconds
```

`npm run demo:reset` uses the Postgres server in your `DATABASE_URL` but only ever touches the database
`thriftos_demo`; your own database is not changed. Run it again any time to start the demo fresh.

Then start the app on the demo database (two terminals):

```bash
cd server && DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/thriftos_demo?schema=public" JWT_SECRET=any-long-secret PUBLIC_APP_URL=http://localhost:4300 npm start
```

```bash
cd thriftos-frontend && npm run build && PORT=4300 API=http://localhost:3000 node e2e/serve.mjs
```

Open <http://localhost:4300>. To use it on your phone over Wi-Fi, see
[`docs/v1/V1-RELEASE-NOTES.md` → "Demo on a phone"](docs/v1/V1-RELEASE-NOTES.md#demo-on-a-phone).

## Run it with Docker

`docker compose up` starts the database, the API and the web app together.

```bash
cp .env.example .env
```

In `.env`, set `POSTGRES_PASSWORD`, `JWT_SECRET` and a matching `DATABASE_URL`, and add `RUN_MIGRATIONS_ON_START=1`. That
lets the server container set up its own database when it starts; the local `npm run db:*` scripts ignore it.
Then:

```bash
docker compose up -d --build
```

The app is on <http://localhost:4200>, the API on <http://localhost:3000/api>. The first sign-in is the super admin
(only if `SEED_DATABASE=true` was set for the first start); create a business there, and its owner gets the setup
wizard. (This Docker setup was not run while building v1 — the browser tests use the steps above.)

## Develop

```bash
npm ci && npm --prefix server ci && npm --prefix thriftos-frontend ci
npm --prefix server run build
cd server && npm run start:dev                    # API on :3000
cd thriftos-frontend && npm start                 # app on :4200 (no offline mode in dev)
```

Tests (they use databases whose names end in `_test`, never yours):

```bash
cd server && npm test                             # unit + API tests (TEST_DATABASE_URL or <your db>_test)
cd thriftos-frontend && npm run e2e               # phone-size browser tests (thriftos_pw_test)
cd thriftos-frontend && npm run e2e:demo          # the demo, in Urdu and English (thriftos_demo)
npm run test:db-guard                             # the guard that keeps tests away from your database
```

## Release

```bash
bash scripts/check-before-release.sh              # all tests and builds, on the Mac (about 5 minutes)
git tag -a v1.2.0 -m "what changed" && git push origin v1.2.0
```

Pushing the tag is the only thing that runs on GitHub (`.github/workflows/release.yml`): it tests again, builds the
images, publishes the release, and the server deploys it by itself within about 2 minutes (backup, health check,
automatic rollback). Live at https://dyit6jcdpteuk.cloudfront.net/thriftos. Roll back by marking an older release
as "Latest" on GitHub.

Migrations and seeds refuse any database whose name does not end in `_test` (see `scripts/db-guard.js`).
Your own database is changed only by the `scripts/apply-phase*.sh` scripts, which you run yourself.

## Repository

```text
prisma/              schema, migrations, base seed, data checks (prisma/checks/*.sql)
server/              NestJS API (server/src/demo has the demo seed)
thriftos-frontend/   Angular app (PWA), browser tests in e2e/
scripts/             apply-phase*.sh, demo-reset.mjs, db-guard.js
docs/v1/             what v1 is, how it works, progress log — the source of truth
```

Never commit `.env` files. An older `.env` was committed to git history: rotate `JWT_SECRET` and the database
password before any shared or production use (see "Before first deploy" in the release notes).
