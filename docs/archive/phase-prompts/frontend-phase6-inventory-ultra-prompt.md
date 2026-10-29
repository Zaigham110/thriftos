You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 6** of **ThriftOS**, where **SEALED repack units officially become inventory stock** and are tracked via a **ledger-based inventory engine**.

This phase is **audit-critical** and must be:

* Strict
* Traceable
* Append-only in spirit
* Impossible to fake or bypass
* Visually consistent

🚫 No procurement
🚫 No sorting
🚫 No grading
🚫 No repacking
🚫 No sales / POS

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Inventory records can ONLY be created from SEALED Repack Units.**

Hard rules:

* ❌ No manual inventory creation
* ❌ No inventory without Repack Unit
* ❌ No inventory edits (ledger only)
* ❌ No inventory without full lineage

Violation = **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/architecture/domain-update-container-rag-sorting.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`
* `docs/security/frontend-permissions-map.md`

AI must confirm backend exposes:

```
inventoryItemId
repackUnitId
containerId
ragBaleId
sortingStage1SessionId
sortingStage2SessionId
```

---

## 🧠 PHASE 6 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Inventory dashboard
✔ Inventory item list
✔ Inventory item detail (ledger view)
✔ Warehouse selection (view-only)
✔ Stock availability view
✔ Full source lineage display

### MUST NOT IMPLEMENT

❌ Manual stock creation
❌ Stock edits / overrides
❌ Transfers (future phase)
❌ Sales / dispatch
❌ Accounting valuation

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

Reuse:

* ThriftUI Cards
* ThriftUI Tables
* ThriftUI Badges
* ThriftUI Layout spacing
* Same totals panels & headers as Phase 3–5

🚫 No redesign
🚫 No new table styles
🚫 No new interaction patterns

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
* Signals for derived UI state

🚫 Inline styles
🚫 Manual file creation
🚫 Dark UI

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/inventory/
 ├── dashboard/
 │   └── inventory-dashboard.page.ts
 ├── items/
 │   ├── inventory-list.page.ts
 │   └── inventory-detail.page.ts
 ├── ledger/
 │   └── inventory-ledger.table.ts
 ├── shared/
 │   ├── lineage-panel.component.ts
 │   └── warehouse-badge.component.ts
 ├── inventory.routes.ts
 └── inventory.service.ts
```

Lazy-loaded at:

```
/inventory
```

---

## 📊 INVENTORY DASHBOARD

### Route

```
/inventory
```

Widgets (numeric only, no charts):

* Total inventory units
* Total weight (KG)
* Inventory by category
* Inventory by warehouse

Read-only summary.

---

## 📦 INVENTORY LIST

### Route

```
/inventory/items
```

Table (ERP-dense):

* Inventory ID
* Category
* Grade
* Quantity / Weight
* Warehouse
* Status
* Created Date

Actions:

* View Detail

🚫 No edit
🚫 No create

---

## 📄 INVENTORY ITEM DETAIL (CORE SCREEN)

### Route

```
/inventory/items/:id
```

---

### HEADER (MANDATORY — TRACEABILITY)

Always display:

```
Inventory ID: INV-00291
Category: Shirts
Grade: Grade 1
Unit Type: KG
Quantity / Weight: 40 KG
Warehouse: WH-KHI-01
```

---

## 🔗 LINEAGE PANEL (MANDATORY)

Persistent, read-only panel showing:

```
Container: C-2024-09
Rag/Bale: RAG-004
Stage 1 Session: SS1-0021
Stage 2 Session: SS2-0012
Repack Unit: RP-0088
```

This panel MUST exist on every inventory detail page.

---

## 📜 INVENTORY LEDGER (APPEND-ONLY VIEW)

Component:

```
inventory-ledger.table.ts
```

Displays chronological entries:

* Event Type (Created / Adjusted / Reserved*)
* Quantity / Weight
* Timestamp
* Actor (system/user)

* Reservation events may appear later (future phase).

🚫 No inline editing
🚫 No deletion

---

## 🔁 INVENTORY STATUS RULES (READ-ONLY)

Statuses:

* AVAILABLE
* RESERVED (future)
* DISPATCHED (future)

For this phase:

* All inventory is **AVAILABLE**
* Other statuses are view-only placeholders

---

## 🚫 VISIBILITY & SAFETY RULES

* Inventory without lineage MUST NEVER render
* Inventory without repack source MUST FAIL
* Ledger rows cannot be hidden
* No client-side calculations

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Missing lineage → error screen
* Permission denied → access denied
* Network failure → retry
* Deleted upstream data → show archived reference

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/inventory/items/inventory-detail \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Inventory appears without repack unit
* Lineage panel missing
* Ledger editable
* UI deviates from earlier phases
* ThriftUI is bypassed

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 6**, including:

✔ Inventory dashboard
✔ Inventory list
✔ Inventory detail
✔ Lineage panel
✔ Ledger table
✔ Warehouse display
✔ Full backend rule compliance

❌ Do NOT implement transfers
❌ Do NOT implement sales
❌ Do NOT implement accounting

Output **real Angular 21 code**, production-ready.