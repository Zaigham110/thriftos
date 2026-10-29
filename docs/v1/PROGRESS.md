# ThriftOS v1 — Progress log

Running log of the v1 reshape. Newest entries at the bottom of each section.

## Baseline (2026-10-29, before any v1 change)
- Server: `tsc --noEmit` clean, `nest build` clean.
- Frontend: `tsc --noEmit -p tsconfig.app.json` clean; `ng build` succeeds with NG8113 unused-import warnings only.
- Tests: none. No Jest config in `server/`, zero `*.spec.ts` files in either app. `npm --prefix server test` does not exist yet (task 0.3).
- Database: local dev DB (`labur-postgres-dev` container, port 5432) has 23/24 migrations applied (`20260803000000_add_flow_rollout_flag` pending). Left untouched; tests will use a separate `thriftos_test` database.
- Root `.env` was tracked in git and lacks `POSTGRES_PASSWORD`, so `docker compose up` fails interpolation until it is added locally.

## Log
- 2026-10-29 — 0.1 Secrets: `git rm --cached .env` (`.gitignore` already ignores `.env`/`.env.*` except `.env.example`). Compose healthcheck now uses `$${POSTGRES_USER}`/`$${POSTGRES_DB}` instead of hard-coded `labur`; removed obsolete `version` key. README notes that `JWT_SECRET` and the DB password must be rotated because `.env` exists in git history.
- 2026-10-29 — 0.2 Archive docs: moved all of `docs/` except `docs/v1/` into `docs/archive/` (git mv, history kept). Rewrote `.agents/AGENTS.md` as a pointer to `docs/v1/` plus the architecture rules; kept only still-true domain notes (lineage chain, one-time sorting, denormalised lineage ids). Dropped operation modes, `SortingWaste`, and the old 'allocate by container net weight' formula (doc 03 says by lot weight).
- 2026-10-29 — 0.3 Test harness: Jest (ts-jest) in `server/` with two projects — `unit` (`src/**/*.spec.ts`) and `e2e` (`test/**/*.e2e-spec.ts`). E2E global setup runs `prisma migrate reset --force` (with base seed) on a separate `*_test` database (`TEST_DATABASE_URL`, else `DATABASE_URL` + `_test`; refuses any DB not ending in `_test`). `test/e2e/fixtures.ts` creates a tenant + owner with all permissions and logs in. Extracted `configureApp()` (`src/app.setup.ts`) so tests run the same pipes/prefix as `main.ts`. Added `tsconfig.build.json` so specs stay out of `dist/`. Scripts: `test`, `test:unit`, `test:e2e`, `typecheck`. CI: `.github/workflows/ci.yml` (Postgres service, migration-drift check, typecheck, tests, nest build; frontend tsc + ng build).
  - Found: migrations did not produce `schema.prisma` (columns added via `db push`), so `migrate reset` + seed failed on an empty DB. Added `20261029000000_v1_00_catch_up_schema_drift` with `IF NOT EXISTS` guards (no-op on the existing dev DB, which already has these columns). CI now fails on any future drift.
- 2026-10-29 — 0.4 Backend dedupe:
  - `sorting-stage1` + `sorting-stage2` + `sorting-facade` → one `server/src/sorting/` module. Services: `SortSessionService` (stage 1), `GradeSessionService` (stage 2), `SortingWasteService` (waste lines + capacity checks for both stages), `SortingOutputsService`, `GradesService`. Controllers are thin (`@TenantId()` decorator added in `common/decorators`). Kept the facade route shapes (`/sorting/stage-1|stage-2|outputs`) as the single API; removed raw CRUD routes `/sorting/stage1/*`, `/sorting/stage2/*`, `/sorting/grades` (grades CRUD stays at `/admin/grades`, lookups at `/tenant/grades`) and the no-op `outputs/:id/mark-ready`.
  - `repack` (v1 items, v2 allocation service, v3 service, sessions, QR) + `inventory` → one `server/src/stock/` module: `BaleService` (`POST /stock/bales` makes a sealed bale with stock item, movement and QR in one transaction; FIFO by default, manual allocations optional) and `InventoryService` (`/stock/items/*`). Repack sessions are auto-managed (no endpoint). Removed draft/allocate/deallocate/seal endpoints and commented-out FIFO code.
  - Bugs fixed on the way: sorting/grading kg was saved before the over-limit check (now checked and written in one transaction, and outputs + declared waste can't exceed input); v2 FIFO ignored the category filter and only used READY_FOR_REPACK stock; bale costing used JS numbers (now Decimal).
  - Frontend: services repointed (`API_ENDPOINTS.sortingStage1/2`, `bales`, `stockItems`); new `modules/stock/bale.service.ts`; flow `seal` makes a bale in one call. Deleted screens that only used removed endpoints: unrouted `modules/sorting-stage1|2`, desktop `modules/sorting/*` pages (duplicates of flow transform/grade), draft-based `modules/repack/*`, and the lite `sorting` route. Dead nav links repointed to flow screens.
  - Tests: `test/e2e/sort-and-bale.e2e-spec.ts` (sort → grade → FIFO bale → stock item, over-limit rejection, tenant isolation for sorting and `stock/*`).

## Decisions
- Test DB lives on the same Postgres server as dev, named `<db>_test`; never the dev DB.
- Frontend has no specs yet, so CI only typechecks and builds it; frontend unit tests are added with the services they cover (offline queue, i18n).

- Making a bale is one step (no draft) because journey 3 has none; manual stock picking is the optional `allocations` field.
- Bale codes keep the existing `TENANT-CAT-GRADE-YYYYMMDD-NNNN` format for now; short `B-0001` codes come with QR labels (task 3.5).
- Sort/grade cost split is still plain proportional Decimal; largest-remainder rounding arrives with `costing/` in task 1.2.
- Open question for Phase 1/2: tenants with `sortingStages = 1` have no grade outputs, so bales must also be makeable from category outputs (`RepackInputAllocation.gradingOutputId` is required today).

## Blockers
- `JWT_SECRET` and DB password rotation must be done by the owner (old values remain in git history; history rewrite not done because it is irreversible and needs a force-push).
