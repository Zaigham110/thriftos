You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 8** of **ThriftOS**, which provides **tenant-level administration and configuration**.

This phase is for:

* Company owners
* Tenant admins
* HR / Ops managers (permission-based)

🚫 NO Super Admin features
🚫 NO operational workflows
🚫 NO data mutation outside config scope

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Phase 8 is CONFIGURATION ONLY.**

Hard rules:

* ❌ No procurement
* ❌ No sorting
* ❌ No grading
* ❌ No repack
* ❌ No inventory manipulation
* ❌ No reports mutation

Violation = **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/security/frontend-permissions-map.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`

AI must confirm:

* Tenant Admin APIs exist
* Permissions are backend-driven
* No tenant lifecycle endpoints are exposed here

---

## 🧠 PHASE 8 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Tenant profile & settings
✔ User management (tenant-only)
✔ Role & permission assignment
✔ Category management
✔ Warehouse management
✔ Vendor management
✔ Currency & units configuration
✔ Workflow visibility settings

### MUST NOT IMPLEMENT

❌ Tenant creation
❌ Tenant deletion
❌ Tenant deactivation
❌ Billing & plans (Super Admin only)
❌ Global system settings

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

Reuse ONLY:

* ThriftUI Cards
* ThriftUI Tables
* ThriftUI Forms
* ThriftUI Modals / Drawers
* Same spacing, typography, colors

🚫 No redesign
🚫 No new navigation paradigms
🚫 No dashboard creativity

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
* Reactive Forms only

🚫 Inline styles
🚫 Manual file creation
🚫 Dark UI

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/admin/
 ├── tenant/
 │   └── tenant-settings.page.ts
 ├── users/
 │   ├── user-list.page.ts
 │   └── user-form.drawer.ts
 ├── roles/
 │   ├── role-list.page.ts
 │   └── role-permissions.drawer.ts
 ├── categories/
 │   └── category-management.page.ts
 ├── warehouses/
 │   └── warehouse-management.page.ts
 ├── vendors/
 │   └── vendor-management.page.ts
 ├── config/
 │   ├── currency-settings.page.ts
 │   ├── unit-settings.page.ts
 │   └── workflow-settings.page.ts
 ├── admin.routes.ts
 └── admin.service.ts
```

Lazy-loaded at:

```
/admin
```

---

## 🏢 TENANT SETTINGS

### Route

```
/admin/tenant
```

Editable:

* Company name
* Logo
* Address
* Contact details
* Default warehouse (optional)

🚫 No plan info
🚫 No billing

---

## 👥 USER MANAGEMENT

### Route

```
/admin/users
```

Table:

* Name
* Email
* Role(s)
* Status

Actions:

* Invite user
* Edit user
* Activate / deactivate

Permissions enforced per backend RBAC.

---

## 🔐 ROLE & PERMISSIONS

### Route

```
/admin/roles
```

* Create custom roles
* Assign permissions via checkbox matrix
* Permission list MUST be backend-driven

🚫 No hardcoded permissions

---

## 🗂️ CATEGORY MANAGEMENT

### Route

```
/admin/categories
```

Manage:

* Categories (Shirts, Pants, etc.)
* Measurement type (KG / PCS)
* Active / inactive

Used by:

* Sorting Stage 1
* Reports

---

## 🏭 WAREHOUSE MANAGEMENT

### Route

```
/admin/warehouses
```

Manage:

* Warehouse name
* Location
* Active flag

🚫 No stock editing here

---

## 🏷️ VENDOR MANAGEMENT

### Route

```
/admin/vendors
```

Manage:

* Vendor name
* Contact info
* Vendor type (Container / Loose)

Used by:

* Procurement
* Reports

---

## ⚙️ CONFIGURATION

### Currency Settings

```
/admin/config/currency
```

* Default currency
* Decimal precision

### Unit Settings

```
/admin/config/units
```

* KG / PCS availability

### Workflow Settings

```
/admin/config/workflows
```

* Enable / disable phases (future-safe)
* Read-only toggles

🚫 No logic overrides

---

## 🔒 RBAC & PERMISSION ENFORCEMENT (MANDATORY)

* Every page checks permission before rendering
* Navigation hides unauthorized items
* Backend permission is final authority

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Permission denied → Access Denied
* Duplicate entries → Validation error
* Network failure → Retry
* Concurrent updates → Reload notice

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/admin/users/user-list \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Tenant lifecycle actions appear
* Super Admin features leak in
* Config pages mutate operational data
* Permissions are hardcoded
* UI deviates from prior phases

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 8**, including:

✔ Tenant settings
✔ User management
✔ Role & permission UI
✔ Categories
✔ Warehouses
✔ Vendors
✔ Config screens
✔ RBAC enforcement

❌ Do NOT implement Super Admin features
❌ Do NOT implement billing
❌ Do NOT implement operational workflows

Output **real Angular 21 code**, production-ready.