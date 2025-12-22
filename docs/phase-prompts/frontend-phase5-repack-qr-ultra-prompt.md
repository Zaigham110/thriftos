You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 5** of **ThriftOS**, where **graded items are repacked into sellable units** and **QR codes are generated**.

This phase bridges **operations → inventory**, so it must be:

* Strict
* Traceable
* Audit-safe
* Impossible to misuse
* Visually consistent

🚫 No sorting here
🚫 No grading here
🚫 No inventory posting here

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Repacking can ONLY be done from CLOSED Sorting Stage 2 (Grading) outputs.**

Hard rules:

* ❌ Cannot repack directly from Stage 1
* ❌ Cannot repack Rag/Bale directly
* ❌ Cannot repack same graded output twice
* ❌ Cannot create repack units without lineage

Violation = **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/architecture/domain-update-container-rag-sorting.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`
* `docs/security/frontend-permissions-map.md`

AI must confirm backend provides:

```
containerId
ragBaleId
sortingStage1SessionId
sortingStage2SessionId
```

---

## 🧠 PHASE 5 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Repack session list
✔ Repack workspace
✔ Create repack units (KG or PCS)
✔ Mixed repack support (allowed)
✔ QR code generation & preview
✔ Session lifecycle (OPEN → SEALED)
✔ Read-only sealed sessions
✔ Full lineage display

### MUST NOT IMPLEMENT

❌ Inventory posting
❌ Sales / POS
❌ Price management
❌ Printing logic (preview only)

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

Reuse:

* ThriftUI Cards
* ThriftUI Tables
* ThriftUI Inputs
* ThriftUI Badges
* Same spacing & layout as Phase 3 & 4

🚫 No redesign
🚫 No grid changes
🚫 No visual experiments

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
🚫 Manual file creation
🚫 Dark UI

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/repack/
 ├── sessions/
 │   ├── repack-session-list.page.ts
 │   └── repack-session-detail.page.ts
 ├── workspace/
 │   ├── repack-unit.form.ts
 │   ├── repack-unit-table.component.ts
 │   ├── qr-preview.component.ts
 │   ├── totals-panel.component.ts
 ├── repack.routes.ts
 └── repack.service.ts
```

Lazy-loaded at:

```
/repack
```

---

## 📄 REPACK SESSION LIST

### Route

```
/repack
```

Table (ERP-dense):

* Session ID
* Container Ref
* Rag/Bale ID
* Stage 2 Session ID
* Status
* Created Date

Actions:

* Continue (OPEN)
* View Summary (SEALED)

🚫 Create button here
(Session creation happens from Stage 2 output list)

---

## ➕ START REPACK (ENTRY POINT)

Repack sessions are created ONLY from:

```
Sorting Stage 2 → Graded Output → “Start Repack”
```

Backend provides:

```
gradedItemId
```

---

## 📦 REPACK WORKSPACE (CORE SCREEN)

### Route

```
/repack/:sessionId
```

---

### HEADER (MANDATORY — TRACEABILITY)

Always display:

```
Container: C-2024-09
Rag/Bale: RAG-004
Stage 1 Session: SS1-0021
Stage 2 Session: SS2-0012
Category: Shirts
Grade: Grade 1
```

Persistent header — never scrolls away.

---

## 📐 WORKSPACE LAYOUT (LOCKED)

```
┌───────────────────────────────┬──────────────────────┐
│ Repack Unit Entry             │ Totals Panel         │
├───────────────────────────────┼──────────────────────┤
│ Repack Units Table            │ QR Preview           │
└───────────────────────────────┴──────────────────────┘
```

---

## 📦 REPACK UNIT CREATION

### Supported Unit Types

* **Weight-based**

  * e.g. Bale of Shirts — 40 KG
* **Quantity-based**

  * e.g. Jeans Pack — 200 PCS
* **Mixed allowed** (if backend permits)

### Fields

* Unit Type (KG / PCS)
* Quantity OR Weight
* Notes (optional)

Rules:

* Numeric only
* Cannot exceed remaining graded quantity
* Immediate validation feedback

---

## 🔢 TOTALS PANEL

Read-only:

* Input graded quantity/weight
* Repacked total
* Remaining balance

🚫 No charts
🚫 No animations

---

## 🔳 QR CODE GENERATION (MANDATORY)

### When QR is Generated

* On repack unit creation
* Re-generated only on unit change

### QR Payload MUST contain:

```json
{
  "containerId": "...",
  "ragBaleId": "...",
  "sortingStage1SessionId": "...",
  "sortingStage2SessionId": "...",
  "repackUnitId": "...",
  "tenantId": "..."
}
```

🚫 No short hashes
🚫 No frontend-only QR data

---

## 🔳 QR PREVIEW COMPONENT

* Display QR as SVG
* Display human-readable ID below
* Read-only
* Print handled in future phase

---

## 🔁 SESSION STATE RULES (HARD)

### OPEN

* Can add/edit repack units
* QR regenerates dynamically

### SEALED

* Fully read-only
* No edits
* QR locked permanently

Closing session:

* Requires confirmation
* Backend locks all units

---

## 🚫 VISIBILITY & SAFETY RULES

* Graded output can be repacked only once
* SEALED sessions never reopen
* No orphan repack units
* No repack without grading

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Over-repack attempt
* Network failure
* Concurrent session lock
* Permission denial

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/repack/workspace/repack-unit-form \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Repack starts without Stage 2
* QR payload missing lineage
* Same graded output repacked twice
* UI deviates from earlier phases
* ThriftUI is bypassed

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 5**, including:

✔ Repack session list
✔ Repack workspace
✔ Repack unit creation
✔ QR generation & preview
✔ Session lifecycle enforcement
✔ Full lineage display
✔ UI consistency with Phase 3 & 4

❌ Do NOT implement inventory posting
❌ Do NOT implement sales
❌ Do NOT implement printing

Output **real Angular 21 code**, production-ready.