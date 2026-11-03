#!/usr/bin/env bash
# Everything to run on the Mac before pushing a release tag (GitHub then repeats the quick part and deploys).
# Usage (from repo root):  bash scripts/check-before-release.sh
# Uses only *_test databases on the Postgres in your .env (thriftos_test, thriftos_pw_test); your own
# database is not touched.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; [ -f .env ] && . ./.env; set +a
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set (root .env) — stopping."; exit 1; }
with_db() { printf '%s' "$DATABASE_URL" | sed -E "s#/([^/?]+)(\?|$)#/$1\2#"; }
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$(with_db thriftos_test)}"
export PW_DATABASE_URL="${PW_DATABASE_URL:-$(with_db thriftos_pw_test)}"

echo "== 1/4 Dev-DB guard"
npm run --silent test:db-guard

echo "== 2/4 Server: typecheck and tests"
npm --prefix server run --silent typecheck
npm --prefix server test

echo "== 3/4 Frontend: dictionaries, typecheck, build without warnings"
(cd thriftos-frontend && npm run --silent i18n:check && npx tsc --noEmit -p tsconfig.app.json)
log="$(mktemp)"
(cd thriftos-frontend && npm run build) 2>&1 | tee "$log"
if grep -q 'WARNING' "$log"; then echo "!! The Angular build has warnings (see above)."; rm -f "$log"; exit 1; fi
rm -f "$log"

echo "== 4/4 Browser tests (phone size)"
npm --prefix server run --silent build
(cd thriftos-frontend && npm run e2e)

echo
echo "All checks passed. Release with:  git tag -a vX.Y.Z -m '...' && git push origin vX.Y.Z"
