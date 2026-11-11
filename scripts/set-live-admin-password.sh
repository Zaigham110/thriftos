#!/bin/bash
# Sets a new password for the super admin on the live server (the only login left there).
# You type the password here; only its bcrypt hash is sent, through AWS Systems Manager.
set -euo pipefail
cd "$(dirname "$0")/../server"
INSTANCE=i-0d706fa3c91337c3f

read -r -s -p "New super admin password (at least 8 characters): " P1; echo
read -r -s -p "Type it again: " P2; echo
[ "$P1" = "$P2" ] || { echo "The two do not match. Nothing changed."; exit 1; }
[ ${#P1} -ge 8 ] || { echo "Too short. Nothing changed."; exit 1; }

HASH=$(P="$P1" node -e "require('bcrypt').hash(process.env.P, 10).then(h => process.stdout.write(h))")
unset P1 P2

read -r -d '' REMOTE <<EOF || true
cd /opt/thriftos && set -a && . ./.env.prod && set +a
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -At <<'SQL'
UPDATE "User" SET "passwordHash" = '$HASH', "mustChangePassword" = false, "isActive" = true
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE "companyCode" = 'SYSTEM') AND email IS NOT NULL;
SQL
EOF

ID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript \
  --parameters "$(python3 -I -c 'import json,sys; print(json.dumps({"commands":[sys.argv[1]]}))' "$REMOTE")" \
  --query Command.CommandId --output text)
for _ in $(seq 1 30); do
  S=$(aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending)
  case "$S" in Success|Failed|Cancelled|TimedOut) break;; esac
  sleep 2
done
OUT=$(aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE" --query StandardOutputContent --output text)
if [ "$S" = "Success" ] && echo "$OUT" | grep -q "UPDATE 1"; then
  echo "Done. Sign in at https://dyit6jcdpteuk.cloudfront.net/thriftos with your email and the new password."
else
  echo "It did not work ($S): $OUT"; exit 1
fi
