# 🚀 ThriftOS V3 - Database Migration Instructions

## Prerequisites

1. **PostgreSQL 14+** installed and running
2. **Node.js 18+** installed
3. **npm** or **pnpm** package manager

---

## 🔧 Environment Setup

### 1. Create Environment File

Create a `.env` file in the project root:

```bash
# PostgreSQL Database URL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL="postgresql://postgres:password@localhost:5432/thriftos?schema=public"
```

### 2. Create the Database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE thriftos;"

# Or using createdb
createdb -U postgres thriftos
```

---

## 📦 Installation

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run db:generate
```

---

## 🗄️ Database Migration

### Development Migration

```bash
# Create and apply migration (interactive - will prompt for migration name)
npm run db:migrate

# Or use Prisma CLI directly with migration name
npx prisma migrate dev --name init
```

### Production Migration

```bash
# Deploy migrations without interactive prompts
npm run db:migrate:prod

# Or use Prisma CLI directly
npx prisma migrate deploy
```

### Quick Push (Development Only)

For rapid prototyping without migration history:

```bash
npm run db:push

# Or use Prisma CLI directly
npx prisma db push
```

---

## 🌱 Database Seeding

```bash
# Run seed script
npm run db:seed

# Or use Prisma CLI directly
npx prisma db seed
```

The seed script creates:
- Global configurations
- Global category templates
- All permissions
- Demo tenant ("Demo Thrift Company")
- Demo categories, grades, warehouses
- Demo roles with permissions
- Demo admin user

---

## 🔍 Database Studio

Explore your database with Prisma Studio:

```bash
npm run db:studio

# Opens browser at http://localhost:5555
```

---

## 🔄 Reset Database

**⚠️ WARNING: This deletes all data!**

```bash
npm run db:reset

# Or use Prisma CLI directly
npx prisma migrate reset
```

---

## 📋 Complete Setup Script

Run all steps in sequence:

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Create initial migration
npx prisma migrate dev --name init

# 4. Seed the database
npx prisma db seed

# 5. (Optional) Open Prisma Studio
npx prisma studio
```

---

## 🏗️ Schema Changes

When modifying `prisma/schema.prisma`:

```bash
# 1. Make changes to schema.prisma
# 2. Create new migration
npx prisma migrate dev --name describe_your_change

# 3. Regenerate Prisma Client
npx prisma generate
```

---

## 📊 Migration Files Structure

After migration, your `prisma/migrations/` folder will contain:

```
prisma/
├── migrations/
│   ├── 20250115000000_init/
│   │   └── migration.sql
│   └── migration_lock.toml
├── schema.prisma
└── seed.ts
```

---

## 🔐 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/thriftos` |

---

## 🐳 Docker Setup (Optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: thriftos
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
# Start PostgreSQL
docker-compose up -d

# Then run migrations
npx prisma migrate dev --name init
```

---

## ✅ Verification

After setup, verify everything works:

```bash
# Check database connection
npx prisma db pull

# Run Prisma Studio to browse data
npx prisma studio
```

---

## 🆘 Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check service status (macOS)
brew services list | grep postgresql

# Check service status (Linux)
systemctl status postgresql
```

### Permission Denied
```bash
# Grant permissions to user
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE thriftos TO your_user;"
```

### Migration Conflicts
```bash
# Reset and start fresh (⚠️ deletes all data)
npx prisma migrate reset
```

