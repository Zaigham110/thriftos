
# Frontend Permissions Map

This document describes how the frontend should interpret permissions.

## Source of truth

- Backend enforces permissions server-side via `PermissionGuard` + `@RequirePermissions(...)`.
- Frontend loads the current user's effective permission codes using:

```http
GET /me
```

Response shape:

```json
{
	"user": {
		"id": "...",
		"email": "...",
		"name": "...",
		"tenantId": "... | null",
		"isSuperAdmin": true,
		"impersonatedTenantId": "... | null"
	},
	"permissions": ["role.read", "user.read"]
}
```

## Navigation gating rules

- Super Admin (`user.isSuperAdmin === true`) bypasses permission checks for UI gating.
- Tenant users must have the required permission code(s) for a menu item/route.
- Frontend gating is a UX feature only; backend remains authoritative.

## Seeded permission codes (by area)

These codes are seeded in `prisma/seed.ts` and used by backend guards.

### Super Admin

- `tenant.create`, `tenant.read`, `tenant.update`, `tenant.delete`

### User Management

- `user.create`, `user.read`, `user.update`, `user.delete`

### Role Management

- `role.create`, `role.read`, `role.update`, `role.delete`

### Configuration

- Categories: `category.create`, `category.read`, `category.update`, `category.delete`
- Grades: `grade.create`, `grade.read`, `grade.update`, `grade.delete`
- Warehouses: `warehouse.create`, `warehouse.read`, `warehouse.update`, `warehouse.delete`

### Procurement

- Purchase orders: `po.create`, `po.read`, `po.update`, `po.delete`
- Containers: `container.create`, `container.read`, `container.update`, `container.delete`
- Rags: `rag.create`, `rag.read`, `rag.delete`
- Vendors: `vendor.create`, `vendor.read`, `vendor.update`

### Sorting / Grading

- Sorting sessions: `sort.session.create`, `sort.session.read`, `sort.session.update`, `sort.session.close`
- Sorting Stage 1 (phase prompt codes): `SORTING_STAGE1_VIEW`, `SORTING_STAGE1_CREATE`, `SORTING_STAGE1_EDIT`, `SORTING_STAGE1_CLOSE`
- Grading sessions: `grade.session.create`, `grade.session.read`, `grade.session.update`, `grade.session.close`
- Sorting Stage 2 / Grading (phase prompt codes): `SORTING_STAGE2_VIEW`, `SORTING_STAGE2_CREATE`, `SORTING_STAGE2_EDIT`, `SORTING_STAGE2_CLOSE`

### Repack

- `repack.session.create`, `repack.session.read`, `repack.session.update`
- `repack.unit.create`, `repack.unit.read`
- `qr.generate`
- Phase prompt codes: `REPACK_VIEW`, `REPACK_CREATE`, `REPACK_EDIT`, `REPACK_CLOSE`

### Inventory

- `inventory.read`, `inventory.adjust`, `inventory.transfer`, `stockmovement.read`
- Phase prompt codes: `INVENTORY_VIEW`, `INVENTORY_INTAKE`, `INVENTORY_ADJUST`, `INVENTORY_RESERVE`

### Reports

- `report.procurement`, `report.sorting`, `report.grading`, `report.inventory`, `report.cost`, `report.worker`
- `REPORTS_VIEW`, `REPORTS_EXPORT`
