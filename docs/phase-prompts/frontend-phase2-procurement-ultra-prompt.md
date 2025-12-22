You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 2** for **ThriftOS**, a **multi-tenant thrift ERP SaaS**.

This phase implements the **Procurement module UI**, covering **all procurement workflows supported by the backend**, including:

* Container-level procurement
* Loose bale procurement
* Shipment & reference tracking
* Weight-based costing
* Automated cost allocation (visualized)
* Multi-stage procurement lifecycle

🚫 NO sorting
🚫 NO grading
🚫 NO inventory intake
🚫 NO sales / POS
🚫 NO backend assumptions

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, the AI agent MUST:

1. Read:

   * `docs/architecture/backend-feature-register.md`
   * `docs/architecture/frontend-backend-coverage-matrix.md`
   * `docs/security/frontend-permissions-map.md`
2. Identify **Procurement backend features**:

   * Container procurement
   * Loose bale procurement
   * Vendors
   * Shipment details
   * Cost allocation
   * Procurement states
3. Confirm **each backend feature has UI coverage**
4. Fail execution if **any feature is missing or partially implemented**

---

## 🧠 PHASE 2 SCOPE (LOCKED)

### This phase MUST implement:

✔ Procurement dashboard
✔ Container procurement create / view / update
✔ Loose bale procurement create / view / update
✔ Vendor selection & creation (inline)
✔ Shipment details capture
✔ Cost breakdown & allocation visualization
✔ Procurement status lifecycle
✔ Read-only views for closed procurement

### This phase MUST NOT implement:

❌ Sorting (Stage 1 / 2)
❌ Repack
❌ Inventory intake
❌ Reports
❌ Tenant admin configs

---

## 🧱 TECH & STYLE CONSTRAINTS (INHERITED)

* Angular 21
* Angular CLI ONLY
* Standalone components
* SCSS + Tailwind layering
* Inter font
* Lucide icons
* Light ERP theme
* OnPush change detection
* Signals for derived UI state

🚫 No dark UI
🚫 No inline styles
🚫 No manual file creation

---

## ⚙️ ROUTING & MODULE STRUCTURE

### Procurement Module

```
src/app/modules/procurement/
 ├── dashboard/
 │   └── procurement-dashboard.page.ts
 ├── containers/
 │   ├── container-list.page.ts
 │   ├── container-create.page.ts
 │   ├── container-detail.page.ts
 ├── loose-bales/
 │   ├── loose-bale-list.page.ts
 │   ├── loose-bale-create.page.ts
 │   ├── loose-bale-detail.page.ts
 ├── shared/
 │   ├── vendor-select.component.ts
 │   ├── shipment-details.form.ts
 │   ├── cost-breakdown.panel.ts
 ├── procurement.routes.ts
 └── procurement.service.ts
```

Lazy loaded at:

```
/procurement
```

---

## 🔐 RBAC & ACCESS RULES

Permissions required (from permissions map):

```
PROCUREMENT_VIEW
PROCUREMENT_CREATE
PROCUREMENT_UPDATE
```

### Tenant Status Rule (MANDATORY)

If:

```
tenant.status !== ACTIVE
```

Then:

* All create/edit actions disabled
* UI becomes read-only
* Warning banner displayed

---

## 📊 PROCUREMENT DASHBOARD

### Route

```
/procurement
```

### Widgets (Lightweight, ERP-safe)

* Total active procurements
* Containers vs Loose Bales
* Total weight procured
* Total cost (currency aware)

No charts — numeric summary only.

---

## 📦 CONTAINER PROCUREMENT FLOW

### Create Container Procurement

Route:

```
/procurement/containers/create
```

Fields:

* Vendor
* Container Number
* Reference Number
* Container Type (e.g., France DC)
* Expected Weight
* Total Cost
* Currency
* Arrival Date
* Notes

Shipment Section:

* Bill of Lading
* Port
* Arrival date
* Shipment ref

Behavior:

* Draft by default
* Validation on required fields
* Save → DRAFT
* Mark Received → RECEIVED
* Close → CLOSED (read-only)

---

## 🧺 LOOSE BALE PROCUREMENT FLOW

### Create Loose Bale Procurement

Route:

```
/procurement/loose-bales/create
```

Fields:

* Vendor
* Bale type (single / mixed)
* Weight
* Cost
* Currency
* Reference
* Notes

Supports:

* Mixed categories
* Multiple vendors over time

---

## 🧾 COST BREAKDOWN & ALLOCATION (VISUAL ONLY)

Component:

```
cost-breakdown.panel.ts
```

Displays:

* Total cost
* Cost per KG
* Cost per bale (if applicable)

🚫 No calculations on frontend
✔ Backend values only

---

## 🧑‍💼 VENDOR MANAGEMENT (INLINE)

* Vendor select dropdown
* Inline “Add Vendor” drawer
* Tenant-scoped vendors only

Permissions:

```
PROCUREMENT_CREATE
```

---

## 🔁 PROCUREMENT STATUS LIFECYCLE (UI RULES)

States (from backend enums):

* DRAFT
* RECEIVED
* CLOSED

UI Behavior:

* DRAFT → editable
* RECEIVED → limited edits
* CLOSED → fully read-only

All transitions require confirmation dialog.

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* 403 → Access denied
* 400 → Validation errors
* 409 → Duplicate reference/container
* Network failure → Retry UI

---

## 🧱 UI / UX RULES (PROCUREMENT-SPECIFIC)

✔ Clear numeric formatting
✔ Weight units visible (KG)
✔ Currency symbols explicit
✔ Dense ERP tables
✔ Status badges

No charts.
No animations masking state.

---

## 🛠️ ANGULAR CLI GENERATION RULES

All files MUST be generated via Angular CLI:

```bash
ng generate component modules/procurement/containers/container-create \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

Same rule for services & shared components.

---

## 🧪 QUALITY & AI-SAFETY RULES

* No mock data
* No TODOs
* No backend logic
* No missing backend feature mapping
* Fail if coverage incomplete

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 2 (Procurement UI)** including:

✔ Dashboard
✔ Container procurement flows
✔ Loose bale procurement flows
✔ Vendor selection & inline creation
✔ Shipment details UI
✔ Cost breakdown visualization
✔ Status lifecycle enforcement
✔ RBAC enforcement

❌ Do NOT implement sorting
❌ Do NOT implement inventory
❌ Do NOT implement reports

Output **real Angular 21 code**, fully compliant with Phase 0 & Phase 1.