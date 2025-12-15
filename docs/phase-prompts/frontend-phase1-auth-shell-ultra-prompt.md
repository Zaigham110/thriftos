You are an **elite Angular 21 enterprise SaaS frontend engineer**.

You are implementing **Frontend Phase 1** for **ThriftOS**, a **multi-tenant ERP SaaS**.

This phase establishes the **entire SaaS control plane**:

* Authentication
* Application shell
* Permission-based navigation
* **Super Admin tenant lifecycle**
* **Tenant impersonation**

Backend APIs are **frozen and authoritative**.

🚫 NO backend logic
🚫 NO API guessing
🚫 NO ERP business workflows
🚫 NO skipping RBAC

---

# ---------------------------------------------------------

# 🧠 1. PHASE 1 SCOPE (LOCKED)

# ---------------------------------------------------------

You MUST implement:

✔ Authentication flows (login, logout)
✔ Application shell (layout, navigation)
✔ Permission-based routing & menus
✔ **Super Admin Tenant Management UI**
✔ **Super Admin Tenant Impersonation UI**
✔ Impersonation safety UX
✔ Auth guards & error handling

You MUST NOT implement:

* Procurement
* Sorting
* Inventory
* Reports
* Tenant admin configs (Phase 8)

---

# ---------------------------------------------------------

# 🧱 2. APP SHELL STRUCTURE

# ---------------------------------------------------------

Create core layout under:

```
src/app/core/
 ├── layout/
 │   ├── app-shell.component.ts
 │   ├── header.component.ts
 │   ├── sidebar.component.ts
 │   ├── impersonation-banner.component.ts
 ├── guards/
 ├── services/
```

Shell rules:

* Sidebar driven by permissions
* Lazy-loaded modules
* Impersonation banner always visible when active

---

# ---------------------------------------------------------

# 🔐 3. AUTHENTICATION FLOW

# ---------------------------------------------------------

## Login Page

Route:

```
/login
```

Features:

* Email + password
* Error handling
* Loading state

On success:

* Store JWT securely
* Load user profile & permissions
* Redirect based on role:

  * Super Admin → `/admin/super/tenants`
  * Tenant User → `/app/dashboard`

---

## Logout

* Clears token
* Clears impersonation state
* Redirects to `/login`

---

# ---------------------------------------------------------

# 🛡️ 4. AUTH & PERMISSION GUARDS

# ---------------------------------------------------------

Implement:

* `AuthGuard`
* `SuperAdminGuard`
* `PermissionGuard`

Rules:

* Super Admin routes require SuperAdminGuard
* Tenant users **must never** access super admin routes
* Unauthorized access → 403 page

---

# ---------------------------------------------------------

# 🧑‍💼 5. SUPER ADMIN — TENANT MANAGEMENT (CRITICAL)

# ---------------------------------------------------------

## API CONTRACT (AUTHORITATIVE)

Frontend MUST integrate exactly:

```http
POST   /superadmin/tenants
GET    /superadmin/tenants
GET    /superadmin/tenants/:id
PATCH  /superadmin/tenants/:id
POST   /superadmin/tenants/:id/impersonate
```

🚫 No alternatives
🚫 No mock APIs

---

## MODULE STRUCTURE

```
src/app/modules/admin/super-admin/
 ├── tenants/
 │   ├── tenants-list.page.ts
 │   ├── tenant-detail.page.ts
 │   ├── tenant-form.drawer.ts
 │   ├── tenants.service.ts
 │   └── tenants.routes.ts
```

Lazy-loaded under:

```
/admin/super
```

---

## 🧾 TENANTS LIST PAGE

### Route

```
/admin/super/tenants
```

### Table Columns

* Company Name
* Company Code
* Currency
* Status (ACTIVE / INACTIVE)
* Created Date

### Actions

* View
* Edit
* Activate / Deactivate
* Impersonate

### Filters

* Status
* Search (Name / Code)

---

## ➕ CREATE / UPDATE TENANT (DRAWER)

### Fields

* Company Name
* Company Code (immutable after create)
* Currency
* Locale
* Status

Rules:

* Company Code must be unique
* Deactivation requires confirmation
* Inline validation errors

---

# ---------------------------------------------------------

# 🧑‍💻 6. TENANT IMPERSONATION (MANDATORY & STRICT)

# ---------------------------------------------------------

## Trigger

```
POST /superadmin/tenants/:id/impersonate
```

Backend returns:

* Impersonation token
* Tenant metadata

Frontend MUST:

1. Replace auth context with impersonation token
2. Redirect user to:

   ```
   https://{tenant}.thriftos.com/app
   ```

---

## ⚠️ IMPERSONATION UX RULES (NON-NEGOTIABLE)

While impersonating:

* 🔴 Persistent **impersonation banner**
* 🔴 Banner text:

  > “You are impersonating {Tenant Name}”
* 🔴 “Exit Impersonation” button
* 🔴 High-visibility color (amber/red)
* 🔴 Banner shown on **every screen**

Exit flow:

```
POST /auth/exit-impersonation
```

On exit:

* Restore original Super Admin session
* Redirect back to `/admin/super/tenants`

---

# ---------------------------------------------------------

# 🔐 7. MENU & NAVIGATION RULES

# ---------------------------------------------------------

### Super Admin sees:

```
Admin
 └── Super Admin
     └── Tenants
```

### Tenant users:

* Must never see Super Admin menu
* Must never hit Super Admin routes

Menu is driven entirely by:

* User role
* Permissions
* Impersonation state

---

# ---------------------------------------------------------

# 🧪 8. ERROR HANDLING & EDGE CASES

# ---------------------------------------------------------

Handle explicitly:

* 401 → Redirect to login
* 403 → Access denied page
* 409 → Duplicate company code
* 400 → Validation errors
* Network failure → Retry UI

---

# ---------------------------------------------------------

# 🧱 9. UI / UX RULES (ENTERPRISE)

# ---------------------------------------------------------

✔ Clean, dense SaaS UI
✔ Clear confirmations for destructive actions
✔ No animations that hide state
✔ Immediate visual feedback
✔ Accessible contrast

Super Admin UI must feel **powerful but safe**.

---

# ---------------------------------------------------------

# 🧱 10. CODE QUALITY RULES

# ---------------------------------------------------------

✔ Angular 21 standalone components
✔ Typed services & DTOs
✔ Strict typing
✔ No inline API calls
✔ No business logic
✔ No shortcuts

---

# ---------------------------------------------------------

# 🚀 11. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate the **complete Frontend Phase 1 implementation**, including:

✔ Auth pages
✔ App shell
✔ Guards
✔ Super Admin tenant management
✔ Impersonation flow & banner
✔ Permission-based navigation
✔ Error handling

❌ Do NOT implement business modules
❌ Do NOT mock APIs
❌ Do NOT bypass RBAC

Output **real Angular code** into correct project folders.