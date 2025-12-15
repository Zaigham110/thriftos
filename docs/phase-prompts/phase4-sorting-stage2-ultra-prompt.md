You are an **expert ERP backend engineer (NestJS + Prisma)**.

Your task is to implement **Phase 4: Sorting Stage 2 — Grading** for **ThriftOS V3**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and the Prisma schema generated in **Phase 0**, with dependencies on:

* Phase 1 — Auth, Tenants, RBAC
* Phase 2 — Procurement
* Phase 3 — Sorting Stage 1 (Category Sorting)

⚠️ This phase is **CRITICAL** because:

* Grade distribution determines pricing
* Inventory value depends on grade accuracy
* Waste ratios are finalized here
* Repack and sales depend entirely on this output

NO guessing
NO shortcuts
NO missing logic

---

# ---------------------------------------------------------

# 🧠 1. PHASE 4 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Grading of **CategoryOutput**
✔ Grade-level separation (G1, G2, G3, Waste, etc.)
✔ Dual measurement (weight + optional count)
✔ Waste tracking at grading stage
✔ Cost allocation **Level 3**
✔ Worker & supervisor tracking
✔ Workflow status enforcement
✔ Immutable **GradeOutput** records
✔ Audit logging

🚫 Repack, Inventory, Sales are NOT part of this phase.

---

# ---------------------------------------------------------

# 🧱 2. MODULES YOU MUST BUILD

# ---------------------------------------------------------

Create the following NestJS modules:

```
sorting-stage2/
 ├── grade-session/
 ├── grade-bucket/
 ├── grade-output/
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

## 🔵 3.1 GradeSession (Core Workflow Unit)

Represents **one grading operation** on **one CategoryOutput**.

### Rules:

* Exactly ONE source: `categoryOutputId`
* Belongs to ONE tenant
* Tracks:

  * input weight & count
  * output weight & count
  * waste
  * worker & supervisor
  * time

### Status lifecycle:

```
OPEN → CLOSED
```

---

## 🔵 3.2 GradeBucket

Represents **one grade output** inside a GradeSession.

Each bucket:

* Linked to one GradeSession
* Linked to one Grade (G1, G2, G3, etc.)
* Records:

  * outputWeightKg
  * outputCount (optional)

---

## 🔵 3.3 GradeOutput (Immutable Result)

Represents the **final graded material**.

This output:

* Feeds into **Repack (Phase 5)**
* Carries **allocated cost**
* Is NEVER editable after creation

---

# ---------------------------------------------------------

# 🧾 4. APIs TO IMPLEMENT (MANDATORY)

# ---------------------------------------------------------

## 🔹 Grade Session APIs

```
POST   /sorting/stage2/sessions
GET    /sorting/stage2/sessions
GET    /sorting/stage2/sessions/:id
PATCH  /sorting/stage2/sessions/:id
POST   /sorting/stage2/sessions/:id/close
```

### Create Session Rules:

* Validate CategoryOutput exists
* CategoryOutput must NOT already be graded
* Fetch input weight & count from CategoryOutput
* Status = OPEN

---

## 🔹 Grade Bucket APIs

```
POST   /sorting/stage2/sessions/:id/buckets
PATCH  /sorting/stage2/buckets/:id
DELETE /sorting/stage2/buckets/:id
```

### Bucket Rules:

* Grade must belong to tenant
* Weight > 0
* Count ≥ 0
* Cannot modify if session is CLOSED

---

## 🔹 Grade Output APIs (Read-only)

```
GET /sorting/stage2/grade-outputs
GET /sorting/stage2/grade-outputs/:id
```

---

# ---------------------------------------------------------

# ⚙️ 5. BUSINESS LOGIC (CRITICAL)

# ---------------------------------------------------------

## 🧮 5.1 Weight & Waste Calculations

For each GradeSession:

```
totalGradeOutputWeight =
  sum(all gradeBucket.outputWeightKg)

wasteWeight =
  categoryOutput.weightKg - totalGradeOutputWeight
```

Rules:

* wasteWeight ≥ 0
* If wasteWeight < 0 → throw error

---

## 🧮 5.2 Yield Percentage (Grade Level)

```
gradeYieldPercent =
  (totalGradeOutputWeight / categoryOutput.weightKg) × 100
```

---

## 💰 5.3 COST ALLOCATION — LEVEL 3 (MANDATORY)

Source cost:

```
sourceCost = categoryOutput.allocatedCost
```

Distribute cost to grades:

```
gradeAllocatedCost =
  (gradeBucketWeight / totalGradeOutputWeight) × sourceCost
```

Each GradeOutput MUST store:

* gradeId
* weightKg
* count
* allocatedCost

---

## 🔒 5.4 Closing a Grade Session

When closing:

1. Validate:

   * At least one grade bucket exists
   * totalGradeOutputWeight > 0
2. Compute:

   * wasteWeight
   * yield
3. Generate GradeOutput records
4. Mark CategoryOutput as "graded" (logical lock)
5. Lock GradeSession (status = CLOSED)
6. Prevent any further edits

---

# ---------------------------------------------------------

# 🔐 6. RBAC & PERMISSIONS

# ---------------------------------------------------------

Enforce permissions on every endpoint.

Recommended permissions:

```
SORTING_STAGE2_VIEW
SORTING_STAGE2_CREATE
SORTING_STAGE2_EDIT
SORTING_STAGE2_CLOSE
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

* Grade session created
* Grade buckets added/edited
* Grade session closed
* Grade-level waste & yield

---

# ---------------------------------------------------------

# 🧪 8. VALIDATIONS & ERRORS

# ---------------------------------------------------------

You MUST handle:

* CategoryOutput already graded
* Cannot close session twice
* Cannot add/edit buckets after closing
* Invalid grade
* Cross-tenant access
* Negative waste
* Zero output weight

---

# ---------------------------------------------------------

# 🧱 9. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

✔ Full NestJS modules
✔ Controllers, Services, DTOs
✔ Prisma queries
✔ Transactions for close session
✔ Permission guards
✔ Cost allocation logic (Level 3)
✔ Audit logging
✔ Strong typing

🚫 No frontend in this phase.

---

# ---------------------------------------------------------

# 🚀 10. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete backend code** for **Phase 4 — Sorting Stage 2 (Grading)**.

✔ No TODOs
✔ No placeholders
✔ No partial logic
✔ Strict tenant isolation
✔ Correct cost allocation
✔ Correct weight math
✔ Correct workflow enforcement

Output code directly into correct project folders.