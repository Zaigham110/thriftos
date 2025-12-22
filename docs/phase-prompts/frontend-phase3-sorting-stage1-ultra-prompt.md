You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 3** of **ThriftOS**, where **physical rags/bales are unpacked and sorted into categories**.

This phase is **factory-floor critical** and must be:

* Fast
* Accurate
* Impossible to misuse
* Visually calm and consistent

🚫 Containers are NOT sorted here
🚫 Loose logic is NOT allowed

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Sorting Stage 1 can ONLY be started from a Rag/Bale created in Phase 2.5.**

Hard rules:

* ❌ Sorting directly from Container is FORBIDDEN
* ❌ Sorting a Rag/Bale more than once is FORBIDDEN
* ❌ Rag with status `SORTED` or `IN_SORTING` MUST NEVER appear
* ❌ UI must not offer bypasses

If violated → **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/architecture/domain-update-container-rag-sorting.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`
* `docs/security/frontend-permissions-map.md`

AI must confirm:

* SortingSessionStage1 references **ragBaleId**
* Rag status lifecycle is enforced
* Traceability fields exist

---

## 🧠 PHASE 3 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Sorting Session list
✔ Sorting Session detail (workspace)
✔ Category input (weight / qty)
✔ Waste capture
✔ Live totals
✔ Session lifecycle (OPEN → CLOSED)
✔ Read-only mode after close
✔ Full source display (income source)

### MUST NOT IMPLEMENT

❌ Grading (Stage 2)
❌ Repack
❌ Inventory
❌ Reports
❌ Rag creation

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

This phase MUST reuse:

* ThriftUI `Card`
* ThriftUI `Table`
* ThriftUI `Input`
* ThriftUI `Badge`
* ThriftUI spacing & typography

🚫 No custom grids
🚫 No redesign
🚫 No experimental UI

If something feels missing → **extend ThriftUI only**

---

## 🧱 TECH & STYLE (INHERITED)

* Angular 21
* Angular CLI ONLY
* Standalone components
* SCSS + Tailwind layering
* Inter font
* Lucide icons
* Light ERP theme
* OnPush change detection
* Signals for derived state

🚫 Inline styles
🚫 Manual files
🚫 Dark UI

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/sorting-stage1/
 ├── sessions/
 │   ├── sorting-session-list.page.ts
 │   └── sorting-session-detail.page.ts
 ├── workspace/
 │   ├── category-bucket.component.ts
 │   ├── waste-bucket.component.ts
 │   ├── totals-panel.component.ts
 ├── shared/
 │   ├── weight-input.component.ts
 │   └── quantity-input.component.ts
 ├── sorting-stage1.routes.ts
 └── sorting-stage1.service.ts
```

Lazy-loaded at:

```
/sorting/stage1
```

---

## 📄 SORTING SESSION LIST

### Route

```
/sorting/stage1
```

Table (dense ERP):

* Session ID
* Container Ref (if exists)
* Rag/Bale ID
* Rag Weight
* Status
* Started At
* Closed At

Actions:

* Continue (OPEN)
* View Summary (CLOSED)

🚫 Create button here
(creation happens ONLY in Phase 2.5)

---

## 🧺 SORTING WORKSPACE (CORE SCREEN)

### Route

```
/sorting/stage1/:sessionId
```

### HEADER (MANDATORY — TRACEABILITY)

Display prominently:

```
Container: C-2024-09 (if applicable)
Rag/Bale: RAG-004
Source: Container / Loose Bale
Original Weight: 92 KG
```

This header must ALWAYS be visible.

---

## 📐 WORKSPACE LAYOUT (LOCKED)

```
┌───────────────┬──────────────────────────────┐
│ Categories    │ Sorting Input Area            │
│ (Left Panel)  │                              │
├───────────────┼──────────────────────────────┤
│ Waste Bucket  │ Totals Panel (Right)          │
└───────────────┴──────────────────────────────┘
```

No deviation allowed.

---

## 🧺 CATEGORY BUCKETS

Each category:

* Is a ThriftUI Card
* Shows:

  * Category name
  * Total weight / qty
* Accepts:

  * Weight OR quantity (category config driven)

Rules:

* Numeric-only inputs
* Immediate validation
* No free-text categories

---

## 🗑️ WASTE BUCKET

* Mandatory
* Same UI as category bucket
* Muted danger accent
* Included in totals

---

## 📊 TOTALS PANEL

Read-only values:

* Input weight
* Sorted weight
* Waste
* Yield %

🚫 No charts
🚫 No animations

---

## 🔁 SESSION STATE RULES (HARD)

### OPEN

* Inputs enabled
* Buckets editable

### CLOSED

* Entire UI read-only
* No edits
* Summary mode only

Closing session:

* Requires confirmation
* Backend sets RagStatus → SORTED

---

## 🚫 VISIBILITY & SAFETY RULES

* Sorted Rag/Bale MUST NOT appear anywhere else
* Session list shows history only
* No reopen
* No duplicate session creation

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Over-allocation warning
* Missing totals
* Network failure
* Concurrent lock notice

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/sorting-stage1/workspace/category-bucket \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Sorting session created without Rag/Bale
* Rag appears selectable twice
* Container sorting is possible
* Source header missing
* ThriftUI is bypassed

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 3**, including:

✔ Sorting session list
✔ Sorting workspace
✔ Category & waste buckets
✔ Totals panel
✔ Rag-only enforcement
✔ Status lifecycle enforcement
✔ Full source traceability
✔ UI consistency

❌ Do NOT implement grading
❌ Do NOT implement repack
❌ Do NOT implement inventory

Output **real Angular 21 code**, production-ready.