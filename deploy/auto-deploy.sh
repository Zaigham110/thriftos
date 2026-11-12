#!/usr/bin/env bash
# Pull-based deploys: a systemd timer (thriftos-deploy.timer, every 2 minutes) runs this on the server.
# When GitHub's latest ThriftOS release differs from the running tag, it fetches that tag's deploy files
# and runs deploy/deploy.sh (backup → pull → start → health → rollback). Nothing connects to the server,
# and GitHub holds no AWS or SSH credentials.
# A release that failed is remembered in .failed-tags and not retried; to roll back, mark an older
# release as "Latest" on GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="${THRIFTOS_REPO:-Zaigham110/thriftos}"
FILES=(docker-compose.prod.yml deploy/Caddyfile deploy/deploy.sh deploy/auto-deploy.sh deploy/backup.sh deploy/restore-from-s3.sh)

exec 9>.auto-deploy.lock
flock -n 9 || exit 0

latest="$(curl -fsS --max-time 20 "https://api.github.com/repos/$REPO/releases/latest" |
  sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)" || exit 0
[[ "$latest" =~ ^v[0-9A-Za-z._-]+$ ]] || exit 0
current="$(sed -n 's/^THRIFTOS_TAG=//p' .env.prod)"
[ "$latest" = "$current" ] && exit 0
grep -qxF "$latest" .failed-tags 2>/dev/null && exit 0

echo "New release $latest (running ${current:-none})"
new="$(mktemp -d)"; old="$(mktemp -d)"
trap 'rm -rf "$new" "$old"' EXIT
for f in "${FILES[@]}"; do
  mkdir -p "$new/$(dirname "$f")" "$old/$(dirname "$f")"
  curl -fsSL --max-time 30 "https://raw.githubusercontent.com/$REPO/$latest/$f" -o "$new/$f"
  if [ -f "$f" ]; then cp -p "$f" "$old/$f"; fi
done
for f in "${FILES[@]}"; do install -m "$([[ $f == *.sh ]] && echo 755 || echo 644)" "$new/$f" "$f"; done

if [ -f .ghcr-token ]; then
  GHCR_USER="$(sed -n 1p .ghcr-token)"; GHCR_TOKEN="$(sed -n 2p .ghcr-token)"; export GHCR_USER GHCR_TOKEN
fi

rc=0
deploy/deploy.sh "$latest" || rc=$?
[ "$rc" = 0 ] && exit 0

if [ "$rc" = 3 ]; then
  # The images could not be pulled and nothing changed: put the deploy files back, retry next time.
  for f in "${FILES[@]}"; do if [ -f "$old/$f" ]; then cp -p "$old/$f" "$f"; fi; done
  exit 1
fi

echo "$latest" >> .failed-tags
# deploy.sh brought the previous images back; put the previous deploy files back too.
for f in "${FILES[@]}"; do if [ -f "$old/$f" ]; then cp -p "$old/$f" "$f"; fi; done
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
docker compose -f docker-compose.prod.yml --env-file .env.prod restart caddy >/dev/null
exit 1
