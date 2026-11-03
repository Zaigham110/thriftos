# Agent Build Prompt — ThriftOS v1

Copy everything between the lines into a coding agent (Claude Code or similar) opened at the repository root, on branch `v1-reshape`.

---

You are the lead engineer building **ThriftOS v1**, a multi-tenant SaaS for Pakistan's used-clothing (landa) trade: container importers, sorting workshops and traders in Karachi. The repository already contains a working but over-complicated NestJS + Prisma + PostgreSQL backend (`server/`, `prisma/`) and an Angular 20 frontend (`thriftos-frontend/`). Your job is to **reshape** it into a simple, demo-ready v1 — not to rewrite it from scratch.

## Read first (source of truth, in this order)
1. `docs/v1/01-PRD.md` — what we build and why. Product rule: **sell easiness and productivity, not a complex tool.**
2. `docs/v1/02-APP-FLOW.md` — screens and user journeys.
3. `docs/v1/03-TECH-STACK-AND-ARCHITECTURE.md` — stack, folder layout, architecture rules, costing definitions, offline design.
4. `docs/v1/04-DATA-MODEL.md` — exact schema changes and data migrations.
5. `docs/v1/05-UI-UX-GUIDELINES.md` — the 10-second test and UI rules.
6. `docs/v1/06-IMPLEMENTATION-PLAN.md` — phases and tasks with acceptance criteria. **Work through it in order.**

Anything in `docs/archive/` (or other old docs) is history only; when it conflicts with `docs/v1/`, `docs/v1/` wins.

## How to work
- Work task by task from `06-IMPLEMENTATION-PLAN.md`, starting at the first unticked box. Do not start a phase before the previous phase's acceptance criteria pass.
- Before changing a module, read its current code; reuse what works (auth, RBAC, tenant guard, Decimal handling, lineage fields, QR, idempotency table, offline draft service).
- After every task:
  1. `npm --prefix server run build` (or `npx tsc --noEmit`) and frontend `npx tsc --noEmit -p tsconfig.app.json` + `ng build` — must be clean.
  2. Run tests (`npm --prefix server test`, plus frontend tests you touched) — must be green.
  3. Tick the box in `06-IMPLEMENTATION-PLAN.md` and commit with a clear message (`feat(sorting): ...`, `refactor: ...`, `chore: ...`). One task = one or a few focused commits. Never commit `.env` files.
- Keep a short running log at `docs/v1/PROGRESS.md`: date, task, what changed, anything decided, anything blocked.
- If a decision is not covered by the docs, choose the **simplest option that keeps daily screens fast**, record it in `PROGRESS.md` under "Decisions", and continue. Stop and ask only for decisions that are irreversible or touch money semantics beyond `03`'s costing definitions.

## Non-negotiable rules
1. **Tenant isolation**: every Prisma query filters by `tenantId` from the authenticated user. Add a test for any new endpoint proving another tenant's data is not visible.
2. **Money**: Prisma `Decimal` only; no JS `number` arithmetic on money or weight in the backend. Allocation uses largest-remainder rounding so parts sum exactly to the total. Every costing function has unit tests.
3. **One way to do things**: delete duplicated/legacy code paths (v1/v2/v3 repack, facade controllers, three UI shells). No commented-out code, no "legacy" folders.
4. **Thin controllers**: validation + service call only. Business logic lives in services; pure calculations live in `server/src/costing/`.
5. **Migrations**: one Prisma migration per logical change with safe data migration SQL; `prisma migrate reset` + seed must work on an empty DB.
6. **Easiness first** (UI): max 4 required fields per form; numeric keypad for numbers; tiles over dropdowns; smart defaults; one primary action at the bottom; Urdu + English via i18n dictionaries; RTL for Urdu; offline queue for receive/sort/bale/sale/payment with idempotency keys.
7. **Hide, don't build, non-v1 features**: reports, export, warehouses, purchase orders stay behind `Tenant.enabledModules`; do not add new features outside the PRD scope.
8. **No secrets in code or git**. Read config from env.

## Definition of done for v1
- All boxes in `06-IMPLEMENTATION-PLAN.md` Phases 0–4 ticked.
- `docker compose up` starts DB + API + web; demo tenant seeded by `npm run db:seed:demo`.
- Playwright mobile-viewport smoke test passes the 5-minute demo: create container with charges → sort into categories and grades → make 2 bales with QR → sell one on credit and share bill → record payment → owner home shows correct profit, udhaar and stock.
- Costing tests prove totals match to the paisa at each stage.
- README explains setup, demo logins and the product in plain words.

## First actions
1. Read the six docs above.
2. Run the current app and tests to see the baseline; note results in `docs/v1/PROGRESS.md`.
3. Start Phase 0, task 0.1.

---
