You are an **expert ERP backend engineer (NestJS + Prisma)**.

Your task is to implement **Phase 6: Inventory Engine & Stock Movements** for **ThriftOS V3**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and the Prisma schema generated in **Phase 0**, with dependencies on:

* Phase 1 — Auth, Tenant, RBAC
* Phase 2 — Procurement
* Phase 3 — Sorting Stage 1
* Phase 4 — Sorting Stage 2
* Phase 5 — Repack & QR Code Engine

⚠️ This phase is **CRITICAL** because:

* Inventory becomes the system of record
* Stock accuracy depends on ledger integrity
* Sales & export depend on this engine
* Reports & accounting depend on movements

NO guessing
NO shortcuts
NO missing logic

---

# ---------------------------------------------------------

# 🧠 1. PHASE 6 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Inventory intake from RepackUnits
✔ Dual-unit inventory (KG + PCS)
✔ Warehouse-level stock tracking
✔ Ledger-based stock movements
✔ Reservation & release mechanics
✔ Inventory status transitions
✔ Read-only inventory views
✔ Audit logging

🚫 Sales, exports, accounting are NOT part of this phase (they will consume this engine later).

---

# ---------------------------------------------------------

# 🧱 2. MODULES YOU MUST BUILD

# ---------------------------------------------------------

Create the following NestJS modules:

```
inventory/
 ├── inventory-item/
 ├── stock-movement/
 ├── warehouse/
```

Each module MUST include:

* controller.ts
* service.ts
* dto/
* permission guards
* validations

---

# ---------------------------------------------------------

# 🟦 3. DOMAIN ENTITIES & PURPOSE

# ---------------------------------------------------------

## 🔵 3.1 InventoryItem (System of Record)

Represents **current stock state** derived from movements.

Each InventoryItem:

* Is created ONLY from a RepackUnit
* Exists in ONE warehouse
* Has dual measurement:

  * weightKg
  * pcsCount
* Has avgCost (locked from repack)
* Has status

### Status lifecycle:

```
AVAILABLE → RESERVED → SOLD
```

---

## 🔵 3.2 StockMovement (Immutable Ledger)

Represents **every change** in inventory.

Movement types:

```
INTAKE
ADJUSTMENT
SALE
EXPORT
RESERVATION
RELEASE
```

StockMovement is:

* Immutable
* Append-only
* Used for audit & reporting

---

## 🔵 3.3 Warehouse

Represents physical storage location.

InventoryItem must always belong to exactly ONE warehouse.

---

# ---------------------------------------------------------

# 🧾 4. APIs TO IMPLEMENT (MANDATORY)

# ---------------------------------------------------------

## 🔹 Inventory Intake APIs

```
POST /inventory/intake
```

### Rules:

* Source MUST be RepackUnit
* RepackUnit must be READY
* InventoryItem created
* StockMovement(INTAKE) created
* RepackUnit status updated (logical link only)

---

## 🔹 Inventory Query APIs

```
GET /inventory/items
GET /inventory/items/:id
```

Support:

* Filtering by category
* Filtering by grade
* Filtering by warehouse
* Filtering by status

---

## 🔹 Stock Movement APIs (Read-only)

```
GET /inventory/movements
GET /inventory/movements/:id
```

---

## 🔹 Inventory Adjustment APIs

```
POST /inventory/items/:id/adjust
```

Rules:

* Only allowed with permission
* Requires reason
* Creates StockMovement(ADJUSTMENT)

---

## 🔹 Inventory Reservation APIs (for future sales)

```
POST /inventory/items/:id/reserve
POST /inventory/items/:id/release
```

Rules:

* Reservation reduces AVAILABLE
* Release restores AVAILABLE
* Creates ledger entries

---

# ---------------------------------------------------------

# ⚙️ 5. BUSINESS LOGIC (CRITICAL)

# ---------------------------------------------------------

## 🧮 5.1 Inventory Creation from RepackUnit

On intake:

```
InventoryItem:
  weightKg   = repackUnit.weightKg
  pcsCount  = repackUnit.pcsCount
  avgCost   = repackUnit.totalCost / (weight or pcs)
```

Create:

```
StockMovement:
  movementType = INTAKE
  quantityKg   = weightKg
  quantityPcs  = pcsCount
```

---

## 🔄 5.2 Inventory Adjustment

Adjustment DTO must include:

* quantityKgDelta
* quantityPcsDelta
* reason

Rules:

* Cannot adjust below zero
* Must be logged
* Status remains AVAILABLE unless quantity hits zero

---

## 🔐 5.3 Reservation Logic

Reservation flow:

```
AVAILABLE → RESERVED
```

Release flow:

```
RESERVED → AVAILABLE
```

Rules:

* Cannot reserve more than available
* Cannot release more than reserved

---

## 🔒 5.4 Status Enforcement

* SOLD inventory cannot be adjusted
* SOLD inventory cannot be reserved
* SOLD inventory is immutable

---

# ---------------------------------------------------------

# 🔐 6. RBAC & PERMISSIONS

# ---------------------------------------------------------

Enforce permissions on every endpoint.

Recommended permissions:

```
INVENTORY_VIEW
INVENTORY_INTAKE
INVENTORY_ADJUST
INVENTORY_RESERVE
```

Use:

```
@UseGuards(TenantGuard, PermissionGuard)

Note: `JwtAuthGuard` is applied globally in the backend, so controllers typically only declare tenant + permission guards.
```

---

# ---------------------------------------------------------

# 🧾 7. AUDIT LOGGING

# ---------------------------------------------------------

Log:

* Inventory intake
* Adjustments
* Reservations
* Releases

---

# ---------------------------------------------------------

# 🧪 8. VALIDATIONS & ERRORS

# ---------------------------------------------------------

Handle:

* Intake of non-ready RepackUnit
* Duplicate intake
* Negative adjustments
* Cross-tenant access
* Invalid warehouse
* Invalid state transitions

---

# ---------------------------------------------------------

# 🧱 9. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

✔ Full NestJS modules
✔ Controllers, Services, DTOs
✔ Prisma queries
✔ Transactions
✔ Permission guards
✔ Ledger logic
✔ Strong typing
✔ Clean error handling

🚫 No sales or export logic here.

---

# ---------------------------------------------------------

# 🚀 10. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete backend code** for **Phase 6 — Inventory Engine & Stock Movements**.

✔ No TODOs
✔ No placeholders
✔ No partial logic
✔ Strict tenant isolation
✔ Ledger-based accuracy
✔ Production-grade code

Output code directly into correct project folders.