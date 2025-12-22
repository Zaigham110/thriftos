You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 1** for **ThriftOS**, a **multi-tenant ERP SaaS**.

This phase establishes the **SaaS control plane UI**:

* Authentication
* Application shell
* Permission-based navigation
* **Super Admin tenant lifecycle**
* **Tenant impersonation**
* Backend feature coverage validation

🚫 NO business ERP workflows
🚫 NO procurement / sorting / inventory
🚫 NO guessing backend behavior

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before writing code, the AI agent MUST:

1. Read:

   * `docs/architecture/backend-feature-register.md`
   * `docs/architecture/frontend-backend-coverage-matrix.md`
   * `docs/security/frontend-permissions-map.md`
2. Identify **Phase 1 backend features**:

   * Super Admin tenant management
   * Impersonation
   * Auth session handling
3. Confirm **100% UI coverage** for those features
4. Fail execution if **any Phase 1 backend feature lacks UI**

This rule is **non-optional**.

---

## 🧠 PHASE 1 SCOPE (LOCKED)

### This phase MUST implement:

✔ Login UI (visual + logic)
✔ Logout
✔ Auth guards
✔ App shell (header + sidebar)
✔ Permission-driven navigation
✔ **Super Admin tenant CRUD**
✔ **Tenant impersonation with safety UX**
✔ Error handling & access denial states

### This phase MUST NOT implement:

❌ Procurement
❌ Sorting
❌ Inventory
❌ Reports
❌ Tenant admin configs (Phase 8)

---

## 🧱 TECH & STYLE CONSTRAINTS (INHERITED FROM PHASE 0)

* Angular 21
* Angular CLI only
* Standalone components
* SCSS + Tailwind
* Inter font
* Lucide icons
* Light ERP theme only
* OnPush change detection
* Signals for derived state

🚫 No dark UI
🚫 No inline styles
🚫 No manual file creation

---

## ⚙️ ROUTING & MODULE STRUCTURE

### App Shell

```
src/app/core/layout/
 ├── app-shell.component.ts
 ├── header.component.ts
 ├── sidebar.component.ts
 ├── impersonation-banner.component.ts
```

### Super Admin Module

```
src/app/modules/admin/super-admin/
 ├── tenants/
 │   ├── tenants-list.page.ts
 │   ├── tenant-detail.page.ts
 │   ├── tenant-form.drawer.ts
 │   ├── tenants.service.ts
 │   └── tenants.routes.ts
```

Lazy loaded at:

```
/admin/super
```

---

## 🔐 AUTHENTICATION UI

### Login Page

Route:

```
/login
```

Layout:

* Uses Phase 0 login foundation
* Left: Brand panel (logo, tagline)
* Right: Login form

Fields:

* Email
* Password

Behavior:

1. POST `/auth/login`
2. Store JWT securely
3. Load user profile + permissions
4. Redirect:

   * Super Admin → `/admin/super/tenants`
   * Tenant User → `/app/dashboard`

Error states:

* Invalid credentials
* Network failure
* Disabled user

---

## 🛡️ AUTH & PERMISSION GUARDS

Generate via Angular CLI:

* `AuthGuard`
* `SuperAdminGuard`
* `PermissionGuard`

Rules:

* Super Admin routes require `SUPER_ADMIN` role
* Tenant users cannot access `/admin/super/*`
* Unauthorized → 403 page (not silent redirect)

---

## 🧑‍💼 SUPER ADMIN — TENANT MANAGEMENT UI

### Backend APIs (AUTHORITATIVE)

```http
POST   /superadmin/tenants
GET    /superadmin/tenants
GET    /superadmin/tenants/:id
PATCH  /superadmin/tenants/:id
POST   /superadmin/tenants/:id/impersonate
```

🚫 No alternate endpoints
🚫 No mock APIs

---

### Tenants List Page

Route:

```
/admin/super/tenants
```

Table:

* Company Name
* Company Code
* Currency
* Status (Active / Inactive)
* Created Date

Actions:

* View
* Edit
* Activate / Deactivate
* Impersonate

Design:

* Dense ERP table
* Status badges
* Confirmation dialogs for destructive actions

---

### Create / Edit Tenant (Drawer)

Fields:

* Company Name
* Company Code (immutable after create)
* Currency
* Locale
* Status

Rules:

* Company Code unique
* Inline validation
* Deactivation confirmation required

---

## 🧑‍💻 TENANT IMPERSONATION (CRITICAL)

### Trigger

```
POST /superadmin/tenants/:id/impersonate
```

### Frontend Behavior

1. Receive impersonation token
2. Replace auth context
3. Redirect to:

```
https://{tenant}.thriftos.com/app
```

---

### Impersonation UX RULES (NON-NEGOTIABLE)

While impersonating:

* Persistent banner at top
* Text:

  > “You are impersonating {Tenant Name}”
* High-visibility warning style
* “Exit Impersonation” button

Exit:

```
POST /auth/exit-impersonation
```

On exit:

* Restore Super Admin session
* Redirect to tenant list

---

## 🧭 MENU & NAVIGATION RULES

### Super Admin Menu

```
Admin
 └── Super Admin
     └── Tenants
```

### Tenant Users

* Must NEVER see Super Admin menu
* Must NEVER reach Super Admin routes

Menus driven entirely by permissions.

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* 401 → redirect to login
* 403 → access denied page
* 409 → company code conflict
* 400 → validation errors
* Network failure → retry option

---

## 🧱 UI / UX RULES (ERP-SAFE)

✔ Calm, light UI
✔ Dense tables
✔ Clear confirmations
✔ No hidden state
✔ No animations masking actions

This UI must feel **authoritative and safe**.

---

## 🛠️ ANGULAR CLI GENERATION RULES

All code MUST be generated via Angular CLI:

```bash
ng generate component modules/admin/super-admin/tenants/tenants-list \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

Same rule for services, guards, banners.

---

## 🧪 QUALITY & AI-SAFETY RULES

* No TODOs
* No placeholder logic
* No UI without backend feature mapping
* No permissions not in permissions map
* Fail if backend coverage incomplete

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 1**, including:

✔ Login UI & logic
✔ App shell
✔ Guards
✔ Permission-driven navigation
✔ Super Admin tenant management
✔ Impersonation UX
✔ Error handling

❌ Do NOT implement business ERP modules
❌ Do NOT add tenant admin configs
❌ Do NOT bypass RBAC

Output **real Angular 21 code**, fully compliant with Phase 0.