You are an **expert ERP backend engineer (NestJS + Prisma)**.

Your task is to implement **Phase 3: Sorting Stage 1 (Category Sorting)** for **ThriftOS V3**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and the Prisma schema created in **Phase 0**, with dependencies on:

* Phase 1 (Auth, Tenant, RBAC)
* Phase 2 (Procurement)

⚠️ This phase must be **100% accurate**, because:

* All grading
* All cost allocation
* All inventory
* All profitability

depend on Sorting Stage 1 correctness.

NO guessing
NO shortcuts
NO missing workflows

---

# ---------------------------------------------------------

# 🧠 1. PHASE 3 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Sorting of **Rags** (from containers)
✔ Sorting of **IncomingBales** (loose/local)
✔ Category-level separation
✔ Dual measurement (weight + optional count)
✔ Waste tracking
✔ Yield & shrinkage calculations
✔ Worker & supervisor tracking
✔ Status-based workflow
✔ Audit logging

🚫 Grading (Stage 2) is NOT part of this phase.

---

# ---------------------------------------------------------

# 🧱 2. MODULES YOU MUST BUILD

# ---------------------------------------------------------

Create the following NestJS modules:

```
sorting-stage1/
 ├── sort-session/
 ├── sort-category-bucket/
 ├── category-output/
```

Each module MUST contain:

* controller.ts
* service.ts
* dto/
* permission guards
* validations

---

# ---------------------------------------------------------

# 🟦 3. DOMAIN ENTITIES & PURPOSE

# ---------------------------------------------------------

## 🔵 3.1 SortSession (Core Workflow Unit)

Represents **one sorting operation** on either:

* a Rag OR
* an Incoming Bale

### Rules:

* Exactly **ONE source**:

  * ragId OR incomingBaleId (never both)
* Belongs to ONE tenant
* Tracks:

  * input weight
  * output weight
  * waste
  * time
  * workers

### Status lifecycle:

```
OPEN → CLOSED
```

---

## 🔵 3.2 SortCategoryBucket

Represents **category-level output** from a sorting session.

Each bucket:

* Is linked to one SortSession
* Is linked to one Category
* Records:

  * outputWeightKg
  * outputCount (optional)

---

## 🔵 3.3 CategoryOutput (Immutable Result)

This is the **official output record** that:

* Feeds into **Sorting Stage 2 (Grading)**
* Carries **allocated cost**
* Is never edited after creation

---

# ---------------------------------------------------------

# 🧾 4. APIs TO IMPLEMENT (MANDATORY)

# ---------------------------------------------------------

## 🔹 Sort Session APIs

```
POST   /sorting/stage1/sessions
GET    /sorting/stage1/sessions
GET    /sorting/stage1/sessions/:id
PATCH  /sorting/stage1/sessions/:id
POST   /sorting/stage1/sessions/:id/close
```

### Create Session Rules:

* Validate source exists (rag or incoming bale)
* Fetch input weight from source
* Status = OPEN
* No outputs initially

---

## 🔹 Category Bucket APIs

```
POST   /sorting/stage1/sessions/:id/buckets
PATCH  /sorting/stage1/buckets/:id
DELETE /sorting/stage1/buckets/:id
```

### Bucket Rules:

* Category must belong to tenant
* Weight > 0
* Count >= 0
* Cannot edit if session is CLOSED

---

## 🔹 Category Output APIs (Read-only)

```
GET /sorting/stage1/category-outputs
GET /sorting/stage1/category-outputs/:id
```

---

# ---------------------------------------------------------

# ⚙️ 5. BUSINESS LOGIC (CRITICAL)

# ---------------------------------------------------------

## 🧮 5.1 Weight Calculations

For each SortSession:

```
totalOutputWeight =
  sum(all bucket.outputWeightKg)

wasteWeight =
  totalInputWeight - totalOutputWeight
```

Rules:

* wasteWeight must be >= 0
* If wasteWeight < 0 → throw error

---

## 🧮 5.2 Yield Percentage

```
yieldPercent =
  (totalOutputWeight / totalInputWeight) × 100
```

Store yield in metadata or compute dynamically.

---

## 💰 5.3 COST ALLOCATION — LEVEL 2 (MANDATORY)

Use cost from:

* Rag.allocatedCost OR
* IncomingBale.cost

Distribute cost to categories:

```
categoryAllocatedCost =
  (bucketWeight / totalOutputWeight) × sourceCost
```

Each CategoryOutput MUST store:

* allocatedCost
* weightKg
* count

---

## 🔒 5.4 Closing a Sort Session

When closing:

1. Validate:

   * At least one bucket exists
   * totalOutputWeight > 0
2. Compute:

   * wasteWeight
   * yield
3. Generate CategoryOutput records
4. Lock session (status = CLOSED)
5. Prevent further edits

---

# ---------------------------------------------------------

# 🔐 6. RBAC & PERMISSIONS

# ---------------------------------------------------------

Enforce permissions on every endpoint.

Recommended permissions:

```
SORTING_STAGE1_VIEW
SORTING_STAGE1_CREATE
SORTING_STAGE1_EDIT
SORTING_STAGE1_CLOSE
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

* Session created
* Buckets added/edited
* Session closed
* Waste & yield generated

---

# ---------------------------------------------------------

# 🧪 8. VALIDATIONS & ERRORS

# ---------------------------------------------------------

You MUST handle:

* Cannot close session twice
* Cannot add buckets after closing
* Cannot delete buckets after closing
* Invalid category
* Source not found
* Cross-tenant access attempts

---

# ---------------------------------------------------------

# 🧱 9. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

✔ Full NestJS modules
✔ Controllers, Services, DTOs
✔ Prisma queries
✔ Transactions for close session
✔ Permission guards
✔ Cost allocation logic
✔ Audit logs
✔ Strong typing

🚫 No frontend in this phase.

---

# ---------------------------------------------------------

# 🚀 10. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete backend code** for **Phase 3 — Sorting Stage 1**.

✔ No TODOs
✔ No placeholders
✔ No partial implementations
✔ Strict tenant isolation
✔ Correct cost allocation
✔ Correct weight math
✔ Correct workflow enforcement

Output code directly into correct project folders.