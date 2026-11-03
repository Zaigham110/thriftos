#!/usr/bin/env bash
# Applies the v1 Phase 3 migrations to your local dev DB, safely.
# Usage (from repo root):  bash scripts/apply-phase3.sh
#
# New migrations, in the order they apply:
#   1. 20261103100000_v3_01_phone_pin_login  User.email/passwordHash optional; phone (unique), PIN hash, failed tries,
#                                             lock time; check: every user can sign in (email+password or phone+PIN)
#   2. 20261103100100_v3_02_tenant_setup      Tenant.setupCompletedAt; every existing business is marked set up,
#                                             so only new businesses see the setup wizard
# No data step: existing users keep their email + password; nothing is recalculated.
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
BACKUP="$HOME/thriftos-pre-phase3-$(date +%Y%m%d-%H%M%S).dump"
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

echo "== 3/6 Every business is marked set up, every user can still sign in ((0 rows) = good)"
psql_db -c 'SELECT id, name FROM "Tenant" WHERE "setupCompletedAt" IS NULL;'
psql_db -c 'SELECT id, name FROM "User" WHERE NOT (("email" IS NOT NULL AND "passwordHash" IS NOT NULL) OR ("phone" IS NOT NULL AND "pinHash" IS NOT NULL));'

echo "== 4/6 Build server (regenerates Prisma client)"
npm --prefix server run build

echo "== 5/6 Cost chain check ((0 rows) = every stage, bale, stock item and opened bale adds up)"
psql_db < prisma/checks/cost-chain-check.sql

echo "== 6/6 Khata check ((0 rows) = payments, sales and stock agree)"
psql_db < prisma/checks/khata-check.sql

echo
echo "Done. Backup kept at: $BACKUP"
echo "New in the app: phone + PIN for munshis (Settings > Team), the setup wizard for new businesses,"
echo "and the floor screens. Rebuild the frontend (npx ng build) to get the installable app."
