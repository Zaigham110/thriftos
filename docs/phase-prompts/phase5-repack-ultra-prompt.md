You are an **expert ERP backend engineer (NestJS + Prisma)**.

Your task is to implement **Phase 5: Repack & QR Code Engine** for **ThriftOS V3**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and the Prisma schema created in **Phase 0**, with dependencies on:

* Phase 1 — Auth, Tenant, RBAC
* Phase 2 — Procurement
* Phase 3 — Sorting Stage 1
* Phase 4 — Sorting Stage 2 (Grading)

⚠️ This phase is **CRITICAL** because:

* It defines sellable SKUs
* Locks cost into final units
* Enables inventory & sales
* Provides traceability via QR codes

NO guessing
NO shortcuts
NO missing logic

---

# ---------------------------------------------------------

# 🧠 1. PHASE 5 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Repack sessions
✔ Creation of final sellable units
✔ Support for:

* KG-based bales
* PCS-based packs
* Mixed-category bales
  ✔ Consumption of GradeOutput
  ✔ Cost allocation **Level 4 (Final)**
  ✔ QR code generation & storage
  ✔ Worker & supervisor tracking
  ✔ Workflow enforcement
  ✔ Audit logging

🚫 Inventory deduction, sales, exports are NOT part of this phase.

---

# ---------------------------------------------------------

# 🧱 2. MODULES YOU MUST BUILD

# ---------------------------------------------------------

Create the following NestJS modules:

```
repack/
 ├── repack-session/
 ├── repack-unit/
 ├── repack-item/
 ├── qr-label/
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

## 🔵 3.1 RepackSession (Operational Unit)

Represents **one repacking operation**.

Tracks:

* Worker
* Supervisor
* Time
* Status

### Status lifecycle:

```
OPEN → CLOSED
```

---

## 🔵 3.2 RepackUnit (Final Sellable Unit)

Represents **one sellable unit**, such as:

* 40kg Shirts Grade 1 Bale
* 200pcs Jeans Pack
* Mixed-category export bale

### Unit Types:

```
KG_BALE
PCS_PACK
MIXED_BALE
```

Each RepackUnit:

* Belongs to one RepackSession
* Has locked cost
* Has QR code
* Is immutable after closure

---

## 🔵 3.3 RepackItem (Consumption Record)

Represents **what material went into the RepackUnit**.

Source:

* GradeOutput ONLY (mandatory)

Tracks:

* weightKg
* pcsCount
* cost contribution

---

## 🔵 3.4 QRLabel

Represents the **digital identity** of the RepackUnit.

QR must resolve to:

* RepackUnit detail endpoint
* SKU / unitCode
* Category / Grade
* Weight / PCS
* Cost
* Traceability metadata

---

# ---------------------------------------------------------

# 🧾 4. APIs TO IMPLEMENT (MANDATORY)

# ---------------------------------------------------------

## 🔹 Repack Session APIs

```
POST   /repack/sessions
GET    /repack/sessions
GET    /repack/sessions/:id
PATCH  /repack/sessions/:id
POST   /repack/sessions/:id/close
```

---

## 🔹 Repack Unit APIs

```
POST   /repack/sessions/:id/units
GET    /repack/units
GET    /repack/units/:id
```

Rules:

* Cannot add units if session is CLOSED

---

## 🔹 Repack Item APIs

```
POST   /repack/units/:id/items
```

Rules:

* Source MUST be GradeOutput
* GradeOutput must belong to same tenant
* Cannot consume more weight/pcs than available

---

## 🔹 QR Code APIs

```
GET /repack/units/:id/qr
```

Returns:

* QR code image or encoded string
* Unit metadata

---

# ---------------------------------------------------------

# ⚙️ 5. BUSINESS LOGIC (CRITICAL)

# ---------------------------------------------------------

## 🧮 5.1 Consumption Validation

For each GradeOutput:

```
remainingWeight =
  gradeOutput.weightKg - sum(consumed weight)

remainingPCS =
  gradeOutput.count - sum(consumed pcs)
```

Reject if:

* remaining < 0

---

## 💰 5.2 COST ALLOCATION — LEVEL 4 (FINAL)

Each RepackItem cost:

```
itemCost =
  (consumedWeight / gradeOutput.weightKg) × gradeOutput.allocatedCost
```

Final RepackUnit cost:

```
totalCost = sum(all repackItem.itemCost)
```

This cost is **LOCKED** and never recalculated.

---

## 🧾 5.3 Unit Code (SKU) Generation

Generate unique `unitCode`:

```
TENANTCODE-CAT-GRADE-YYYYMMDD-SEQ
```

Ensure uniqueness via DB constraint.

---

## 🔒 5.4 Closing Repack Session

When closing:

1. Validate:

   * At least one RepackUnit exists
2. Lock session
3. Prevent any edits
4. Units become READY

---

## 🧩 5.5 QR Code Generation

On RepackUnit creation:

* Generate QR payload:

```
{
  unitId,
  unitCode,
  category,
  grade,
  weightKg,
  pcsCount,
  totalCost,
  createdAt
}
```

* Encode as QR string or PNG
* Store in QRLabel table

Use any stable Node QR library.

---

# ---------------------------------------------------------

# 🔐 6. RBAC & PERMISSIONS

# ---------------------------------------------------------

Enforce permissions on every endpoint.

Recommended permissions:

```
REPACK_VIEW
REPACK_CREATE
REPACK_EDIT
REPACK_CLOSE
```

Use:

```
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
```

---

# ---------------------------------------------------------

# 🧾 7. AUDIT LOGGING

# ---------------------------------------------------------

Log:

* Repack session created
* Units created
* GradeOutput consumed
* Repack session closed
* QR generated

---

# ---------------------------------------------------------

# 🧪 8. VALIDATIONS & ERRORS

# ---------------------------------------------------------

Handle:

* Over-consumption
* Invalid GradeOutput
* Cross-tenant access
* Closed session edits
* Duplicate unitCode
* Missing category/grade on mixed units

---

# ---------------------------------------------------------

# 🧱 9. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

✔ Full NestJS modules
✔ Controllers, Services, DTOs
✔ Prisma queries
✔ Transactions for unit creation
✔ QR generation utility
✔ Permission guards
✔ Audit logs
✔ Strong typing

🚫 No inventory or sales logic here.

---

# ---------------------------------------------------------

# 🚀 10. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete backend code** for **Phase 5 — Repack & QR Code Engine**.

✔ No TODOs
✔ No placeholders
✔ No partial logic
✔ Strict tenant isolation
✔ Correct cost locking
✔ Correct SKU generation
✔ QR generation included

Output code directly into correct project folders.