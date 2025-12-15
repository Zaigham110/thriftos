# 🔥 **YOU ARE AN EXPERT NESTJS + PRISMA ENGINEER.**

Your task is to implement **Phase 1** of ThriftOS V3 backend using the architectural specification:

```
docs/architecture/thriftos-v3-architecture.md
```

And the database schema generated in Phase 0.

NO deviation.
NO guessing.
Follow the document EXACTLY.

---

# ---------------------------------------------------------

# 🧠 1. PHASE 1 SCOPE (WHAT YOU MUST BUILD)

# ---------------------------------------------------------

In this phase, you must fully implement:

---

# ⭐ A. **Authentication Module**

* JWT-based Sign-in
* JWT refresh token system
* Password hashing (bcrypt)
* Super Admin initial user creation
* Login rate-limiting middleware
* Email/Password login
* Logout (token invalidation)

Auth routes:

```
POST /auth/login
POST /auth/logout
POST /auth/refresh
```

---

# ⭐ B. **Super Admin Tenant Management**

Super Admin can:

* Create tenants
* Update tenant details
* Deactivate tenant
* List all tenants
* View tenant status
* Impersonate tenant

API Routes:

```
POST   /superadmin/tenants
GET    /superadmin/tenants
GET    /superadmin/tenants/:id
PATCH  /superadmin/tenants/:id
POST   /superadmin/tenants/:id/impersonate
```

Tenant model fields:

```
id
name
companyCode
currency
locale
status
```

---

# ⭐ C. **Tenant Configuration Bootstrap**

When a tenant is created:

You MUST automatically generate:

1. Default Roles:

   * Admin
   * Manager
   * Worker
   * ReadOnly

2. Default Permissions (from Permission table)

3. Default Categories (copy from GlobalCategoryTemplate)

4. Default Grades (optional empty set)

5. Default Warehouses (e.g., "Main Warehouse")

This requires:

* **TenantBootstrapService**

---

# ⭐ D. **RBAC Module (Role-Based Access Control)**

You must implement:

### Role Management

```
POST /roles
GET  /roles
GET  /roles/:id
PATCH /roles/:id
DELETE /roles/:id
```

### Permission Management

```
GET /permissions
```

(permissions are predefined)

### Assign Permissions to Roles

```
POST /roles/:id/permissions
DELETE /roles/:id/permissions/:permId
```

### Assign Roles to Users

```
POST /users/:id/roles
DELETE /users/:id/roles/:roleId
```

---

# ⭐ E. **User Management**

Tenant admins can:

* Invite user
* Activate user
* Reset password
* Block/unblock user

Routes:

```
POST /users
GET /users
PATCH /users/:id
PATCH /users/:id/block
PATCH /users/:id/unblock
POST /users/:id/reset-password
```

When user invited:

* Store user with temporary password or token
* Email sending is mocked (return token in response for now)

---

# ⭐ F. **Tenant-Aware Authentication Middleware**

You must create a NestJS guard & middleware that:

1. Extracts tenantId from JWT token
2. Ensures **every request is scoped to tenant**
3. Blocks cross-tenant access
4. Allows Super Admin to bypass or impersonate tenant

Guards needed:

### `JwtAuthGuard`

### `TenantGuard`

### `PermissionGuard(permissionCode)`

Example usage:

```
@Get()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard('TENANT_LIST'))
```

---

# ⭐ G. **Audit Logging**

Implement a simple audit logger:

```
AuditLog:
  id
  tenantId?
  userId
  action
  metadataJson
  createdAt
```

Log actions for:

* Tenant creation
* Role assignment
* Permission changes
* User creation
* Authentication activities

---

# ---------------------------------------------------------

# 🧱 2. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

You MUST generate:

### ✔ Full NestJS modules:

```
auth/
superadmin/
tenant/
roles/
permissions/
users/
rbac/
audit/
common/
```

### ✔ For each module:

* Controller
* Service
* DTOs
* Guards
* Interceptors
* Decorators
* Utils

### ✔ Prisma queries for:

* Tenant
* User
* Role
* RolePermission
* UserRole
* Permission
* GlobalConfig
* GlobalCategoryTemplate
* AuditLog

### ✔ Multi-tenant middleware

### ✔ Error classes (BadRequest, Forbidden, Unauthorized)

### ✔ Hashing utilities for passwords

### ✔ Auth token utilities (access + refresh)

### ✔ Seeding script for permissions list

### ✔ Bootstrap logic for new tenant creation

---

# ---------------------------------------------------------

# 🧩 3. CRITICAL RULES

# ---------------------------------------------------------

### RULE 1 — NEVER hardcode tenantId

All queries must use:

```
where: { tenantId: currentTenantId }
```

### RULE 2 — Super Admin operations DO NOT require tenantId (global scope)

### RULE 3 — Tenant bootstrap MUST be atomic transaction

### RULE 4 — Permissions must be enforced using PermissionGuard

### RULE 5 — Return clean DTOs (no passwordHash exposed)

### RULE 6 — DO NOT skip or partially implement any required module

### RULE 7 — Follow modern NestJS patterns (standalone providers ready for v10+)

---

# ---------------------------------------------------------

# 🧪 4. ENDPOINT SUMMARY CHECKLIST

# ---------------------------------------------------------

Before output is done, ensure these are implemented:

### Authentication

* [ ] POST /auth/login
* [ ] POST /auth/logout
* [ ] POST /auth/refresh

### Super Admin Tenant Management

* [ ] POST /superadmin/tenants
* [ ] GET /superadmin/tenants
* [ ] GET /superadmin/tenants/:id
* [ ] PATCH /superadmin/tenants/:id
* [ ] POST /superadmin/tenants/:id/impersonate

### Roles & Permissions

* [ ] GET /permissions
* [ ] POST /roles
* [ ] GET /roles
* [ ] PATCH /roles/:id
* [ ] DELETE /roles/:id
* [ ] POST /roles/:id/permissions
* [ ] DELETE /roles/:id/permissions/:permId

### User Management

* [ ] POST /users
* [ ] GET /users
* [ ] PATCH /users/:id
* [ ] PATCH /users/:id/block
* [ ] PATCH /users/:id/unblock
* [ ] POST /users/:id/reset-password
* [ ] POST /users/:id/roles
* [ ] DELETE /users/:id/roles/:roleId

### Audit Logging

* [ ] Automatic on all sensitive actions

---

# ---------------------------------------------------------

# 🚀 5. FINAL INSTRUCTIONS TO CURSOR

# ---------------------------------------------------------

**Generate the full Phase 1 backend code**, including:

* All modules
* All DTOs
* All controllers
* All services
* All guards
* All utilities
* All Prisma queries
* All bootstrap logic

Ensure:

* Code is fully functional
* No TODOs
* No placeholders
* Correct imports
* Strong typing everywhere
* Uses latest NestJS standards
* Multi-tenant enforcement in all tenant routes
* Super Admin bypass logic

Output COMPLETE code directly into project files.