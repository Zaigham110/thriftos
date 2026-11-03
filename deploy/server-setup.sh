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
# - thriftos-deploy.timer: every 2 minutes deploy/auto-deploy.sh deploys GitHub's latest release
# Network access is not configured here: the AWS security group lets only CloudFront reach port 80.
# Deploys are pulled by the server, so no port is opened for them.
# Run it from a folder that also holds auto-deploy.sh (it is copied to /opt/thriftos/deploy).
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
ORIGIN_SECRET=${ORIGIN_SECRET:-$(openssl rand -hex 32)}
CORS_ORIGIN=$APP_URL
PUBLIC_APP_URL=$APP_URL/thriftos
RUN_MIGRATIONS_ON_START=1
EOF
  echo "Created $DIR/.env.prod with new secrets."
else
  echo "$DIR/.env.prod exists — left as it is."
fi
chmod 600 "$DIR/.env.prod"

install -m 755 "$(dirname "$0")/auto-deploy.sh" "$DIR/deploy/auto-deploy.sh"
cat > /etc/systemd/system/thriftos-deploy.service <<EOF
[Unit]
Description=Deploy the latest ThriftOS release if it is new
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$DIR/deploy/auto-deploy.sh
EOF
cat > /etc/systemd/system/thriftos-deploy.timer <<EOF
[Unit]
Description=Check for a new ThriftOS release every 2 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now thriftos-deploy.timer
echo "Server ready: $DIR (deploy log: journalctl -u thriftos-deploy)"
