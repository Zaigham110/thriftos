You are an **expert Angular 21 enterprise ERP frontend engineer**.

Your task is to implement **Frontend Phase 2: Procurement UI** for **ThriftOS V3**, strictly aligned with:

```
docs/architecture/thriftos-v3-architecture.md
docs/phase-prompts/phase2-procurement-ultra-prompt.md
docs/phase-prompts/frontend-phase0-ultra-prompt.md
docs/phase-prompts/frontend-phase1-auth-shell-ultra-prompt.md
```

Backend APIs are **frozen and authoritative**.

NO guessing
NO backend logic
NO schema assumptions

---

# ---------------------------------------------------------

# 🧠 1. PHASE 2 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Purchase Orders UI
✔ Container management UI
✔ Container charges UI
✔ Rag intake UI
✔ Incoming bale UI (loose & container-linked)
✔ Status-driven workflows
✔ Cost visibility (read-only)
✔ RBAC-aware actions

🚫 No sorting
🚫 No grading
🚫 No repack
🚫 No inventory

---

# ---------------------------------------------------------

# 🧱 2. MODULE STRUCTURE

# ---------------------------------------------------------

Create under:

```
src/app/modules/procurement/
 ├── purchase-orders/
 ├── containers/
 ├── container-charges/
 ├── rags/
 ├── incoming-bales/
 ├── vendors/
 ├── procurement.routes.ts
```

Each submodule MUST include:

* list page
* detail page
* drawer-based create/edit forms
* service.ts
* typed DTOs

---

# ---------------------------------------------------------

# 🧾 3. PURCHASE ORDERS UI

# ---------------------------------------------------------

## 📄 List Page — Purchase Orders

Table columns:

* PO Number
* Type (Container / Loose Bale)
* Vendor
* Currency
* Total Cost
* Status
* Created Date

Actions:

* View
* Edit (if OPEN)
* Receive
* Close

Filters:

* PO Type
* Status
* Date Range

RBAC:

```
PROCUREMENT_VIEW
PROCUREMENT_CREATE
PROCUREMENT_EDIT
PROCUREMENT_CLOSE
```

---

## 📄 Detail Page — Purchase Order

Tabs:

```
Overview | Containers | Incoming Bales | Activity
```

Overview shows:

* Vendor
* Currency
* Status
* Total Cost (read-only)

---

# ---------------------------------------------------------

# 📦 4. CONTAINERS UI

# ---------------------------------------------------------

## 📄 Containers List

Columns:

* Container Number
* Reference
* Type
* ETA
* Net Weight
* Status

Actions:

* View
* Edit
* Change Status

---

## 📄 Container Detail

Tabs:

```
Overview | Charges | Rags | Incoming Bales | Activity
```

Overview:

* Shipment metadata
* Weight
* Status

---

# ---------------------------------------------------------

# 💰 5. CONTAINER CHARGES UI

# ---------------------------------------------------------

Drawer form:

* Charge Type
* Description
* Amount

Rules:

* Editable only if container not CLOSED
* After save → refresh container cost

Display:

* Charges table
* Total container cost (computed backend)

---

# ---------------------------------------------------------

# 🧺 6. RAGS UI

# ---------------------------------------------------------

Rags List (scoped to container):

Columns:

* Rag Code
* Weight (KG)
* Allocated Cost (read-only)
* Created Date

Actions:

* Add Rag
* View

Rules:

* Cannot edit once created
* Cost always read-only

---

# ---------------------------------------------------------

# 🧾 7. INCOMING BALES UI

# ---------------------------------------------------------

Supports:
✔ Loose procurement
✔ Container-linked bales

Fields:

* Bale Code
* Vendor
* Weight
* Cost (if loose)
* Category Guess (optional)

Rules:

* If linked to container → cost auto-allocated
* If loose → cost entered manually

---

# ---------------------------------------------------------

# 🎛 8. UI PATTERNS (MANDATORY)

# ---------------------------------------------------------

✔ List → Drawer → Save
✔ No modal CRUD
✔ Status badges
✔ Skeleton loaders
✔ Empty states
✔ Confirmation dialogs for status changes

---

# ---------------------------------------------------------

# 🔐 9. PERMISSIONS & VISIBILITY

# ---------------------------------------------------------

Buttons & routes must be permission-aware:

* Hide Create/Edit buttons if permission missing
* Disable Receive/Close if not allowed
* Read-only view fallback

Frontend permissions DO NOT replace backend enforcement.

---

# ---------------------------------------------------------

# 🧪 10. ERROR & EDGE CASE HANDLING

# ---------------------------------------------------------

Handle:

* 403 → Access Denied page
* 409 → Show backend conflict message
* 400 → Validation feedback
* Network failures → retry option

---

# ---------------------------------------------------------

# 🧱 11. CODE QUALITY RULES (LOCKED)

# ---------------------------------------------------------

✔ Standalone components
✔ Typed reactive forms
✔ Services for API only
✔ No business logic in UI
✔ ThriftUI components only
✔ Tailwind utilities only

---

# ---------------------------------------------------------

# 🚀 12. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete Frontend Phase 2 (Procurement UI)** including:

✔ Routes
✔ Pages
✔ Drawer forms
✔ Services
✔ Permission guards
✔ Status workflows
✔ Cost visibility

❌ Do NOT mock data
❌ Do NOT add sorting/grading UI
❌ Do NOT bypass permissions

Output code directly into project files.