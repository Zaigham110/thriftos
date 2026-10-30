# ThriftOS v1 — Data Model Changes

Current schema: `prisma/schema.prisma` (43 models). v1 simplifies it. Table names are kept where possible (UI labels change, not tables) to limit migration risk. Every change ships as a Prisma migration plus a data migration for existing rows, plus updated seed.

## UI word → table
| UI (English / Urdu) | Table |
|---|---|
| Supplier / سپلائر | `Vendor` |
| Container / کنٹینر | `Container` |
| Lot (a bale or group of bales to sort) / لاٹ | `Rag` |
| Sorting session / چھانٹی | `SortSession` (stage 1), `GradeSession` (stage 2) |
| Sorted stock | `CategoryOutput`, `GradeOutput` |
| Bale (finished, QR) / گانٹھ | `RepackUnit` + `QRLabel` |
| Stock item (sellable) | `InventoryItem` |
| Customer / گاہک | `Customer` |
| Payment / وصولی | `Payment` |

## Remove (delete code + drop tables after data migration)
| Remove | Why | Data migration |
|---|---|---|
| `IncomingBale` | Duplicate of `Rag` with `sourceType = LOOSE_BALE` | Copy each row into `Rag` (sourceType LOOSE_BALE, purchaseCost = cost, vendorId), re-point `SortSession.incomingBaleId` users, then drop column + table |
| `RepackItem` + `SourceType` enum | Repack v1, replaced by `RepackInputAllocation` | Convert rows to allocations if any exist, else drop |
| `SortingWaste` | Duplicate of `WasteLineItem` (stage 1) | Ensure a STAGE_1 WasteLineItem exists per row, then drop |
| `RepackSession` (optional) | Extra step for the user | Keep table for now; v1 UI auto-creates one session per day per user (no screen) |
| Tenant fields `operationMode`, `connectivityPolicy`, `capturePolicy`, `guidancePolicy`, `flowEnabled`, `User.preferredOperationMode` | Replaced by one simple setting set (below) | Drop after frontend uses new fields |
| Enums `OperationMode`, `ConnectivityPolicy`, `CapturePolicy`, `GuidancePolicy` | Same | Drop |

## Change
### Tenant
- `currency` default `"PKR"`, `locale` default `"ur-PK"`.
- Rename `operationalModules` → `enabledModules` (String[]) with values: `RECEIVE, SORT, STOCK, SELL, KHATA, REPORTS, EXPORT, WAREHOUSES, PAYROLL`. Default for new tenants: first five.
- Add `sortingStages Int @default(2)` — 0 (no sorting, trading only), 1 (category only), 2 (category + grade).
- Add `defaultLanguage String @default("ur")`.

### User
- Add `phone String?` and `pinHash String?` for fast munshi login (phone + 4–6 digit PIN), unique per tenant on phone.
- Add `language String?` (overrides tenant default).

### Vendor (Supplier)
- Only `name` required in UI. Add `originCountry String?` (default origin for its containers). Default currency `PKR`.

### Container
- `purchaseOrderId` becomes optional (PO is an advanced feature; a container can be created directly with a supplier).
- Add `vendorId String?` (direct), `originCountry String?`, `purchaseCost Decimal(14,2)` (in purchase currency), `purchaseCurrency String @default("PKR")`. Keep `fxRate`.
- `landedCostPKR Decimal(14,2)` = purchaseCost × fxRate + sum(charges) — stored, recomputed by costing engine.
- `ChargeType` enum: add `CLEARING`, `TRANSPORT`, `LABOUR`; keep `CIF` for backward compatibility but new UI uses `purchaseCost` instead of a CIF charge (data migration: if purchaseCost is null and CIF charges exist, move their sum into purchaseCost and delete those charges).
- Status simplified in UI to: On the way / Arrived / Sorting / Done (map to existing enum values; add `SORTING` if needed).

### Rag (Lot)
- Add `vendorId String?`, `purchaseCost Decimal(14,2)?` (for loose lots bought without a container), `originCountry String?`.
- `allocatedCost` stays: cost from container allocation (container lots) or purchaseCost (loose lots).

### InventoryItem (sellable stock) — key change for small merchants
- `repackUnitId`, `categoryId`, `gradeId` become **optional**.
- Add `source StockSource` enum: `PROCESSED` (from a bale/repack) | `PURCHASED` (direct stock).
- Add `vendorId String?`, `name String?` (e.g., "Jeans A grade bale", "Ladies tops"), `unit StockUnit` enum: `KG | BALE | PIECE`, `quantity Decimal(14,2)`, `unitCost Decimal(14,4)`, `salePrice Decimal(14,2)?`, `priceTier String?`, `parentItemId String?` (pieces opened from a bale).
- `avgCost` widened to `Decimal(14,2)`.

### Customer
- Required: `name` only. Make `companyName`, `billingAddress`, `shippingAddress`, `contactEmail`, `contactPhone` optional; add `phone String?` (WhatsApp, E.164) and `city String?`.
- `currencyCode` default `PKR`. Add `openingBalance Decimal(14,2) @default(0)` (udhaar carried from the register).

