#!/usr/bin/env bash
# Applies the v1 Phase 1 migrations to your local dev DB, safely.
# Usage (from repo root):  bash scripts/apply-phase1.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${CONTAINER:-labur-postgres-dev}"
set -a; [ -f .env ] && . ./.env; set +a
# Prefer the user/db in DATABASE_URL (what the app actually uses), then POSTGRES_*, then defaults.
URL_USER="$(printf '%s' "${DATABASE_URL:-}" | sed -nE 's#^postgres(ql)?://([^:/@]+).*#\2#p')"
URL_DB="$(printf '%s' "${DATABASE_URL:-}" | sed -nE 's#^postgres(ql)?://[^/]+/([^?]+).*#\2#p')"
DB_USER="${URL_USER:-${POSTGRES_USER:-thriftos}}"
DB_NAME="${URL_DB:-${POSTGRES_DB:-thriftos}}"
# Only the owner runs this, in a terminal. A non-interactive run (an agent, CI, a script)
# against a database whose name does not end in _test is refused.
if [ ! -t 0 ] && [[ "$DB_NAME" != *_test ]]; then
  echo "Refusing: $DB_NAME is not a *_test database and this is not an interactive terminal. Run it yourself."
  exit 1
fi
BACKUP="$HOME/thriftos-pre-phase1-$(date +%Y%m%d-%H%M%S).dump"

echo "== 1/6 Backup  ($CONTAINER, db=$DB_NAME, user=$DB_USER) -> $BACKUP"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP"
[ -s "$BACKUP" ] || { echo "Backup is empty — stopping."; exit 1; }
echo "   backup OK ($(du -h "$BACKUP" | cut -f1))"

echo "== 2/6 Apply migrations"
if ! npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo
  echo "!! Migration failed. Do NOT retry. Restore your backup with:"
  echo "   docker exec -i $CONTAINER pg_restore -U $DB_USER -d $DB_NAME --clean < \"$BACKUP\""
  exit 1
fi

echo "== 3/6 Build server (regenerates Prisma client)"
npm --prefix server run build

echo "== 4/6 Cost recompute — DRY RUN (nothing written)"
npm --prefix server run costing:recompute

read -r -p "== 5/6 Write the recalculated costs now? [y/N] " ok
if [[ "$ok" =~ ^[Yy]$ ]]; then
  APPLY=1 npm --prefix server run costing:recompute
else
  echo "   skipped — run later with: APPLY=1 npm --prefix server run costing:recompute"
fi

echo "== 6/6 Cost chain check ((0 rows) = everything adds up)"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < prisma/checks/cost-chain-check.sql

echo
echo "Done. Backup kept at: $BACKUP"
