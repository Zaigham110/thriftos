#!/usr/bin/env bash
# Nightly backup off the server (plan 5.3, audit H5). Run by thriftos-backup.timer as root in /opt/thriftos.
#   deploy/backup.sh           dump the database and copy it, with the uploaded files, to the backup bucket
#   deploy/backup.sh --check   exit 1 when the newest backup in the bucket is older than 26 hours
# Where it goes: s3://<bucket>/daily/thriftos-YYYY-MM-DD.dump (kept 14 days), on Sundays also
# weekly/ (kept 8 weeks), and uploads/ (payment photos and attachments, added to, never deleted).
# The bucket keeps them encrypted and private; its own rules remove the old ones.
# No AWS keys on the server: the instance's role may write to the bucket, and the AWS CLI runs from its
# container image. The bucket is thriftos-backups-<account>-<region>-an unless BACKUP_BUCKET is set in .env.prod.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.prod
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
set -a
# shellcheck source=/dev/null
. "./$ENV_FILE"
set +a
AWS_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:latest}"

imds() {
  local token
  token="$(curl -fsS --max-time 5 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
  curl -fsS --max-time 5 -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/$1"
}
identity="$(imds dynamic/instance-identity/document)"
field() { printf '%s' "$identity" | sed -n "s/.*\"$1\" *: *\"\([^\"]*\)\".*/\1/p" | head -n1; }
REGION="$(field region)"
BUCKET="${BACKUP_BUCKET:-thriftos-backups-$(field accountId)-$REGION-an}"
[ -n "$REGION" ] || { echo "Could not read this server's Region."; exit 1; }

# The AWS CLI from its image, with the server's own role (host network reaches the instance metadata).
aws() { docker run --rm --network host -e AWS_DEFAULT_REGION="$REGION" "${AWS_MOUNTS[@]}" "$AWS_IMAGE" "$@"; }
AWS_MOUNTS=()

if [ "${1:-}" = --check ]; then
  newest="$(aws s3api list-objects-v2 --bucket "$BUCKET" --prefix daily/ --query 'sort_by(Contents,&LastModified)[-1].LastModified' --output text)"
  [ -n "$newest" ] && [ "$newest" != None ] || { echo "No backup in s3://$BUCKET/daily/ yet."; exit 1; }
  age=$(( ($(date +%s) - $(date -d "$newest" +%s)) / 3600 ))
  echo "Newest backup: $newest ($age hours ago)"
  [ "$age" -le 26 ]
  exit
fi

day="$(date -u +%Y-%m-%d)"
mkdir -p backups && chmod 700 backups
out="backups/nightly-$day.dump"
trap 'rm -f "$out"' EXIT

echo "== 1/3 Dump the database"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$out"
[ -s "$out" ] || { echo "The dump is empty — stopping."; exit 1; }
# A dump that cannot be listed cannot be restored: check before it is called a backup.
"${COMPOSE[@]}" exec -T postgres pg_restore -l < "$out" > /dev/null
echo "   $(du -h "$out" | cut -f1)"

echo "== 2/3 Copy it to s3://$BUCKET"
AWS_MOUNTS=(-v "$PWD/backups:/backups:ro")
aws s3 cp --only-show-errors "/backups/nightly-$day.dump" "s3://$BUCKET/daily/thriftos-$day.dump"
if [ "$(date -u +%u)" = 7 ]; then
  aws s3 cp --only-show-errors "/backups/nightly-$day.dump" "s3://$BUCKET/weekly/thriftos-$day.dump"
fi

echo "== 3/3 Uploaded files"
server="$("${COMPOSE[@]}" ps -q server)"
volume="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data/uploads"}}{{.Name}}{{end}}{{end}}' "$server")"
if [ -n "$volume" ]; then
  AWS_MOUNTS=(-v "$volume:/uploads:ro")
  aws s3 sync --only-show-errors /uploads "s3://$BUCKET/uploads/"
else
  echo "   no uploads volume found — skipped"
fi

date -u +%Y-%m-%dT%H:%M:%SZ > backups/.last-backup
echo "Backup $day done."
