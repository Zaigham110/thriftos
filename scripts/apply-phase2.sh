#!/usr/bin/env bash
# Applies the v1 Phase 2 migrations to your local dev DB, safely.
# Usage (from repo root):  bash scripts/apply-phase2.sh
#
# New migrations, in the order they apply:
#   1. 20261030100000_v2_01_direct_stock           stock bought ready to sell; kg/bale/piece; item keeps its own cost
#   2. 20261030100100_v2_02_customers_and_payments  name-only customers, WhatsApp phone (E.164), opening balance;
#                                                   payments per customer with a method list
#   3. 20261030100200_v2_03_one_step_sales          LOCAL sales, payment mode, bill token, sale line unit;
#                                                   old DRAFT sales are cancelled and their stock released
# Data step: khata:refresh re-applies payments oldest-first and fixes each sale's PAID/PARTIALLY_PAID status.
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
BACKUP="$HOME/thriftos-pre-phase2-$(date +%Y%m%d-%H%M%S).dump"
psql_db() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"; }

echo "== 1/7 Backup  ($CONTAINER, db=$DB_NAME, user=$DB_USER) -> $BACKUP"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP"
[ -s "$BACKUP" ] || { echo "Backup is empty — stopping."; exit 1; }
echo "   backup OK ($(du -h "$BACKUP" | cut -f1))"

echo "== 2/7 Apply migrations"
npx prisma migrate status --schema prisma/schema.prisma || true
if ! npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo
  echo "!! Migration failed. Do NOT retry. Restore your backup with:"
  echo "   docker exec -i $CONTAINER pg_restore -U $DB_USER -d $DB_NAME --clean < \"$BACKUP\""
  exit 1
fi

echo "== 3/7 Build server (regenerates Prisma client)"
npm --prefix server run build

echo "== 4/7 Khata refresh — DRY RUN (nothing written)"
npm --prefix server run khata:refresh

read -r -p "== 5/7 Write the refreshed sale statuses now? [y/N] " ok
if [[ "$ok" =~ ^[Yy]$ ]]; then
  APPLY=1 npm --prefix server run khata:refresh
else
  echo "   skipped — run later with: APPLY=1 npm --prefix server run khata:refresh"
fi

echo "== 6/7 Cost chain check ((0 rows) = every stage, bale, stock item and opened bale adds up)"
psql_db < prisma/checks/cost-chain-check.sql

echo "== 7/7 Khata check ((0 rows) = payments, sales and stock agree)"
psql_db < prisma/checks/khata-check.sql

echo
echo "Done. Backup kept at: $BACKUP"
