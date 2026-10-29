# ThriftOS v1 — Tech Stack and Architecture

## Stack (keep — no rewrite)
| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL 16 | Docker Compose for local |
| ORM | Prisma 5 | Schema + migrations at repo root `prisma/` |
| Backend | NestJS (TypeScript) | `server/` |
| Frontend | Angular 20, standalone components, signals, Tailwind | `thriftos-frontend/` |
| PWA | `@angular/service-worker` + IndexedDB queue | Installable, offline |
| i18n | Runtime translation service (JSON dictionaries `en`, `ur`), RTL support | Urdu default option |
| Tests | Jest (backend unit + e2e with test DB), Angular unit tests for key services | |
| Money | Prisma `Decimal` everywhere; never JS `number` for money | |

## Repository layout (target)
```
prisma/                 schema.prisma, migrations, seed.ts (+ demo seed)
server/src/
  common/               guards, decorators, money utils, idempotency
  auth/ users/ roles/ permissions/ tenant/ superadmin/
  suppliers/            (was procurement/vendor)
  lots/                 containers + lots + charges + landed cost (was procurement/*)
  sorting/              ONE module for stage 1 + stage 2 (merge sorting-stage1, sorting-stage2, sorting-facade)
  stock/                stock items, bales, QR, movements (merge repack + inventory)
  sales/                sales, payments, customers, khata
  costing/              allocation engine (pure functions + service)
  home/                 owner dashboard queries
  reports/              (hidden in v1 UI, keep working)
thriftos-frontend/src/app/
  core/                 auth, tenant, i18n, offline queue, api
  shell/                ONE app shell (bottom tabs on phone, side nav on desktop)
  features/home|receive|sort|stock|sell|khata|settings
  shared/ui/            design system components
docs/v1/                these docs (source of truth)
docs/archive/           old docs and phase prompts (read-only history)
```

## Architecture rules
1. **Tenant isolation**: every query is scoped by `tenantId` from the JWT (TenantGuard). No exceptions.
2. **Controllers are thin**: validate DTO → call service → return. No Prisma calls in controllers.
3. **Costing is pure**: allocation formulas live in `costing/` as pure functions with unit tests; services call them inside a Prisma transaction.
4. **Every write that can come from offline** accepts an `Idempotency-Key` header (table `IdempotencyKey` already exists).
5. **One way to do each thing**: no v1/v2/v3 services side by side. Old code is deleted, not kept "for legacy".
6. **Feature flags per tenant**: `Tenant.enabledModules` (string array) decides which tabs/APIs are visible. Server enforces too.
7. **Money**: `Decimal(14,2)` for amounts, `Decimal(14,4)` for per-kg rates; rounding with largest-remainder so allocated parts sum exactly to the total.
8. **Audit**: important writes (cost change, sale, payment, stock adjustment) go to `AuditLog`.

## Costing engine (v1 definitions)
- **Landed cost (lot)** = purchase cost (in PKR) + sum(charges). Purchase cost is a required field on the lot, not a charge type.
- **Lot allocation within a container**: by lot weight / sum of all lot weights in the container (never by container net weight). Largest-remainder rounding.
- **Sorting outputs**: output cost = lot cost × output kg / total output kg (waste carries zero cost; its resale value, if sold, is income). Stage 2 repeats this on the category output.
- **Bales**: bale cost = sum of (kg taken from each output × that output's cost per kg) (FIFO by default).
- **Direct stock**: cost = purchase cost entered.
- **Sale profit** = line price − line cost.
- **Recalculation**: when a charge is added/changed after sorting, the engine recomputes the whole chain for that lot in one transaction (replaces `scripts/maintenance/recompute-cost-chain.js`). Sold lines keep their cost at time of sale; the difference is posted as a "cost adjustment" for reporting.

## Offline design (frontend)
- Service worker caches the app shell and reference data (categories, grades, customers, suppliers, open lots).
- Writes go through `OfflineQueueService` (IndexedDB): each has `id`, `idempotencyKey`, `endpoint`, `payload`, `status`.
- Sync on reconnect, in order; server returns the stored response for repeated keys.
- Existing `core/operations/offline-draft.service.ts` is the starting point; generalise it.

## Environments and secrets
- `.env` files are never committed. Root `.env` is currently tracked — remove from git index and rotate `JWT_SECRET` and DB password.
- `docker compose up` must start DB + API + web with one command; healthcheck user fixed (currently hard-coded `labur`).
