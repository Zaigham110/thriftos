#!/usr/bin/env bash

# First-time setup of a local database. It pushes the schema and seeds, so it is refused for a
# database whose name does not end in _test unless you run it as: ALLOW_DEV_MIGRATE=1 npm run db:setup

# Exit on error
set -e

echo "🚀 Starting ThriftOS Database & Docker Setup..."

# 1. Check if Docker CLI is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# 2. Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "⚠️  Docker daemon is not running. Attempting to start Docker..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker || true
        echo "⏳ Waiting for Docker to start..."
        while ! docker info &> /dev/null; do
            sleep 3
        done
    else
        echo "❌ Error: Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
fi
echo "✅ Docker is up and running."

# 3. Check if PostgreSQL container is running or port 5432 is in use
POSTGRES_CONTAINER=""
if docker ps --format '{{.Names}}' | grep -q 'thriftos-postgres'; then
    POSTGRES_CONTAINER="thriftos-postgres"
elif docker ps --format '{{.Names}}' | grep -q 'labur-postgres-dev'; then
    POSTGRES_CONTAINER="labur-postgres-dev"
fi

if [ -n "$POSTGRES_CONTAINER" ]; then
    echo "✅ PostgreSQL Docker container '$POSTGRES_CONTAINER' is already running."
else
    echo "📦 Starting PostgreSQL container via Docker Compose..."
    if docker compose version &> /dev/null; then
        docker compose up -d postgres
    elif command -v docker-compose &> /dev/null; then
        docker-compose up -d postgres
    else
        echo "⚠️ Docker Compose not found. Running Docker container manually..."
        docker run -d \
          --name thriftos-postgres \
          -e POSTGRES_USER=labur \
          -e POSTGRES_PASSWORD=labur_dev_password \
          -e POSTGRES_DB=thriftos \
          -p 5432:5432 \
          postgres:16-alpine
    fi
    POSTGRES_CONTAINER="thriftos-postgres"
fi

# 4. Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker exec "$POSTGRES_CONTAINER" pg_isready -U labur &> /dev/null || [ $RETRIES -eq 0 ]; do
    echo "   Waiting for database connection... ($RETRIES attempts remaining)"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo "❌ Error: Timed out waiting for PostgreSQL container."
    exit 1
fi
echo "✅ PostgreSQL connection ready!"

# 5. Ensure thriftos database exists
echo "🔍 Checking database 'thriftos'..."
DB_EXISTS=$(docker exec "$POSTGRES_CONTAINER" psql -U labur -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='thriftos';" || echo "0")
if [ "$DB_EXISTS" != "1" ]; then
    echo "➕ Creating database 'thriftos'..."
    docker exec "$POSTGRES_CONTAINER" psql -U labur -d postgres -c "CREATE DATABASE thriftos;"
    echo "✅ Database 'thriftos' created."
else
    echo "✅ Database 'thriftos' already exists."
fi

# 6. Generate Prisma Client
echo "⚙️ Generating Prisma Client..."
npm run db:generate

# 7. Apply Database Migrations / Schema Push
echo "🔄 Pushing Prisma Schema to Database..."
npm run db:push

# 8. Seed the Database
echo "🌱 Seeding initial database data..."
npm run db:seed

echo ""
echo "🎉 Setup Complete! ThriftOS PostgreSQL container is active and seeded."
