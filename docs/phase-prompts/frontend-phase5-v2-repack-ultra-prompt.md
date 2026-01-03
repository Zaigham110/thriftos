You are a **Principal Angular Frontend Engineer** working on **ThriftOS**.

Your task is to implement **Frontend Phase 5 v2**, which allows warehouse users to create **final repack units** by consuming **graded outputs from multiple containers**, using either:

* **FIFO (automatic allocation)**
* **Manual selection (user-defined allocation)**

This phase reflects **real warehouse behavior** and must remain **audit-safe and traceable**.

---

## 🔒 ABSOLUTE NON-NEGOTIABLE RULES

1. ❌ Do NOT change backend contracts
2. ❌ Do NOT invent new workflows
3. ❌ Do NOT weaken validation
4. ❌ Do NOT allow over-allocation
5. ❌ Do NOT mix weight & quantity in one repack
6. ❌ Do NOT break UI consistency with the new design system
7. ❌ Do NOT bypass RBAC

If a backend constraint blocks a UI action, the UI must **respect and surface it**.

---

## 🎯 OBJECTIVE (LOCKED)

Enable users with `REPACK_ALLOCATE` permission to:

* Create a repack unit
* Choose **allocation mode**:

  * FIFO (automatic)
  * Manual (user-controlled)
* Build a **single sellable pack** using inputs from **multiple containers**
* Seal the repack and generate QR-linked inventory

---

## 🧠 HIGH-LEVEL USER FLOW

```
Repack List
 → Create Repack
   → Select Category + Grade
   → Select Measurement Type (KG | PCS)
   → Enter Target Amount
   → Choose Allocation Mode (FIFO | Manual)
   → Allocate Inputs
   → Validate Totals
   → Seal Repack
   → Inventory Created + QR Generated
```

---

## 🧱 ROUTING & MODULE STRUCTURE

```
src/app/modules/repack/
 ├── list/
 │   └── repack-list.page.ts
 ├── create/
 │   └── repack-create.page.ts
 ├── allocations/
 │   ├── fifo-preview.component.ts
 │   ├── manual-allocation-table.component.ts
 │   └── allocation-summary.component.ts
 ├── shared/
 │   ├── grading-output-selector.service.ts
 │   └── repack-permission.guard.ts
 ├── repack.routes.ts
 └── repack.service.ts
```

Lazy-loaded at:

```
/repack
```

---

## 🎨 UI DESIGN RULES (MANDATORY)

* Use **new redesigned design system only**
* Light background, enterprise density
* Card-based layout
* Tables for allocations
* Badges for status (`AVAILABLE`, `PARTIAL`, `DEPLETED`)
* Progress indicator for target completion
* No dark UI
* No inline styles
* SCSS + Tailwind only

---

## 🔐 PERMISSIONS (HARD RULE)

* User MUST have `REPACK_ALLOCATE`
* If not:

  * Hide “Create Repack”
  * Block route access
* Allocation mode selector visible only if permission exists

---

## 🧩 CREATE REPACK SCREEN (CORE)

### Step 1 — Repack Definition (Form)

Fields:

* Category (dropdown from DB)
* Grade (A / B / C)
* Measurement Type (auto from category config)
* Target Amount (kg or pcs)
* Allocation Mode:

  * ● FIFO (Automatic)
  * ○ Manual Selection

🚫 Category is NOT free-text
🚫 Measurement type cannot be changed after allocations begin

---

## 🔁 FIFO MODE UI

### Behavior

* User does NOT select sources
* On “Preview Allocation”:

  * Call backend FIFO preview/creation endpoint
* Show:

  * Read-only allocation table
  * Source container
  * Source grading output
  * Amount allocated per source

### UI Rules

* Table is read-only
* Badge: `System Allocated`
* Show warning if FIFO stock is insufficient

---

## ✋ MANUAL MODE UI

### Behavior

* Show table of **available grading outputs**
* Columns:

  * Container Code
  * Category
  * Grade
  * Remaining Amount
  * Input Amount (editable)
* User can add/remove rows

### Validation (Live)

* Input ≤ remaining amount
* Total allocated = target amount
* All rows same measurement type

### UX Enhancements

* Show remaining target amount
* Highlight over-allocation instantly
* Disable “Seal” until valid

---

## 📊 ALLOCATION SUMMARY (COMMON)

Always display:

* Target Amount
* Allocated Amount
* Remaining (must be zero to seal)
* Number of source containers used

---

## 🔒 SEAL REPACK (CRITICAL)

On seal:

* Disable all inputs
* Call backend seal endpoint
* On success:

  * Navigate to repack detail
  * Show QR code
  * Show allocation breakdown (read-only)

🚫 No edits after seal
🚫 No partial seal

---

## 📦 INVENTORY & QR DISPLAY

After seal:

* Display:

  * Repack Code
  * Category / Grade
  * Final Amount
  * QR Code
* QR links to repack detail with full traceability

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Insufficient FIFO stock
* Concurrent depletion
* Permission denied
* Network failure
* Backend validation errors

Errors must be **clear, blocking, and actionable**.

---

## 🛠️ ANGULAR IMPLEMENTATION RULES

* Angular CLI ONLY
* Standalone components
* OnPush change detection
* Reactive Forms
* Signals for derived totals
* Guards for route protection

Example:

```bash
ng generate component modules/repack/create/repack-create \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 QA SAFETY CHECKS (MANDATORY)

The UI MUST ensure:

* No reuse of depleted grading output
* No exceeding remaining amount
* No kg/pcs mixing
* No bypass of backend rules
* No visual regression with new theme

---

## 📄 REQUIRED OUTPUT FORMAT (FROM COPILOT)

### 1️⃣ Components Created

### 2️⃣ Routes Added

### 3️⃣ Permissions Enforced

### 4️⃣ Validations Implemented

### 5️⃣ What Was NOT Changed

---

## 🚨 FAILURE CONDITIONS

This implementation is INVALID if:

* Allocation logic is duplicated on frontend
* FIFO is editable
* Manual allows invalid totals
* Old UI styles appear
* Backend constraints are bypassed

---

## 🎯 FINAL GOAL

Deliver a **warehouse-realistic, audit-safe, enterprise-grade Repack UI** that:

* Supports mixed containers
* Supports FIFO & Manual
* Supports weight & quantity
* Preserves traceability
* Feels fast and professional