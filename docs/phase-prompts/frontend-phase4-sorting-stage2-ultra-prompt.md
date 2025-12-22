## 🔥 ROLE & CONTEXT

You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 4** of **ThriftOS**, where **Stage 1 sorted category outputs are graded** into **Grade 1 / Grade 2 / Grade 3 / Waste**.

This phase is **quality-control critical** and must be:

* Controlled
* Traceable
* Impossible to misuse
* Visually consistent with earlier phases

🚫 No container-level operations
🚫 No rag-level operations
🚫 Grading ONLY happens on Stage 1 outputs

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Sorting Stage 2 can ONLY operate on outputs produced by Sorting Stage 1.**

Hard rules:

* ❌ Cannot grade a Rag/Bale directly
* ❌ Cannot grade without Stage 1 session
* ❌ Cannot grade same output twice
* ❌ Cannot bypass traceability

Violation = **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/architecture/domain-update-container-rag-sorting.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`
* `docs/security/frontend-permissions-map.md`

AI must confirm:

* Stage 2 entities reference Stage 1 outputs
* Lineage fields exist:

  ```
  containerId
  ragBaleId
  sortingSessionStage1Id
  ```

---

## 🧠 PHASE 4 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Grading session list
✔ Grading workspace
✔ Grade allocation (G1 / G2 / G3 / Waste)
✔ Totals & validation
✔ Session lifecycle (OPEN → CLOSED)
✔ Read-only closed sessions
✔ Full lineage display

### MUST NOT IMPLEMENT

❌ Category sorting
❌ Repack
❌ Inventory
❌ Rag selection
❌ Container selection

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

Reuse ONLY:

* ThriftUI `Card`
* ThriftUI `Table`
* ThriftUI `Input`
* ThriftUI `Badge`
* ThriftUI spacing & typography
* Same layout patterns from Phase 3

🚫 No redesign
🚫 No creative changes
🚫 No alternate layouts

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
src/app/modules/sorting-stage2/
 ├── sessions/
 │   ├── grading-session-list.page.ts
 │   └── grading-session-detail.page.ts
 ├── workspace/
 │   ├── grade-bucket.component.ts
 │   ├── waste-bucket.component.ts
 │   ├── totals-panel.component.ts
 ├── sorting-stage2.routes.ts
 └── sorting-stage2.service.ts
```

Lazy-loaded at:

```
/sorting/stage2
```

---

## 📄 GRADING SESSION LIST

### Route

```
/sorting/stage2
```

Table (dense ERP):

* Session ID
* Container Ref
* Rag/Bale ID
* Stage 1 Session ID
* Category
* Status
* Created Date

Actions:

* Continue (OPEN)
* View Summary (CLOSED)

🚫 Create button here
(Session creation happens from Stage 1 output list)

---

## ➕ START GRADING (ENTRY POINT)

Grading sessions are created ONLY from:

```
Sorting Stage 1 → Category Output → “Start Grading”
```

Backend provides:

```
sortedCategoryItemId
```

---

## 🧺 GRADING WORKSPACE (CORE SCREEN)

### Route

```
/sorting/stage2/:sessionId
```

---

### HEADER (MANDATORY — TRACEABILITY)

Always display:

```
Container: C-2024-09
Rag/Bale: RAG-004
Stage 1 Session: SS1-0021
Category: Shirts
Original Category Weight: 34 KG
```

This header must be persistent.

---

## 📐 WORKSPACE LAYOUT (LOCKED — SAME AS PHASE 3)

```
┌───────────────┬──────────────────────────────┐
│ Grades        │ Grading Input Area            │
│ (Left Panel)  │                              │
├───────────────┼──────────────────────────────┤
│ Waste Bucket  │ Totals Panel (Right)          │
└───────────────┴──────────────────────────────┘
```

---

## 🧺 GRADE BUCKETS

Buckets:

* Grade 1
* Grade 2
* Grade 3

Each bucket:

* ThriftUI Card
* Accepts weight OR quantity
* Shows allocated total

Rules:

* Numeric only
* Immediate validation
* No free text

---

## 🗑️ WASTE BUCKET

* Mandatory
* Same UI as grade bucket
* Muted danger accent
* Included in totals

---

## 📊 TOTALS PANEL

Read-only:

* Input weight
* Graded total
* Waste
* Yield %

🚫 Charts
🚫 Animations

---

## 🔁 SESSION STATE RULES (HARD)

### OPEN

* Editable
* Buckets enabled

### CLOSED

* Entire UI read-only
* Summary view only

Closing session:

* Requires confirmation
* Locks grading permanently

---

## 🚫 VISIBILITY & SAFETY RULES

* Stage 1 output can be graded only once
* Closed grading sessions never reopen
* No re-grading allowed
* No orphan grade records

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Over-allocation
* Missing totals
* Concurrent grading
* Network failure

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/sorting-stage2/workspace/grade-bucket \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Grading starts without Stage 1 output
* Lineage header missing
* Stage 1 output graded twice
* UI deviates from Phase 3 patterns
* ThriftUI is bypassed

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 4**, including:

✔ Grading session list
✔ Grading workspace
✔ Grade & waste buckets
✔ Totals panel
✔ Stage 1 dependency enforcement
✔ Full lineage display
✔ UI consistency with Phase 3

❌ Do NOT implement repack
❌ Do NOT implement inventory
❌ Do NOT implement reports

Output **real Angular 21 code**, production-ready.