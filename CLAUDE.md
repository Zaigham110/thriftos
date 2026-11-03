# ThriftOS — agent instructions

Current plan: `docs/v2/01-GO-LIVE-PLAN.md` (prompt: `docs/v2/02-AGENT-PROMPT.md`, log: `docs/v2/PROGRESS.md`).
Product, architecture, UX and data rules: `docs/v1/` (start with `docs/v1/README.md`).
Work in this repository folder only (no separate clones/worktrees). Branch `v2-go-live`.
Product rule: sell easiness and productivity, not a complex tool.
Never commit `.env` files. Money uses Prisma Decimal only. Every query is scoped by tenantId. Never touch the dev DB.
