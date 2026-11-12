#!/usr/bin/env bash
# Restore test, and the first step of a real restore (plan 5.3, audit H5). As root in /opt/thriftos.
#   deploy/restore-from-s3.sh                 the newest nightly backup → a scratch database, checked, then dropped
#   deploy/restore-from-s3.sh daily/thriftos-2026-11-12.dump    that backup instead
#   deploy/restore-from-s3.sh --keep [key]    leave the scratch database in place (to look at, or to switch to)
# It never touches the live database: the backup is restored into thriftos_restore_<time> beside it, the
# tables are counted and the two cost checks run (both must give 0 rows).
# After a real loss: run with --keep, stop the server (docker compose ... stop server), rename the databases
# (ALTER DATABASE thriftos RENAME TO thriftos_broken; ALTER DATABASE thriftos_restore_... RENAME TO thriftos;),
# start the server, then copy the files back: aws s3 sync s3://<bucket>/uploads/ into the uploads volume.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
set -a
# shellcheck source=/dev/null
. "./$ENV_FILE"
set +a
AWS_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:latest}"
KEEP=0; KEY=""
for a in "$@"; do if [ "$a" = --keep ]; then KEEP=1; else KEY="$a"; fi; done

imds() {
  local token
  token="$(curl -fsS --max-time 5 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
  curl -fsS --max-time 5 -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/$1"
}
identity="$(imds dynamic/instance-identity/document)"
field() { printf '%s' "$identity" | sed -n "s/.*\"$1\" *: *\"\([^\"]*\)\".*/\1/p" | head -n1; }
REGION="$(field region)"
BUCKET="${BACKUP_BUCKET:-thriftos-backups-$(field accountId)-$REGION-an}"
work="$(mktemp -d)"; chmod 700 "$work"
aws() { docker run --rm --network host -e AWS_DEFAULT_REGION="$REGION" -v "$work:/work" "$AWS_IMAGE" "$@"; }
psql() { "${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"; }

if [ -z "$KEY" ]; then
  KEY="$(aws s3api list-objects-v2 --bucket "$BUCKET" --prefix daily/ --query 'sort_by(Contents,&LastModified)[-1].Key' --output text)"
  [ -n "$KEY" ] && [ "$KEY" != None ] || { echo "No backup in s3://$BUCKET/daily/."; exit 1; }
fi
SCRATCH="thriftos_restore_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  rm -rf "$work"
  if [ "$KEEP" = 0 ]; then psql -d postgres -qc "DROP DATABASE IF EXISTS \"$SCRATCH\"" || true; fi
}
trap cleanup EXIT

echo "== 1/3 Fetch s3://$BUCKET/$KEY"
aws s3 cp --only-show-errors "s3://$BUCKET/$KEY" /work/restore.dump
echo "   $(du -h "$work/restore.dump" | cut -f1)"

echo "== 2/3 Restore into $SCRATCH (the live database is not touched)"
psql -d postgres -qc "CREATE DATABASE \"$SCRATCH\""
"${COMPOSE[@]}" exec -T postgres pg_restore --no-owner -U "$POSTGRES_USER" -d "$SCRATCH" < "$work/restore.dump"

echo "== 3/3 Check it"
count() { psql -d "$1" -Atc "SELECT (SELECT count(*) FROM \"Tenant\") || ' businesses, ' || (SELECT count(*) FROM \"User\") || ' users, ' || (SELECT count(*) FROM \"Sale\") || ' sales, ' || (SELECT count(*) FROM \"Payment\") || ' payments'"; }
echo "   backup: $(count "$SCRATCH")"
echo "   live:   $(count "$POSTGRES_DB")"
bad=0
for check in cost-chain-check khata-check; do
  sql="$("${COMPOSE[@]}" exec -T server cat "/app/prisma/checks/$check.sql" 2>/dev/null || true)"
  if [ -z "$sql" ]; then echo "   $check: file not found in the server image — skipped"; continue; fi
  rows="$(printf '%s' "$sql" | psql -d "$SCRATCH" -At | grep -c . || true)"
  echo "   $check: $rows rows (0 is right)"
  [ "$rows" = 0 ] || bad=1
done
[ "$bad" = 0 ] || { echo "!! A check found rows — look before trusting this backup."; exit 1; }
if [ "$KEEP" = 1 ]; then echo "Restored and checked. $SCRATCH is kept."; else echo "Restored and checked. The scratch database is dropped."; fi
