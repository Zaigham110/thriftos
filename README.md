# ThriftOS

ThriftOS is a multi-tenant ERP for thrift, textile recycling, and resale operations. The repository contains:

- a NestJS backend API
- an Angular frontend
- a shared Prisma/PostgreSQL data model

## Main business areas

- Super admin and tenant management
- Authentication and RBAC
- Procurement
- Sorting stage 1
- Sorting stage 2
- Repack and QR labels
- Inventory
- Sales
- Reports
- Waste tracking

## Repository structure

```text
.
├── docker-compose.yml    # PostgreSQL Docker Compose configuration
├── prisma/               # Shared Prisma schema, migrations, seed script
├── server/               # NestJS backend API
├── thriftos-frontend/    # Angular frontend
├── docs/                 # Architecture and implementation notes
├── scripts/              # Setup scripts (setup-db.sh)
├── package.json          # Root Prisma/database scripts
└── .env                  # Local database connection
```

## Tech stack

- Node.js / npm
- Docker & Docker Compose
- PostgreSQL
- Prisma
- NestJS
- Angular
- Tailwind CSS

## Prerequisites

Install these before starting:

- Node.js 20+ recommended
- npm
- Docker Desktop (or Docker daemon with Docker Compose) / PostgreSQL 14+

## Local environment & Database Setup

The backend reads the database connection from the root `.env` file.

Default local value:

```env
DATABASE_URL="postgresql://labur:labur_dev_password@localhost:5432/thriftos?schema=public"
```

### Automated Docker & Database Setup (Recommended)

You can automatically spin up the PostgreSQL Docker container, verify/create the `thriftos` database, generate Prisma client, push schema, and seed default data using a single command:

```bash
npm run db:setup
```

Alternatively, to manually manage Docker:

```bash
# Start PostgreSQL via Docker Compose
docker compose up -d

# Run Prisma schema push & seed
npm run db:generate
npm run db:push
npm run db:seed
```

## First-time setup

Run these commands from the repository root:

```bash
npm install
npm --prefix server install
npm --prefix thriftos-frontend install

# Automated Database & Docker Setup
npm run db:setup
```

## How to run the project

Open two terminals.

### 1) Start the backend

```bash
cd server
npm run start:dev
```

Backend URLs:

- API: http://localhost:3000/api
- Swagger docs: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health

### 2) Start the frontend

```bash
cd thriftos-frontend
npm run start
```

Frontend URL:

- App: http://localhost:4200

The frontend uses `thriftos-frontend/proxy.conf.json` to proxy `/api` requests to `http://localhost:3000`.

## Seeded login accounts

After `npm run db:setup` (or `npm run db:seed`), you can use:

### Super admin

- Email: `superadmin@thriftos.com`
- Password: `SuperAdmin@123`

### Demo tenant admin

- Email: `admin@demo.thriftos.com`
- Password: `admin123`

## Useful commands

### Root

```bash
npm run db:setup     # Automated Docker start + Database creation + Schema push + Seeding
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run development migrations
npm run db:migrate:prod
npm run db:push      # Push Prisma schema to DB
npm run db:seed      # Seed database
npm run db:studio    # Launch Prisma Studio GUI
npm run db:reset     # Reset database (WARNING: clears data)
```

### Backend

```bash
cd server

npm run start:dev
npm run build
npm run lint
```

### Frontend

```bash
cd thriftos-frontend

npm run start
npm run build
npm run lint
npm run test
```

## Notes for new developers

- Install dependencies in all three package locations: root, `server`, and `thriftos-frontend`.
- The Prisma schema and migrations live at the repository root, not inside `server`.
- The backend loads environment variables from the root `.env` file.
- The frontend README inside `thriftos-frontend/` is the default Angular README; use this root README for project setup.
