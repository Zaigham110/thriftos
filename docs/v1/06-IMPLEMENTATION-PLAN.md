# ThriftOS v1 — Implementation Plan

Branch: `v1-reshape` (snapshot of previous work: branch `snapshot/pre-v1-reshape`).
Work phase by phase, in order. Each task ends with: typecheck clean (server + frontend), tests green, app runs, a commit with a clear message. Tick boxes here as tasks finish.

## Phase 0 — Clean foundation (week 1)
- [x] 0.1 Secrets: remove root `.env` from git index (`git rm --cached .env`), confirm `.gitignore`, add note in README to rotate `JWT_SECRET` and DB password. Fix docker-compose healthcheck user (`labur` → `${POSTGRES_USER}`).
- [x] 0.2 Archive docs: move everything in `docs/` except `docs/v1/` into `docs/archive/`. Replace `.agents/AGENTS.md` content with a pointer to `docs/v1/` + the architecture rules (keep its useful schema notes only if still true).
- [x] 0.3 Test harness: Jest config for `server/` (unit + e2e against a separate test database via docker), `npm test` works in CI-style run. Add a GitHub Actions workflow: install, prisma generate, typecheck, test, frontend build.
- [x] 0.4 Backend dedupe: merge `sorting-stage1`, `sorting-stage2`, `sorting-facade` into one `sorting` module with services holding all logic (controllers thin). Merge repack v1/v2/v3 into one `stock`/bale service (keep v2 allocation logic). Delete dead code and commented-out endpoints.
- [x] 0.5 Frontend: one app shell. Keep the best screens from `features/simplified-mode` and `features/flow` as the base for the phone UI; desktop ERP modules become the owner/admin views. Delete `features/legacy`, the duplicate shells and routes (`/app/lite`, `/app/flow`, `/app/mobile/*`), `flow-enabled.guard`. Routes become `/home, /receive, /sort, /stock, /sell, /khata, /settings`.
- Acceptance: app builds and runs with one shell; no route or service duplicates; tests run (even if few).

## Phase 1 — Correct money (week 2)
- [x] 1.1 Data model per `04-DATA-MODEL.md` sections Tenant, Container, Rag, ChargeType, money precision (migrations + data migrations). Remove `IncomingBale`, `RepackItem`, `SortingWaste` with data migration.
- [x] 1.2 `costing/` pure functions: landed cost, allocate-by-weight with largest-remainder rounding, stage outputs, bale cost (FIFO), sale profit. 100% unit-test coverage for this folder, including edge cases (zero weight, single lot, remainder pennies, USD with FX).
- [x] 1.3 Recalculation: changing a charge or purchase cost re-runs the chain for that container in one transaction; delete `server/scripts/maintenance/recompute-cost-chain.js` after parity is proven by a test.
- [x] 1.4 E2E test: container → 3 lots → sort (2 stages) → bales → sale; assert totals match to the paisa at every step.
- Acceptance: sum of costs at every stage equals landed cost exactly; tests prove it.

## Phase 2 — Direct stock, sales, khata (weeks 3–4)
- [ ] 2.1 `InventoryItem` changes (optional repack/category/grade, `source`, `unit`, `quantity`, `unitCost`, `salePrice`, `parentItemId`). Receive "Ready stock" endpoint + "Open bale into pieces" endpoint.
- [ ] 2.2 Customer simplification (name required, phone, city, opening balance). Payment changes (customer-level, method enum, attachment upload to local disk/S3-compatible storage).
- [ ] 2.3 Sale flow: LOCAL type default, CASH/CREDIT/PARTIAL, last-price default, sell by kg/bale/piece, stock deduction + movement, profit per line.
- [ ] 2.4 Khata service: balances, ledger lines, overdue days; WhatsApp links (`https://wa.me/<phone>?text=...`) for bill and reminder, Urdu/English templates; public bill page by `billToken` (read-only, no login).
- [ ] 2.5 Tests for sale, payment, ledger balance, direct stock.
- Acceptance: a trader with `sortingStages = 0` can buy ready stock, sell on credit, take payment and see the correct balance.

## Phase 3 — Floor app and owner home (weeks 4–6)
- [ ] 3.1 PWA: `@angular/service-worker`, manifest, icons, install prompt; cache reference data.
- [ ] 3.2 Offline queue (IndexedDB) for receive, sort line, bale, sale, payment; idempotency keys honoured by the server for these endpoints; sync badge; conflict list in Home.
- [ ] 3.3 i18n service with `en.json` and `ur.json`, RTL switch, Urdu fonts; all v1 screens translated.
- [ ] 3.4 Screens per `02-APP-FLOW.md` journeys 1–8 following `05-UI-UX-GUIDELINES.md` (tiles, keypad, bottom action bar).
- [ ] 3.5 QR: generate label (code, grade/category, kg, origin, tenant name) as printable A4 sheet (e.g., 3×8) and 50×30mm thermal layout; camera scan to open a bale or add it to a sale.
- [ ] 3.6 Owner home endpoint + screen: profit per container (last N), profit and A-grade % by supplier/origin, udhaar owed + top 5, stock ready, today's sales.
- [ ] 3.7 Phone + PIN login for munshi users (owner keeps email/password).
- [ ] 3.8 Setup wizard (journey 8) with Karachi category/grade template.
- Acceptance: journeys 1–8 work on a 360px-wide screen, in Urdu and English, offline for 1–6.

## Phase 4 — Demo ready (weeks 7–8)
- [ ] 4.1 Demo seed (`prisma/seed-demo.ts`): tenant "Al-Madina Traders (Demo)", 3 suppliers (USA, UK, Korea), 6 containers over 3 months with realistic PKR costs, duty and clearing, sorting with yields that differ by origin (e.g., USA 18% A grade, Korea 10%), 120 bales, 15 customers in Karachi/Lahore/Peshawar with udhaar, 60 sales, payments.
- [ ] 4.2 Performance: owner home < 2 s on throttled "Slow 3G" in Chrome devtools; bundle budgets in `angular.json`.
- [ ] 4.3 Playwright smoke test of the 5-minute demo path on a mobile viewport.
- [ ] 4.4 README rewrite: what ThriftOS is, run with `docker compose up`, demo logins, how to reset demo data.
- [ ] 4.5 Hide (feature-flag) non-v1 modules: reports, export, warehouses, purchase orders, super-admin billing screens.
- Acceptance: full demo (container → sort → bale → credit sale → payment → profit on home) in under 5 minutes on a phone.

## Later (not v1)
FBR e-invoicing (PRAL/licensed integrator) · export pack + EU bale records · piece-rate payroll from sorting kg · multi-warehouse transfers · buyer portal · billing/subscriptions.
