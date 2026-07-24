#!/bin/sh
set -e

echo "🚀 Starting ThriftOS Backend Container..."

# Generate Prisma client if needed
npx prisma generate --schema /app/prisma/schema.prisma

# Apply database schema
echo "🔄 Pushing Prisma schema to PostgreSQL..."
npx prisma db push --schema /app/prisma/schema.prisma --accept-data-loss

# Seed initial database
echo "🌱 Seeding database..."
npx ts-node --compiler-options '{"module":"CommonJS"}' /app/prisma/seed.ts || echo "Seed execution completed."

echo "🚀 Starting NestJS API Server on port 3000..."
exec node dist/main.js
