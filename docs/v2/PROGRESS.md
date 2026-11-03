# ThriftOS v2 progress log

## Log
- 2026-11-03 — Starting state: branch `v2-go-live` at `d79d904` (from `v1-reshape` `26f1ae3`, tag `v1.0.0-demo` on GitHub). Server tests 168/168, browser suite 17 passed / 4 skipped (docs screenshots), frontend build had 47 warnings (46 × NG8113, 1 × CommonJS `jsqr`). CI (`.github/workflows/ci.yml`) had never run on GitHub: Actions is enabled for the repo but no run existed for any push.
  - Owner's AWS answers: project Region `ap-southeast-2` (Sydney); guidance level Low.
- 2026-11-03 — 5.0 Housekeeping (part 1, `c3b6475`): removed the unused standalone imports behind all 46 NG8113 warnings (19 files, reports/super-admin/sales pages); `jsqr` allowed as a CommonJS dependency in `angular.json`. The build now has 0 warnings and CI's frontend job fails if any `WARNING` appears. CI also runs on pushes to `v2-go-live`; the push of `v2-go-live` started the first CI run. Playwright's Chromium installed on this Mac (`npx playwright install chromium`). Local results before the push: server 168/168, browser 17 passed / 4 skipped.
- 2026-11-03 — 5.0 Housekeeping done: CI green on `v2-go-live` (`d00d2c2`: server, frontend, browser). The first run had failed only on the Urdu demo journey: `getByText('لاٹ بند')` ("lot closed") also matched the close-lot button and its confirm text, which contain the same words; the test now finds the heading by role. `v1-reshape` fast-forwarded to `v2-go-live` so PR #2 (`v1-reshape` → `main`, opened earlier) runs CI on passing code; the owner merges it. Repository setting "Allow auto-merge" turned on (owner's OK); auto-merge itself needs required checks on `main`, which the owner did not want yet.
- 2026-11-03 — 5.1 Production config:
  - `docker-compose.prod.yml`: `postgres:16-alpine` (shared_buffers 128MB, max_connections 30, no published port), `server` and `web` pulled from GHCR as `ghcr.io/zaigham110/thriftos-{server,web}:${THRIFTOS_TAG}` (built in 5.2), `caddy:2-alpine` (HTTPS from Let's Encrypt, `/api/*` → server, the rest → web). Memory limits 256 / 384 / 48 / 96 MB (≈ 784 MB of 1 GB; the 2 GB swap file comes with the server setup script in 5.2). Log rotation (10 MB × 3) on every container. Payment screenshots on a named volume (`UPLOAD_DIR=/data/uploads`). Server health check on `/api/health`.
  - `deploy/Caddyfile`: HSTS, nosniff, frame deny, referrer policy, camera allowed for the app itself only, `Server` header removed, `/api/docs` answered 404, JSON access logs. Validated with `caddy validate`; the compose file with `docker compose config`.
  - `deploy/env.prod.example`: template for `/opt/thriftos/.env.prod` (domain, ACME email, tag, Postgres, new `JWT_SECRET`, `CORS_ORIGIN` = the app address only, `PUBLIC_APP_URL`). Secrets are generated on the server, which closes "rotate secrets".
  - Migrate switch renamed `ALLOW_DEV_MIGRATE` → `RUN_MIGRATIONS_ON_START` for the container (production 1). Without it the entrypoint migrates only a `*_test` database and otherwise starts without migrating (it used to exit). The local `npm run db:*` guard keeps `ALLOW_DEV_MIGRATE`. The entrypoint no longer runs `prisma generate` on every start (the image already has the client).
  - API: `TRUST_PROXY` (number of proxies; production 1) so rate limits and the audit log see the client's IP, not Caddy's; Swagger is off when `NODE_ENV=production` unless `ENABLE_SWAGGER=1`. Unit tests in `server/src/app.setup.spec.ts`. CORS was already limited to `CORS_ORIGIN` in production. No cookies are used (tokens travel in headers), so there are no cookie flags to set.

## Decisions
- Where the work happens: tests, installs and the build run in the main folder (`/Users/zaigham/Data/me-projects/thriftos`). The agent's own session sits in a worktree it cannot leave and may not edit the main folder's files directly, so it edits and commits on a branch in its worktree, pushes to `origin/v2-go-live`, and fast-forwards `v2-go-live` in the main folder. Every commit and tag therefore ends up in the main folder too.
- Production runs Caddy in front of nginx (`web`) and the API: Caddy only does HTTPS, headers and routing; nginx keeps the cache rules from v1 4.2.
- Browser tests locally: `PW_DATABASE_URL` = `DATABASE_URL` with the database renamed to `thriftos_pw_test` (the default `thriftos:thriftos` user exists only in CI).

## Owner actions
- **Sign in to AWS again** (the CLI session has expired): run `aws login` in a terminal and finish it in the browser. Needed before 5.1+ can check or create anything in the account.
- **Server details**: the instance type of your free-tier EC2 server (if one exists already), and whether it runs anything today.
- **Domain**: the name you will use (e.g. `thriftos.pk`); buying it is your step (5.5).

## Blockers
- None for 5.0. AWS steps wait for `aws login`.