### Sale
- `SaleType`: add `LOCAL` (default). `EXPORT` fields stay but hidden unless EXPORT module enabled.
- Add `paymentMode` enum: `CASH | CREDIT | PARTIAL`.
- Add `billToken String @unique` (random, for public bill link shared on WhatsApp).

### Payment
- Add `tenantId`, `customerId` (required), make `saleId` optional (payments on account).
- `method` becomes enum `PaymentMethod`: `CASH | BANK | RAAST | JAZZCASH | EASYPAISA | OTHER`.
- Add `reference String?`, `attachmentUrl String?`, `receivedBy String?`.

### Money precision
- Amount columns `Decimal(12,2)` → `Decimal(14,2)` (PKR totals can exceed 10 digits). Rates per kg `Decimal(14,4)`.

## Add
- `CustomerLedger` is a **view/query**, not a table: balance = openingBalance + sum(credit sales) − sum(payments). Implement as a service query (optionally a SQL view).
- `CategoryTemplate` seed: a default Karachi category list (e.g., Jeans, Trousers, T-shirts, Shirts, Ladies tops, Kids, Jackets, Sweaters, Shoes, Bags, Bedsheets, Curtains, Rags/Katran, Waste) and default grades (Cream, A, B, C). Use existing `GlobalCategoryTemplate`.

## Keep as is
Auth/RBAC tables, `AuditLog`, `RefreshToken`, `IdempotencyKey`, `TenantSequence`, `Warehouse` (hidden unless WAREHOUSES module), `RepackInputAllocation`, `QRLabel`, `StockMovement`, `InventoryReservation`, `WasteCategory`, `WasteLineItem`, `GlobalConfig`.

## Added during Phase 1 (decisions)
- `RepackInputAllocation.gradingOutputId` is optional and `categoryOutputId` (optional) is added; exactly one is set (DB check constraint `RepackInputAllocation_exactly_one_source`, also checked in `BaleService`). Tenants with `sortingStages = 1` make bales straight from category outputs.
- `CategoryOutput.usedKg` (default 0, check `0 ≤ usedKg ≤ weightKg`) tracks kg baled directly. A category output that gave kg to a bale cannot be graded, and a graded one cannot be baled directly.
- `InventoryItem.gradeId` is optional (bales from 1-stage sorting have no grade). The rest of the `InventoryItem` changes stay in task 2.1.
- Every tenant has a waste type named `Waste/Katran` (migration `v1_04`, seed, tenant bootstrap).
- Loose lots have no purchase order; old loose-bale purchase orders keep their stored total in reports.

## Added during Phase 2 (decisions)
- `InventoryItem` keeps its whole cost (`totalCost`) and how much of it is gone (`usedQuantity`, sold or opened; check `0 ≤ usedQuantity ≤ quantity`). Selling or opening part of an item costs the cumulative share (`takeCost`, same rule as bale takes), so the parts always add up to the item's cost. `status` is `SOLD` once nothing is left. `weightKg` and `avgCost` (per kg) are optional: pieces and counted bales may have no weight.
- Bales made here become one item each: `unit = BALE`, `quantity = 1`, `totalCost` = the bale's cost (kept in step by the costing recalculation; a change after the bale was sold or opened is logged as `COST_ADJUSTMENT`).
- Opening a bale shares its cost across the pieces **by piece count** (`pieceCosts`, largest remainder): every piece of an opened bale costs the same, whatever its price tier. Pieces are new items (`unit = PIECE`, `parentItemId` = the bale), so a bale can be opened one at a time.
- `Customer.phone` is the WhatsApp number in E.164; any Pakistani format is accepted and converted (`common/phone/phone.ts`, same rules in migration `v2_02` for old `contactPhone` values). `openingBalance` may be negative (an advance).
- Payments are applied by fixed rules (`sales/khata.ts`, unit-tested): money paid with a sale pays that sale; payments on account and anything paid over a sale's total pay the opening balance first, then the oldest unpaid sales. Each sale's `status` (ISSUED / PARTIALLY_PAID / PAID) is refreshed in the same transaction as any sale, payment or opening-balance change; the balance itself is never stored. The customer row is locked (`FOR UPDATE`) during these writes so two payments for one customer apply in order.
- `Payment.attachmentUrl` holds a storage key (`local:payments/<tenant>/<id>.<ext>`), not a public URL; the photo is served only through the authenticated `GET /khata/payments/:id/photo`.
- `Payment.saleId` is `ON DELETE RESTRICT` (sales are cancelled, never deleted).
- A sale is saved complete in one request (no drafts): `InventoryReservation` is dropped, old draft sales were cancelled by migration `v2_03` (their lines removed, stock released). `SaleLine.unit` (KG/BALE/PIECE, what the price is per) replaces `measurementType`. A bale with a known weight can also be sold by kg, in whole bales.
- `Sale.billToken`: 24 random bytes, base64url (32 characters), unique; old sales got 2 × `gen_random_uuid()`.
- Sale numbers are claimed inside the sale's own transaction, so a failed sale does not use up a number.

## Rules for the migration work
- One migration per logical change, named clearly (e.g., `v1_01_remove_incoming_bale`).
- Data migration SQL must be safe on the demo database and on an empty database.
- After each migration: `prisma generate`, backend typecheck, tests green, seed works.
