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
├── prisma/               # Shared Prisma schema, migrations, seed script
├── server/               # NestJS backend API
├── thriftos-frontend/    # Angular frontend
├── docs/                 # Architecture and implementation notes
├── scripts/              # Shared scripts
├── package.json          # Root Prisma/database scripts
└── .env                  # Local database connection
```

## Tech stack

- Node.js / npm
- PostgreSQL
- Prisma
- NestJS
- Angular
- Tailwind CSS

## Prerequisites

Install these before starting:

- Node.js 20+ recommended
- npm
- PostgreSQL 14+ recommended

## Local environment

The backend reads the database connection from the root `.env` file.

Default local value:

```env
DATABASE_URL="postgresql://labur:labur_dev_password@localhost:5432/thriftos?schema=public"
```

Create the `thriftos` database in PostgreSQL and update the username/password if needed.

## First-time setup

Run these commands from the repository root:

```bash
npm install
npm --prefix server install
npm --prefix thriftos-frontend install
```

Then prepare the database:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
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

After `npm run db:seed`, you can use:

### Super admin

- Email: `superadmin@thriftos.com`
- Password: `SuperAdmin@123`

### Demo tenant admin

- Email: `admin@demo.thriftos.com`
- Password: `admin123`

## Useful commands

### Root

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:prod
npm run db:push
npm run db:seed
npm run db:studio
npm run db:reset
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
