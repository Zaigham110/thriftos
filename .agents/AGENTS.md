# ThriftOS — agent notes

**Source of truth: [`docs/v1/`](../docs/v1/README.md).** Read it before changing code. `docs/archive/` is history only; when it conflicts with `docs/v1/`, `docs/v1/` wins.
Work task by task from `docs/v1/06-IMPLEMENTATION-PLAN.md` and log progress in `docs/v1/PROGRESS.md`.

Product rule: **sell easiness and productivity, not a complex tool.**

## Architecture rules (from docs/v1/03)
1. Tenant isolation: every Prisma query filters by `tenantId` from the authenticated user. New endpoints get a test proving another tenant's data is not visible.
2. Thin controllers: validate DTO → call service → return. No Prisma in controllers.
3. Costing is pure: allocation formulas live in `server/src/costing/` as pure functions with unit tests; services call them inside a Prisma transaction.
4. Money: Prisma `Decimal` only, never JS `number` arithmetic on money or weight. `Decimal(14,2)` amounts, `Decimal(14,4)` per-kg rates. Largest-remainder rounding so allocated parts sum exactly to the total.
5. Offline-capable writes accept an `Idempotency-Key` header (`IdempotencyKey` table).
6. One way to do each thing: no v1/v2/v3 code side by side, no commented-out code, no "legacy" folders.
7. Feature flags per tenant: `Tenant.enabledModules` decides visible tabs and APIs; the server enforces it too.
8. Important writes (cost change, sale, payment, stock adjustment) go to `AuditLog`.
9. Never commit `.env` files or secrets.

## Domain notes that still hold
Lineage chain (table names are kept; UI words differ — see docs/v1/04 "UI word → table"):
```text
Vendor (Supplier) ─ Container [ContainerCharge]
  └─ Rag (Lot; sourceType CONTAINER | LOOSE_BALE)
       └─ SortSession (stage 1) ─ CategoryOutput, WasteLineItem
            └─ GradeSession (stage 2) ─ GradeOutput, WasteLineItem
                 └─ RepackUnit (Bale) ← RepackInputAllocation ─ QRLabel
                      └─ InventoryItem ─ StockMovement ─ SaleLine ─ Sale (Customer, Payment)
```
- One-time sorting: a `Rag` moves `NOT_STARTED → IN_SORTING → SORTED`; a sorted lot is never sorted again.
- Denormalise `containerId` and `ragId` onto downstream rows (outputs, bales, stock, waste) so lineage and costing queries stay cheap.
- Keep these docs in sync when the schema, costing formulas or workflows change: update `docs/v1/04-DATA-MODEL.md` / `03` and note it in `docs/v1/PROGRESS.md`.
