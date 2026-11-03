#!/usr/bin/env bash
# One-time setup of /opt/thriftos on the production server (Ubuntu 24.04, run as root, e.g. through
# AWS Systems Manager Run Command). Safe to run again: nothing that exists is overwritten.
# Usage: deploy/server-setup.sh https://<id>.cloudfront.net
#
# - Docker + compose plugin (installed only if missing; the shared server already has them)
# - 2 GB swap file (only if the server has no swap)
# - automatic security updates (unattended-upgrades)
# - /opt/thriftos/.env.prod with fresh secrets, mode 600 (replaces the JWT secret and DB password
#   that are in git history)
# Network access is not configured here: the AWS security group lets only CloudFront reach port 80,
# and deploys come in through Systems Manager, so no SSH port is opened for them.
set -euo pipefail

APP_URL="${1:?usage: server-setup.sh https://<id>.cloudfront.net}"
APP_URL="${APP_URL%/}"
DIR=/opt/thriftos

if ! command -v docker >/dev/null; then
  apt-get update -q && apt-get install -yq docker.io docker-compose-v2
  systemctl enable --now docker
fi
docker compose version >/dev/null

if [ -z "$(swapon --show --noheadings)" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! dpkg -s unattended-upgrades >/dev/null 2>&1; then apt-get install -yq unattended-upgrades; fi
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

mkdir -p "$DIR/deploy" "$DIR/backups"
chmod 700 "$DIR/backups"
if [ ! -f "$DIR/.env.prod" ]; then
  umask 077
  cat > "$DIR/.env.prod" <<EOF
THRIFTOS_TAG=v0.0.0
POSTGRES_USER=thriftos
POSTGRES_DB=thriftos
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
JWT_ACCESS_EXPIRES_IN=900s
ORIGIN_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=$APP_URL
PUBLIC_APP_URL=$APP_URL/thriftos
RUN_MIGRATIONS_ON_START=1
EOF
  echo "Created $DIR/.env.prod with new secrets."
else
  echo "$DIR/.env.prod exists — left as it is."
fi
chmod 600 "$DIR/.env.prod"
echo "Server ready: $DIR"
