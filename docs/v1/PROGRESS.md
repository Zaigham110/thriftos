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

## Decisions

## Blockers
- `JWT_SECRET` and DB password rotation must be done by the owner (old values remain in git history; history rewrite not done because it is irreversible and needs a force-push).
