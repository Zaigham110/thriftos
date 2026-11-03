#!/usr/bin/env bash
# Deploys one release on the production server and rolls back if it is not healthy.
# Usage (as root, in /opt/thriftos):  deploy/deploy.sh <tag>   (normally run by deploy/auto-deploy.sh)
#   GHCR_USER / GHCR_TOKEN (optional): short-lived registry login for the pull; logged out right after.
#   SKIP_PULL=1: use images already on this machine (rehearsals).
# Steps: backup → pull → switch tag → up → wait for health → (fail: previous tag back) → prune.
# A rollback brings back the previous images; migrations already applied stay applied, and the
# backup taken in step 1 is the way back for data (see docs/v2/PROGRESS.md, 5.2).
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:?usage: deploy/deploy.sh <tag>}"
ENV_FILE=.env.prod
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE here — run deploy/server-setup.sh first."; exit 1; }
set -a
# shellcheck source=/dev/null
. "./$ENV_FILE"
set +a
PREV="${THRIFTOS_TAG:-}"

set_tag() { sed -i.bak "s/^THRIFTOS_TAG=.*/THRIFTOS_TAG=$1/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"; export THRIFTOS_TAG="$1"; }

healthy() {
  local id; id="$("${COMPOSE[@]}" ps -q server)"
  [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = healthy ] &&
    curl -fsS -H "X-Origin-Verify: $ORIGIN_SECRET" http://127.0.0.1/thriftos/api/health >/dev/null &&
    curl -fsS -H "X-Origin-Verify: $ORIGIN_SECRET" http://127.0.0.1/thriftos/ >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 "${HEALTH_TRIES:-36}"); do healthy && return 0; sleep 5; done
  return 1
}

echo "== Deploy $TAG (running now: ${PREV:-none})"

echo "== 1/5 Backup"
mkdir -p backups
if [ -n "$("${COMPOSE[@]}" ps -q postgres 2>/dev/null)" ]; then
  out="backups/pre-$TAG-$(date +%Y%m%d-%H%M%S).dump"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$out"
  [ -s "$out" ] || { echo "Backup is empty — stopping."; exit 1; }
  echo "   $out ($(du -h "$out" | cut -f1))"
  # shellcheck disable=SC2012  # our own file names, no spaces
  ls -1t backups/pre-*.dump | tail -n +6 | xargs -r rm -f   # keep the last 5
else
  echo "   no database yet (first deploy)"
fi

echo "== 2/5 Pull images"
if [ "${SKIP_PULL:-0}" != 1 ]; then
  if [ -n "${GHCR_TOKEN:-}" ]; then echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?}" --password-stdin >/dev/null; fi
  pull_ok=0; THRIFTOS_TAG="$TAG" "${COMPOSE[@]}" pull --quiet server web && pull_ok=1
  [ -n "${GHCR_TOKEN:-}" ] && docker logout ghcr.io >/dev/null
  # Exit 3 = nothing changed (e.g. images not public yet); auto-deploy.sh tries again later.
  [ "$pull_ok" = 1 ] || { echo "Pull failed — nothing changed."; exit 3; }
fi

echo "== 3/5 Start $TAG"
set_tag "$TAG"
"${COMPOSE[@]}" up -d --remove-orphans
# The Caddyfile is a mounted file: restart Caddy only when it changed.
sum="$( (sha256sum 2>/dev/null || shasum -a 256) < deploy/Caddyfile | cut -d' ' -f1)"
if [ "$(cat .caddyfile.sha 2>/dev/null)" != "$sum" ]; then "${COMPOSE[@]}" restart caddy >/dev/null; echo "$sum" > .caddyfile.sha; fi

echo "== 4/5 Health"
if wait_healthy; then
  echo "== 5/5 Healthy — cleaning old images"
  docker image prune -f >/dev/null
  echo "Deployed $TAG."
  exit 0
fi

echo "!! $TAG is not healthy. Last server logs:"
"${COMPOSE[@]}" logs --tail 40 server || true
if [ -n "$PREV" ] && [ "$PREV" != "$TAG" ] && [ "$PREV" != v0.0.0 ]; then
  echo "== Rolling back to $PREV"
  set_tag "$PREV"
  "${COMPOSE[@]}" up -d --remove-orphans
  if wait_healthy; then echo "Rolled back to $PREV (healthy)."; else echo "!! $PREV is not healthy either — check the server."; fi
else
  echo "   no previous release to roll back to"
fi
exit 1
