#!/bin/sh
set -e

echo "🚀 Starting ThriftOS Backend Container..."

# The Prisma client is generated when the image is built; nothing to generate here.

# Apply reviewed database migrations (`db push --accept-data-loss` is never used in containers).
# - RUN_MIGRATIONS_ON_START=1: the operator asked for it (production, or the local Docker stack).
# - otherwise only a *_test database is migrated (scripts/db-guard.js), so starting a container
#   can never migrate a dev DB by accident; any other database starts without migrating.
if [ "${RUN_MIGRATIONS_ON_START:-0}" = "1" ] || node /app/scripts/db-guard.js "migrate on container start"; then
  echo "🔄 Applying Prisma migrations..."
  npx prisma migrate deploy --schema /app/prisma/schema.prisma
else
  echo "⏭️  Not migrating (set RUN_MIGRATIONS_ON_START=1 to apply migrations on start)."
fi

# Seed data contains known demo credentials, so it must be explicitly enabled.
if [ "${SEED_DATABASE:-false}" = "true" ]; then
  echo "🌱 Seeding database..."
  npx ts-node --compiler-options '{"module":"CommonJS"}' /app/prisma/seed.ts
fi

echo "🚀 Starting NestJS API Server on port 3000..."
exec node dist/main.js
