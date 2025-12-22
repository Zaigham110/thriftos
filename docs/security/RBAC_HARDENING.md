# ThriftOS V3 RBAC Hardening - Phase 8 Security Documentation

## Overview

This document describes the RBAC (Role-Based Access Control) security hardening implemented in ThriftOS V3 backend. The implementation follows the principle of **Deny by Default** - every endpoint is protected unless explicitly marked as public or skip-permission.

## Security Architecture

### Guard Chain

All requests pass through multiple guards in order:

```
Request → JwtAuthGuard (Global) → TenantGuard → PermissionGuard → Controller
```

1. **JwtAuthGuard** (Global via APP_GUARD)
   - Validates JWT access token
   - Extracts user data and attaches to request
   - Skips if `@Public()` decorator present

2. **TenantGuard**
   - Enforces tenant isolation
   - Validates Super Admin impersonation for tenant routes
   - Sets `request.tenantId` for data scoping
   - Logs security events for cross-tenant attempts

3. **PermissionGuard**
   - Enforces permission-based access control
   - Deny-by-default: Blocks access if no `@RequirePermissions()` or `@SkipPermissionCheck()`
   - Validates user permissions against required permissions
   - Logs security events for permission denials

### Decorators

#### `@Public()`
Marks a route as publicly accessible (no authentication required).
```typescript
@Public()
@Post('login')
async login() { ... }
```
**Usage:** Only for auth routes (login, refresh).

#### `@SuperAdminOnly()`
Marks a route/controller as accessible only by Super Admins.
```typescript
@Controller('superadmin/tenants')
@SuperAdminOnly()
export class SuperAdminController { ... }
```
**Usage:** Tenant management, system-wide operations.

#### `@RequirePermissions(...permissions)`
Specifies required permissions for a route. User must have ALL listed permissions.
```typescript
@Get()
@RequirePermissions('user.read')
async findAll() { ... }

@Post()
@RequirePermissions('user.create', 'user.write')
async create() { ... }
```
**Usage:** All business logic routes that require specific access control.

#### `@SkipPermissionCheck()`
Explicitly marks a route as not requiring any permission (but still requires authentication).
```typescript
@Get()
@SkipPermissionCheck()
async getMe() { ... }
```
**Usage:**
- User's own profile (`/me`)
- Tenant lookup data (`/tenant/categories`, `/tenant/grades`, etc.)
- Session management (`/auth/logout`, `/auth/exit-impersonation`)

### Security Audit Logging

Both TenantGuard and PermissionGuard log security events to the audit trail:

| Event | Description |
|-------|-------------|
| `PERMISSION_DENIED` | User attempted action without required permission |
| `PERMISSION_DENIED_INACTIVE` | Inactive user attempted to access protected route |
| `SUPER_ADMIN_ROUTE_DENIED` | Non-super-admin tried to access super admin route |
| `SUPER_ADMIN_ROUTE_ACCESS` | Super admin accessed super admin route (audit trail) |
| `SUPER_ADMIN_NO_IMPERSONATION` | Super admin tried tenant route without impersonation |
| `SUPER_ADMIN_IMPERSONATED_ACCESS` | Super admin accessed tenant route while impersonating |
| `TENANT_CONTEXT_MISSING` | User has no tenant context |

## Controller Security Patterns

### Standard Tenant Controller
```typescript
@Controller('resource')
@UseGuards(TenantGuard, PermissionGuard)
export class ResourceController {
  @Get()
  @RequirePermissions('resource.read')
  async findAll() { ... }

  @Post()
  @RequirePermissions('resource.create')
  async create() { ... }
}
```

### Lookup/Read-Only Controller
```typescript
@Controller('tenant')
@UseGuards(TenantGuard, PermissionGuard)
export class TenantController {
  @Get('categories')
  @SkipPermissionCheck() // Basic lookup data for all authenticated users
  async getCategories() { ... }
}
```

### Super Admin Controller
```typescript
@Controller('superadmin/tenants')
@UseGuards(TenantGuard)
@SuperAdminOnly()
export class SuperAdminController {
  // All routes require super admin - no PermissionGuard needed
}
```

### Auth Controller (Mixed Public/Protected)
```typescript
@Controller('auth')
@UseGuards(PermissionGuard)
export class AuthController {
  @Public()
  @Post('login')
  async login() { ... } // No auth required

  @Post('logout')
  @SkipPermissionCheck() // Any authenticated user can logout
  async logout() { ... }
}
```

## Permission Naming Convention

Two patterns exist (both are valid):

1. **Dot-style:** `resource.action` (e.g., `user.create`, `po.read`, `role.delete`)
2. **Uppercase:** `MODULE_ACTION` (e.g., `SORTING_STAGE1_VIEW`, `REPACK_CREATE`)

### Standard Permission Actions
- `.read` / `_VIEW` - List and view details
- `.create` / `_CREATE` - Create new records
- `.update` / `_UPDATE` - Modify existing records
- `.delete` / `_DELETE` - Remove records
- `.export` / `_EXPORT` - Export data (reports)

## Security Checklist for New Controllers

When creating a new controller, verify:

- [ ] `@UseGuards(TenantGuard, PermissionGuard)` at class level
- [ ] Every route has either `@RequirePermissions()` or `@SkipPermissionCheck()`
- [ ] No hardcoded user IDs or tenant IDs
- [ ] All queries filter by `tenantId` from `request.tenantId`
- [ ] Sensitive operations have appropriate permissions
- [ ] Public routes (if any) are explicitly marked with `@Public()`

## Audit Results (Phase 8)

| Metric | Count |
|--------|-------|
| Total Controllers | 33 |
| Controllers with Proper Guards | 33 |
| @Public Routes | 2 (login, refresh only) |
| @SuperAdminOnly Controllers | 1 (superadmin) |
| @SkipPermissionCheck Routes | 8 (profile, tenant lookup, session mgmt) |

## Files Modified in Phase 8

### Guards
- `server/src/common/guards/permission.guard.ts` - Deny-by-default, audit logging
- `server/src/common/guards/tenant.guard.ts` - Super Admin impersonation enforcement, audit logging

### Decorators
- `server/src/common/decorators/permissions.decorator.ts` - Added `SkipPermissionCheck`

### Controllers Fixed
- `server/src/me/me.controller.ts` - Added guards
- `server/src/tenant/tenant.controller.ts` - Added PermissionGuard
- `server/src/permissions/permissions.controller.ts` - Added @RequirePermissions
- `server/src/auth/auth.controller.ts` - Added PermissionGuard, @SkipPermissionCheck

### Modules Updated
- `server/src/common/common.module.ts` - Import AuditModule
- `server/src/me/me.module.ts` - Import CommonModule
- `server/src/tenant/tenant.module.ts` - Import CommonModule
- `server/src/auth/auth.module.ts` - Import CommonModule
