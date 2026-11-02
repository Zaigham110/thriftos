# ThriftOS — agent instructions

Source of truth: `docs/v1/` (start with `docs/v1/README.md`). Build prompt: `docs/v1/07-AGENT-BUILD-PROMPT.md`.
Work on branch `v1-reshape`, task by task from `docs/v1/06-IMPLEMENTATION-PLAN.md`, and log progress in `docs/v1/PROGRESS.md`.
Product rule: sell easiness and productivity, not a complex tool.
Never commit `.env` files. Money uses Prisma Decimal only. Every query is scoped by tenantId.
Never migrate, reset, push or seed the dev DB. Automated DB writes go through `scripts/db-guard.js` (only `*_test` databases unless `ALLOW_DEV_MIGRATE=1`); `scripts/apply-phase*.sh` are run by the owner only.
