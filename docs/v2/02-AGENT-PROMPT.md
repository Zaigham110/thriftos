# Agent prompt — ThriftOS v2 (go live and beyond)

Paste the text between the lines into a coding agent opened at the repository root (this exact folder), on branch `v2-go-live`. Run one phase per session.

---

You are the lead engineer taking ThriftOS from a working v1 demo (tag `v1.0.0-demo`) to a product real businesses pay for. ThriftOS is a multi-tenant SaaS for Pakistan's used-clothing (landa) trade, built with NestJS + Prisma + PostgreSQL and an Angular 20 PWA.

## Read first
1. `docs/v2/01-GO-LIVE-PLAN.md` — the phases and tasks you will do now, with acceptance criteria. Work in order, starting at the first unticked box.
2. `docs/v1/01-PRD.md`, `03-TECH-STACK-AND-ARCHITECTURE.md`, `05-UI-UX-GUIDELINES.md` — product rule, architecture rules, UX rules. They still apply.
3. `docs/v1/PROGRESS.md` and `docs/v1/V1-RELEASE-NOTES.md` — what exists, decisions so far, "Before first deploy" items.

## How to work
- Work in THIS repository folder only. Do not create a separate clone or worktree: installs, tags and commits must land here. (In v1, a tag and npm installs went to another copy and were missing here.)
- One task = one or a few focused commits. After each task: server tests, frontend build (no new warnings), Playwright suite, typecheck — all green. Tick the box in `docs/v2/01-GO-LIVE-PLAN.md`. Log in `docs/v2/PROGRESS.md` (date, task, what changed, decisions, blockers, anything the owner must do).
- The owner's dev DB (`labur-postgres-dev`) is never touched. Tests use `*_test`, the demo uses `thriftos_demo`. Production is only changed by the deploy pipeline from a tag.
- Things only the owner can do (AWS console access, buying a domain, GitHub settings, Play Console account, payment accounts, FBR/PRAL credentials): prepare everything up to that point, write the exact click-by-click steps in PROGRESS.md under "Owner actions", and continue with the next task that doesn't depend on it.
- If something is not covered by the docs, choose the simplest option that keeps daily screens fast and running costs low; record it under "Decisions". Stop and ask only for irreversible actions, anything that costs money, or anything that touches production data.

## Non-negotiable rules (in addition to v1's)
1. No secrets in git, images or logs. Production secrets live only in `/opt/thriftos/.env.prod` on the server and in GitHub Actions secrets.
2. Never build on the server (1 GB RAM). Images are built in GitHub Actions and pulled.
3. Every deploy is from a git tag, health-checked, with automatic rollback.
4. Backups are tested by restoring, not assumed.
5. Customer data is never deleted for non-payment; read-only plus export always works.
6. Money stays Prisma Decimal; tenant isolation tests for every new endpoint; Urdu + English for every new string.

## First actions
1. Read the docs above and record the current state (branch, tag, test results, CI status) in `docs/v2/PROGRESS.md`.
2. Ask me for: the AWS region and instance type of my free-tier server, whether it already runs anything, and the domain name I will use. While waiting, start task 5.0.

---
