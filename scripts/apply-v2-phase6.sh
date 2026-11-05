#!/usr/bin/env bash
# Applies the v2 Phase 6 migrations and base data to your local dev DB, safely. (Production does this
# by itself when a release starts.)
# Usage (from repo root):  bash scripts/apply-v2-phase6.sh
#
# New migrations (only add; nothing existing is changed or removed):
#   1. 20261105100000_v6_01_imports     ImportedRow table (which register rows were already imported, so a file
#                                        uploaded twice adds nothing)
#   2. 20261106100000_v6_04_first_week  Tenant.firstWeekHiddenAt (the owner hid the first-week checklist on Home)
#   3. 20261107100000_v6_06_sort_grade_bale  Category.baleWeightKg, CategoryOutput.gradeId + entryBales, stock source
#                                        KAT; the "made-here stock has an origin" check also accepts kat from its lot
#   4. 20261108100000_v6_07_container_status  data only: containers whose lots are being sorted move from
#                                        "on the way"/"arrived" to "cleared" (dates filled in if empty)
# Data step: base data (server/src/bootstrap): adds data.import and gives every Admin (owner) role all permissions.
# Idempotent; nothing else changes.
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${CONTAINER:-labur-postgres-dev}"
ENV_FILE="${ENV_FILE:-.env}"   # override only to rehearse against another database
set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set (root .env) — stopping."; exit 1; }
# The user and database the app actually uses come from DATABASE_URL.
DB_USER="$(printf '%s' "$DATABASE_URL" | sed -nE 's#^postgres(ql)?://([^:/@]+).*#\2#p')"
DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -nE 's#^postgres(ql)?://[^/]+/([^?]+).*#\2#p')"
[ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || { echo "Could not read user/database from DATABASE_URL — stopping."; exit 1; }
# Only the owner runs this, in a terminal. A non-interactive run (an agent, CI, a script)
# against a database whose name does not end in _test is refused.
if [ ! -t 0 ] && [[ "$DB_NAME" != *_test ]]; then
  echo "Refusing: $DB_NAME is not a *_test database and this is not an interactive terminal. Run it yourself."
  exit 1
fi
BACKUP="$HOME/thriftos-pre-v2-phase6-$(date +%Y%m%d-%H%M%S).dump"
psql_db() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"; }

echo "== 1/6 Backup  ($CONTAINER, db=$DB_NAME, user=$DB_USER) -> $BACKUP"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP"
[ -s "$BACKUP" ] || { echo "Backup is empty — stopping."; exit 1; }
echo "   backup OK ($(du -h "$BACKUP" | cut -f1))"

echo "== 2/6 Apply migrations"
npx prisma migrate status --schema prisma/schema.prisma || true
if ! npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo
  echo "!! Migration failed. Do NOT retry. Restore your backup with:"
  echo "   docker exec -i $CONTAINER pg_restore -U $DB_USER -d $DB_NAME --clean < \"$BACKUP\""
  exit 1
fi

echo "== 3/6 Build server (regenerates Prisma client)"
npm --prefix server run build

echo "== 4/6 Base data (permissions; Admin roles get all of them)"
node server/dist/bootstrap/bootstrap.js --base
psql_db -c "SELECT r.id, r.name FROM \"Role\" r WHERE r.name = 'Admin' AND (SELECT count(*) FROM \"RolePermission\" rp WHERE rp.\"roleId\" = r.id) < (SELECT count(*) FROM \"Permission\");"

echo "== 5/6 Cost chain check ((0 rows) = every stage, bale, stock item and opened bale adds up)"
psql_db < prisma/checks/cost-chain-check.sql

echo "== 6/6 Khata check ((0 rows) = payments, sales and stock agree)"
psql_db < prisma/checks/khata-check.sql

echo
echo "Done. Backup kept at: $BACKUP"
echo "New in the app: Settings -> Bring in your register (customers with udhaar, suppliers, opening stock from Excel/CSV)."
