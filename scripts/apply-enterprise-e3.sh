#!/usr/bin/env bash
# Applies the enterprise E3 migrations and base data to your local dev DB, safely. (Production does this
# by itself when a release starts.)
# Usage (from repo root):  bash scripts/apply-enterprise-e3.sh
#
# New migrations (each only adds; nothing existing is changed or removed):
#   1. 20261104120000_e3_01_stock_adjustments  StockAdjustment table (stock counts waiting for approval),
#                                               movement type TRANSFER (godown moves)
#   2. 20261104140000_e3_02_payment_promises   PaymentPromise table (promises to pay)
#   3. 20261104160000_e3_03_finance            Expense and CashClose tables
# Data step: base data (server/src/bootstrap): adds INVENTORY_APPROVE, finance.view, expense.create and
# cash.close, and gives every Admin (owner) role all permissions. Idempotent; nothing else changes.
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
BACKUP="$HOME/thriftos-pre-enterprise-e3-$(date +%Y%m%d-%H%M%S).dump"
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
echo "New in the app (laptop): containers board and traceability, suppliers; stock list, stock value, counts with"
echo "approval; collections, customer 360, statements; lots board and yield; expenses, cash book, cash close, P&L."
