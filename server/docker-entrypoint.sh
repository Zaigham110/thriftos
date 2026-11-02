#!/bin/sh
set -e

echo "🚀 Starting ThriftOS Backend Container..."

# Generate Prisma client if needed
npx prisma generate --schema /app/prisma/schema.prisma

# Apply reviewed database migrations. `db push --accept-data-loss` is deliberately
# not used in containers because it can silently alter a production schema.
# Refuses a database whose name does not end in _test unless ALLOW_DEV_MIGRATE=1 is set,
# so starting the stack can never migrate a dev DB by accident.
node /app/scripts/db-guard.js "migrate on container start"
echo "🔄 Applying Prisma migrations..."
npx prisma migrate deploy --schema /app/prisma/schema.prisma

# Seed data contains known demo credentials, so it must be explicitly enabled.
if [ "${SEED_DATABASE:-false}" = "true" ]; then
  echo "🌱 Seeding database..."
  npx ts-node --compiler-options '{"module":"CommonJS"}' /app/prisma/seed.ts
fi

echo "🚀 Starting NestJS API Server on port 3000..."
exec node dist/main.js
