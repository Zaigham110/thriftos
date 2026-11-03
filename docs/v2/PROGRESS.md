# ThriftOS v2 progress log

## Log
- 2026-11-03 — Starting state: branch `v2-go-live` at `d79d904` (from `v1-reshape` `26f1ae3`, tag `v1.0.0-demo` on GitHub). Server tests 168/168, browser suite 17 passed / 4 skipped (docs screenshots), frontend build had 47 warnings (46 × NG8113, 1 × CommonJS `jsqr`). CI (`.github/workflows/ci.yml`) had never run on GitHub: Actions is enabled for the repo but no run existed for any push.
  - Owner's AWS answers: project Region `ap-southeast-2` (Sydney); guidance level Low.
- 2026-11-03 — 5.0 Housekeeping (part 1, `c3b6475`): removed the unused standalone imports behind all 46 NG8113 warnings (19 files, reports/super-admin/sales pages); `jsqr` allowed as a CommonJS dependency in `angular.json`. The build now has 0 warnings and CI's frontend job fails if any `WARNING` appears. CI also runs on pushes to `v2-go-live`; the push of `v2-go-live` started the first CI run. Playwright's Chromium installed on this Mac (`npx playwright install chromium`). Local results before the push: server 168/168, browser 17 passed / 4 skipped.

## Decisions
- Where the work happens: tests, installs and the build run in the main folder (`/Users/zaigham/Data/me-projects/thriftos`). The agent's own session sits in a worktree it cannot leave and may not edit the main folder's files directly, so it edits and commits on a branch in its worktree, pushes to `origin/v2-go-live`, and fast-forwards `v2-go-live` in the main folder. Every commit and tag therefore ends up in the main folder too.
- Browser tests locally: `PW_DATABASE_URL` = `DATABASE_URL` with the database renamed to `thriftos_pw_test` (the default `thriftos:thriftos` user exists only in CI).

## Owner actions
- **Sign in to AWS again** (the CLI session has expired): run `aws login` in a terminal and finish it in the browser. Needed before 5.1+ can check or create anything in the account.
- **Server details**: the instance type of your free-tier EC2 server (if one exists already), and whether it runs anything today.
- **Domain**: the name you will use (e.g. `thriftos.pk`); buying it is your step (5.5).

## Blockers
- None for 5.0. AWS steps wait for `aws login`.
