You are a **principal backend architect**.

You are implementing **Backend Phase 2.5** for **ThriftOS**, a **thrift ERP SaaS**.

This phase introduces the **Container → Rag/Bale breakdown layer** and **locks traceability rules** for all downstream workflows.

🚫 NO frontend logic
🚫 NO sorting calculations
🚫 NO inventory math

---

## 🧠 CORE DOMAIN RULES (LOCKED)

1. Sorting **MUST** operate on a single Rag/Bale
2. Containers are never sorted directly
3. Loose bale = Rag/Bale with `containerId = null`
4. **A Rag/Bale can only be sorted ONCE**
5. **All downstream data MUST reference its income source**

---

## 📦 DATABASE MODELS (AUTHORITATIVE)

### RagBale (UPDATED)

```prisma
model RagBale {
  id            String   @id @default(uuid())
  tenantId      String
  containerId   String?  // null for loose bale
  sourceType    RagSourceType
  weightKg      Decimal
  status        RagStatus
  notes         String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  container     Container? @relation(fields: [containerId], references: [id])
  sortingStage1 SortingSessionStage1?

  @@index([tenantId])
  @@index([containerId])
  @@index([status])
}
```

---

### ENUM: RagStatus (STRICT)

```prisma
enum RagStatus {
  NOT_STARTED   // selectable for sorting
  IN_SORTING    // locked
  SORTED        // permanently closed
}
```

---

### ENUM: RagSourceType

```prisma
enum RagSourceType {
  CONTAINER
  LOOSE_BALE
}
```

---

## 🔁 SortingSessionStage1 (UPDATED & HARDENED)

```prisma
model SortingSessionStage1 {
  id          String   @id @default(uuid())
  tenantId    String
  ragBaleId   String   @unique
  status      SortingStatus
  startedAt   DateTime @default(now())
  closedAt    DateTime?

  ragBale     RagBale  @relation(fields: [ragBaleId], references: [id])
}
```

### HARD CONSTRAINTS

* `ragBaleId` is **UNIQUE**
* Prevents multiple sessions per Rag/Bale
* Enforces **one-time processing**

---

## 🔗 TRACEABILITY — MANDATORY FOREIGN KEYS (NEW)

Every downstream entity MUST reference its **source chain**.

### Sorted Category Output (Stage 1)

```prisma
model SortedCategoryItem {
  id              String   @id @default(uuid())
  tenantId        String

  containerId     String?
  ragBaleId       String
  sortingSessionId String

  categoryId      String
  weightKg        Decimal
  quantity        Int?

  createdAt       DateTime @default(now())

  ragBale         RagBale @relation(fields: [ragBaleId], references: [id])
  sortingSession  SortingSessionStage1 @relation(fields: [sortingSessionId], references: [id])
}
```

🚫 No category output without rag
🚫 No category output without session

---

### Waste Output (Stage 1)

```prisma
model SortingWaste {
  id              String   @id @default(uuid())
  tenantId        String
  containerId     String?
  ragBaleId       String
  sortingSessionId String
  weightKg        Decimal
}
```

---

## 🔁 STATUS-BASED VISIBILITY RULES (BACKEND)

### Rag/Bale selection query MUST:

```sql
WHERE status = 'NOT_STARTED'
```

This ensures:

* Sorted rags never appear again
* In-sorting rags cannot be reused
* UI cannot accidentally reprocess data

🚫 No soft filtering
🚫 No frontend-only enforcement

---

## 🔐 WORKFLOW TRANSITIONS (ENFORCED)

### Rag Lifecycle

```
NOT_STARTED → IN_SORTING → SORTED
```

### Sorting Session

* Create:

  * Requires RagStatus = NOT_STARTED
  * Sets RagStatus = IN_SORTING
* Close:

  * Sets RagStatus = SORTED
  * Locks all downstream data

---

## 🧪 DATA INTEGRITY GUARANTEES

With this design:

✅ One rag = one sorting lifecycle
✅ No duplicate processing
✅ Full audit trail
✅ Yield per container
✅ Yield per rag
✅ Export compliance
✅ No ghost inventory

---

## 🚫 STRICTLY FORBIDDEN

❌ Reopening a SORTED rag
❌ Creating second sorting session
❌ Creating outputs without source IDs
❌ Manual rag status edits
❌ Orphaned inventory items

---

## 🧪 SEED DATA (UPDATED)

Seed:

* 1 container
* 2 rags (NOT_STARTED)
* 1 loose bale rag
* No sorting sessions initially

---

## 🚀 FINAL INSTRUCTIONS

Generate:

✔ Prisma schema updates
✔ Enums
✔ Constraints
✔ Indexes
✔ Migration-ready code
✔ Inline comments explaining traceability

❌ No APIs
❌ No controllers
❌ No services