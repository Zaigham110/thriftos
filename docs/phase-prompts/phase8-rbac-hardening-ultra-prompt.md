You are an **expert security-focused ERP backend engineer (NestJS + Prisma)**.

Your task is to **harden, enforce, and standardize RBAC across the ENTIRE ThriftOS V3 backend**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and using:

* Phase 0 — Database schema
* Phase 1 — Auth, Users, Roles, Permissions
* Phase 2–7 — Business domains

⚠️ This phase does **NOT** add new business features.
It **enforces correctness, security, and auditability**.

NO shortcuts
NO missing guards
NO “trust the frontend” logic

---

# ---------------------------------------------------------

# 🧠 1. PHASE 8 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST:

✔ Enforce permission checks on **EVERY protected endpoint**
✔ Harden TenantGuard to block ALL cross-tenant access
✔ Standardize permission naming & grouping
✔ Add deny-by-default behavior
✔ Prevent privilege escalation
✔ Enforce read/write separation
✔ Add security audit logs
✔ Add permission coverage tests
✔ Prepare system for external audits

🚫 No UI
🚫 No new tables (unless required for enforcement metadata)

---

# ---------------------------------------------------------

# 🧱 2. SECURITY PRINCIPLES (MANDATORY)

# ---------------------------------------------------------

### 1️⃣ **Deny by Default**

* If an endpoint does not explicitly declare a permission → ACCESS DENIED

### 2️⃣ **Server-Side Authority**

* Frontend permissions are ignored
* Backend is the single source of truth

### 3️⃣ **Least Privilege**

* Permissions must be granular
* No wildcard permissions

### 4️⃣ **Tenant Isolation**

* No tenantId mismatch allowed
* Super Admin bypass is explicit & logged

---

# ---------------------------------------------------------

# 🟦 3. PERMISSION TAXONOMY (LOCKED)

# ---------------------------------------------------------

You MUST define and enforce permissions in this structured format:

```
<DOMAIN>_<ACTION>
```

### Examples:

```
PROCUREMENT_VIEW
PROCUREMENT_CREATE
PROCUREMENT_EDIT
PROCUREMENT_CLOSE

SORTING_STAGE1_VIEW
SORTING_STAGE1_CREATE
SORTING_STAGE1_EDIT
SORTING_STAGE1_CLOSE

SORTING_STAGE2_VIEW
SORTING_STAGE2_CREATE
SORTING_STAGE2_EDIT
SORTING_STAGE2_CLOSE

REPACK_VIEW
REPACK_CREATE
REPACK_EDIT
REPACK_CLOSE

INVENTORY_VIEW
INVENTORY_INTAKE
INVENTORY_ADJUST
INVENTORY_RESERVE

REPORTS_VIEW
REPORTS_EXPORT

ADMIN_TENANT_CREATE
ADMIN_TENANT_UPDATE
ADMIN_USER_MANAGE
ADMIN_ROLE_MANAGE
```

Permissions MUST be seeded and immutable in production.

---

# ---------------------------------------------------------

# 🛡 4. GUARD HARDENING (CRITICAL)

# ---------------------------------------------------------

## 🔐 4.1 JwtAuthGuard

* Must reject:

  * Expired tokens
  * Revoked refresh tokens
  * Inactive users
* Must attach:

  ```
  req.user = {
    id,
    tenantId,
    roles[],
    permissions[],
    isSuperAdmin
  }
  ```

---

## 🔐 4.2 TenantGuard (HARDENED)

TenantGuard MUST:

1. Extract tenantId from:

   * JWT
   * Route params (if applicable)
2. Validate:

   ```
   req.user.tenantId === resource.tenantId
   ```
3. Block:

   * Cross-tenant access
4. Allow:

   * Super Admin ONLY when explicitly flagged

❌ No silent bypass
✔ Explicit impersonation only

---

## 🔐 4.3 PermissionGuard (HARDENED)

PermissionGuard MUST:

* Accept **one or more permissions**
* Validate:

  ```
  user.permissions.includes(requiredPermission)
  ```
* Reject if:

  * Permission missing
  * User inactive
* Support:

  * `@RequirePermissions(...)` decorator

---

# ---------------------------------------------------------

# 🧩 5. CONTROLLER HARDENING (MANDATORY)

# ---------------------------------------------------------

You MUST:

✔ Review **EVERY controller** from Phase 1–7
✔ Add `@RequirePermissions()` to:

* Every route
* Every mutation
* Every sensitive read

❌ No unguarded endpoints
❌ No implicit access

---

# ---------------------------------------------------------

# 🧾 6. SECURITY AUDIT LOGGING

# ---------------------------------------------------------

Enhance AuditLog usage:

Log:

* Permission denied attempts
* Cross-tenant access attempts
* Super Admin impersonation
* Role changes
* Permission changes
* User blocking/unblocking

Log format:

```
{
  userId,
  tenantId?,
  action,
  target,
  metadata,
  ipAddress,
  userAgent,
  timestamp
}
```

---

# ---------------------------------------------------------

# 🧪 7. SECURITY TESTS (MANDATORY)

# ---------------------------------------------------------

You MUST add:

### ✔ Permission coverage tests

* Ensure all controllers have guards

### ✔ Tenant isolation tests

* Access resource from wrong tenant → 403

### ✔ Privilege escalation tests

* User cannot assign higher role than own

### ✔ Super Admin tests

* Can impersonate
* Cannot mutate without impersonation

---

# ---------------------------------------------------------

# 🧱 8. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

✔ Hardened Guards
✔ Decorators
✔ Permission registry
✔ Audit enhancements
✔ Controller updates
✔ Security tests
✔ Refactoring where needed

🚫 No business logic changes
🚫 No schema rewrites unless necessary

---

# ---------------------------------------------------------

# 🚀 9. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Perform a **security hardening pass across the entire backend**.

✔ No unprotected endpoints
✔ Explicit permission checks everywhere
✔ Tenant-safe enforcement
✔ Production-grade security
✔ Clean, readable code

Output updated files directly into the project.