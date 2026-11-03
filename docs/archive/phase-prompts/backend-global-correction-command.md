You are a **Principal Backend Architect** correcting an existing multi-phase ERP backend.

This command **supersedes and amends** all previously generated backend phases
(**Phase 2 → Phase 7**) without rewriting them from scratch.

This is a **domain correction**, not a feature addition.

---

## 🔒 CORE DOMAIN RULES (ABSOLUTE)

The following rules are **globally enforced across the backend**:

1. **Sorting (Stage 1 & 2) MUST operate on a single Rag/Bale**
2. **Containers are NEVER sorted directly**
3. **Loose bales are treated as Rag/Bale with no container**
4. **Each Rag/Bale can be sorted exactly ONCE**
5. **A fully processed Rag/Bale MUST NEVER reappear**
6. **Every downstream record MUST be traceable to its income source**

Any backend code violating these rules is **invalid**.

---

## 🧱 CANONICAL MATERIAL FLOW (LOCKED)

```
Procurement
 ├── Container
 │    ├── Rag/Bale
 │    │     └── Sorting Stage 1
 │    │           └── Sorting Stage 2
 │    │                 └── Repack
 │    │                       └── Inventory
 │    └── Rag/Bale
 │
 └── Loose Bale (Rag/Bale)
       └── same flow
```

---

## 🔁 PHASE-BY-PHASE BACKEND CORRECTIONS (AUTOMATIC)

### ✅ Phase 2 — Procurement (CORRECTED)

* Procurement ENDS at:

  * Container created
  * Loose bale created
* ❌ No sorting session creation allowed
* Containers must reach `RECEIVED` before breakdown

---

### 🆕 Phase 2.5 — Container Breakdown (AUTHORITATIVE)

* Introduce `RagBale` as **mandatory physical unit**
* Container → many RagBales
* Loose bale → RagBale (containerId = null)

**Status enforcement**

```
NOT_STARTED → IN_SORTING → SORTED
```

---

### ⚠️ Phase 3 — Sorting Stage 1 (CORRECTED)

* SortingSessionStage1 MUST reference:

  ```
  ragBaleId (UNIQUE)
  ```
* Creation allowed ONLY if:

  ```
  RagStatus = NOT_STARTED
  ```
* On creation:

  ```
  RagStatus → IN_SORTING
  ```
* On close:

  ```
  RagStatus → SORTED
  ```

❌ Container ID in sorting sessions is forbidden

---

### ⚠️ Phase 4 — Sorting Stage 2 (CORRECTED)

* Sorting Stage 2 MUST inherit:

  ```
  containerId
  ragBaleId
  sortingSessionStage1Id
  ```
* No grading record may exist without Stage 1 lineage

---

### ⚠️ Phase 5 — Repack & QR (CORRECTED)

Every Repack Unit MUST carry:

```
containerId
ragBaleId
sortingSessionStage1Id
sortingSessionStage2Id
```

QR Code payload MUST embed these IDs.

---

### ⚠️ Phase 6 — Inventory (CORRECTED)

Inventory becomes **ledger + lineage enforced**.

InventoryItem MUST reference:

```
repackUnitId
ragBaleId
containerId (nullable)
```

❌ Inventory without source chain is forbidden.

---

### ⚠️ Phase 7 — Reports (ENHANCED)

Reports MUST support grouping by:

* Container
* Rag/Bale
* Sorting Session

This is enabled by enforced lineage.

---

## 🔐 GLOBAL DATA INTEGRITY CONSTRAINTS (MANDATORY)

Implement ALL of the following:

### 1️⃣ One-Time Sorting Constraint

```prisma
@unique(ragBaleId)
```

### 2️⃣ Rag Selection Filter (GLOBAL)

```sql
WHERE rag_status = 'NOT_STARTED'
```

### 3️⃣ Foreign-Key Enforcement Everywhere

No nullable source references except `containerId` for loose bale.

---

## 🚫 STRICTLY FORBIDDEN (GLOBAL)

❌ Sorting session without rag
❌ Multiple sessions per rag
❌ Reusing sorted rag
❌ Orphaned inventory
❌ Manual rag status updates
❌ Frontend-only enforcement

---

## 🧪 REQUIRED MIGRATIONS & CHECKS

After applying this command, the agent MUST:

1. Update Prisma schema
2. Generate migrations
3. Validate:

   * No orphan records
   * No duplicate sorting sessions
   * All downstream tables carry lineage
4. Fail if violations exist

---

## 🧠 DOCUMENTATION UPDATES (MANDATORY)

Update these files to reflect corrections:

* `backend-feature-register.md`
* `workflow-states.md`
* `domain-dictionary.md`

---

## 🚀 FINAL EXECUTION INSTRUCTIONS

Apply this correction:

✔ Without rewriting unaffected logic
✔ Without altering RBAC
✔ Without changing API contracts unless required for correctness

This is a **domain fix**, not a redesign.