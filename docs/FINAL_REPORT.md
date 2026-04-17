# ThriftOS Mandated Final Report

Date: 2026-01-05

## Scope
- Includes *everything currently modified in the workspace* (tracked changes + untracked new files)
- Excludes generated build outputs going forward via .gitignore (server/dist is removed from git index)

## Key Outcomes (high level)
- Tenant currency hardening: single tenant currency, no conversion logic, USD hardcoding removed in formatting layer
- Tenant admin hardening: route-based CRUD UX and backend /admin/* CRUD coverage for core configuration entities
- Ops dropdown wiring: prevent empty dropdowns caused by admin-only sources (repack warehouses now tenant-scoped)

## Repo Hygiene (best practice)
- server/dist is treated as build output: ignored + removed from version control

## Current Workspace Change Inventory

### git status --porcelain
```
 M .gitignore
 M prisma/schema.prisma
D  server/dist/app.module.d.ts
D  server/dist/app.module.js
D  server/dist/app.module.js.map
D  server/dist/audit/audit.module.d.ts
D  server/dist/audit/audit.module.js
D  server/dist/audit/audit.module.js.map
D  server/dist/audit/audit.service.d.ts
D  server/dist/audit/audit.service.js
D  server/dist/audit/audit.service.js.map
D  server/dist/auth/auth.controller.d.ts
D  server/dist/auth/auth.controller.js
D  server/dist/auth/auth.controller.js.map
D  server/dist/auth/auth.module.d.ts
D  server/dist/auth/auth.module.js
D  server/dist/auth/auth.module.js.map
D  server/dist/auth/auth.service.d.ts
D  server/dist/auth/auth.service.js
D  server/dist/auth/auth.service.js.map
D  server/dist/auth/dto/index.d.ts
D  server/dist/auth/dto/index.js
D  server/dist/auth/dto/index.js.map
D  server/dist/auth/dto/login.dto.d.ts
D  server/dist/auth/dto/login.dto.js
D  server/dist/auth/dto/login.dto.js.map
D  server/dist/auth/dto/refresh.dto.d.ts
D  server/dist/auth/dto/refresh.dto.js
D  server/dist/auth/dto/refresh.dto.js.map
D  server/dist/auth/jwt.strategy.d.ts
D  server/dist/auth/jwt.strategy.js
D  server/dist/auth/jwt.strategy.js.map
D  server/dist/auth/password.service.d.ts
D  server/dist/auth/password.service.js
D  server/dist/auth/password.service.js.map
D  server/dist/common/common.module.d.ts
D  server/dist/common/common.module.js
D  server/dist/common/common.module.js.map
D  server/dist/common/decorators/current-user.decorator.d.ts
D  server/dist/common/decorators/current-user.decorator.js
D  server/dist/common/decorators/current-user.decorator.js.map
D  server/dist/common/decorators/index.d.ts
D  server/dist/common/decorators/index.js
D  server/dist/common/decorators/index.js.map
D  server/dist/common/decorators/permissions.decorator.d.ts
D  server/dist/common/decorators/permissions.decorator.js
D  server/dist/common/decorators/permissions.decorator.js.map
D  server/dist/common/decorators/public.decorator.d.ts
D  server/dist/common/decorators/public.decorator.js
D  server/dist/common/decorators/public.decorator.js.map
D  server/dist/common/decorators/super-admin.decorator.d.ts
D  server/dist/common/decorators/super-admin.decorator.js
D  server/dist/common/decorators/super-admin.decorator.js.map
D  server/dist/common/guards/index.d.ts
D  server/dist/common/guards/index.js
D  server/dist/common/guards/index.js.map
D  server/dist/common/guards/jwt-auth.guard.d.ts
D  server/dist/common/guards/jwt-auth.guard.js
D  server/dist/common/guards/jwt-auth.guard.js.map
D  server/dist/common/guards/permission.guard.d.ts
D  server/dist/common/guards/permission.guard.js
D  server/dist/common/guards/permission.guard.js.map
D  server/dist/common/guards/tenant.guard.d.ts
D  server/dist/common/guards/tenant.guard.js
D  server/dist/common/guards/tenant.guard.js.map
D  server/dist/health/health.controller.d.ts
D  server/dist/health/health.controller.js
D  server/dist/health/health.controller.js.map
D  server/dist/health/health.module.d.ts
D  server/dist/health/health.module.js
D  server/dist/health/health.module.js.map
D  server/dist/health/index.d.ts
D  server/dist/health/index.js
D  server/dist/health/index.js.map
D  server/dist/health/prisma.health.d.ts
D  server/dist/health/prisma.health.js
D  server/dist/health/prisma.health.js.map
D  server/dist/inventory/inventory.controller.d.ts
D  server/dist/inventory/inventory.controller.js
D  server/dist/inventory/inventory.controller.js.map
D  server/dist/inventory/inventory.module.d.ts
D  server/dist/inventory/inventory.module.js
D  server/dist/inventory/inventory.module.js.map
D  server/dist/inventory/inventory.service.d.ts
D  server/dist/inventory/inventory.service.js
D  server/dist/inventory/inventory.service.js.map
D  server/dist/main.d.ts
D  server/dist/main.js
D  server/dist/main.js.map
D  server/dist/me/me.controller.d.ts
D  server/dist/me/me.controller.js
D  server/dist/me/me.controller.js.map
D  server/dist/me/me.module.d.ts
D  server/dist/me/me.module.js
D  server/dist/me/me.module.js.map
D  server/dist/permissions/permissions.controller.d.ts
D  server/dist/permissions/permissions.controller.js
D  server/dist/permissions/permissions.controller.js.map
D  server/dist/permissions/permissions.module.d.ts
D  server/dist/permissions/permissions.module.js
D  server/dist/permissions/permissions.module.js.map
D  server/dist/permissions/permissions.service.d.ts
D  server/dist/permissions/permissions.service.js
D  server/dist/permissions/permissions.service.js.map
D  server/dist/prisma/prisma.module.d.ts
D  server/dist/prisma/prisma.module.js
D  server/dist/prisma/prisma.module.js.map
D  server/dist/prisma/prisma.service.d.ts
D  server/dist/prisma/prisma.service.js
D  server/dist/prisma/prisma.service.js.map
D  server/dist/procurement/container/container.controller.d.ts
D  server/dist/procurement/container/container.controller.js
D  server/dist/procurement/container/container.controller.js.map
D  server/dist/procurement/container/container.module.d.ts
D  server/dist/procurement/container/container.module.js
D  server/dist/procurement/container/container.module.js.map
D  server/dist/procurement/container/container.service.d.ts
D  server/dist/procurement/container/container.service.js
D  server/dist/procurement/container/container.service.js.map
D  server/dist/procurement/container/dto/create-container-charge.dto.d.ts
D  server/dist/procurement/container/dto/create-container-charge.dto.js
D  server/dist/procurement/container/dto/create-container-charge.dto.js.map
D  server/dist/procurement/container/dto/create-container.dto.d.ts
D  server/dist/procurement/container/dto/create-container.dto.js
D  server/dist/procurement/container/dto/create-container.dto.js.map
D  server/dist/procurement/container/dto/index.d.ts
D  server/dist/procurement/container/dto/index.js
D  server/dist/procurement/container/dto/index.js.map
D  server/dist/procurement/container/dto/update-container-status.dto.d.ts
D  server/dist/procurement/container/dto/update-container-status.dto.js
D  server/dist/procurement/container/dto/update-container-status.dto.js.map
D  server/dist/procurement/container/dto/update-container.dto.d.ts
D  server/dist/procurement/container/dto/update-container.dto.js
D  server/dist/procurement/container/dto/update-container.dto.js.map
D  server/dist/procurement/cost-allocation/cost-allocation.service.d.ts
D  server/dist/procurement/cost-allocation/cost-allocation.service.js
D  server/dist/procurement/cost-allocation/cost-allocation.service.js.map
D  server/dist/procurement/dashboard/procurement-dashboard.controller.d.ts
D  server/dist/procurement/dashboard/procurement-dashboard.controller.js
D  server/dist/procurement/dashboard/procurement-dashboard.controller.js.map
D  server/dist/procurement/dashboard/procurement-dashboard.module.d.ts
D  server/dist/procurement/dashboard/procurement-dashboard.module.js
D  server/dist/procurement/dashboard/procurement-dashboard.module.js.map
D  server/dist/procurement/dashboard/procurement-dashboard.service.d.ts
D  server/dist/procurement/dashboard/procurement-dashboard.service.js
D  server/dist/procurement/dashboard/procurement-dashboard.service.js.map
D  server/dist/procurement/incoming-bale/dto/create-incoming-bale.dto.d.ts
D  server/dist/procurement/incoming-bale/dto/create-incoming-bale.dto.js
D  server/dist/procurement/incoming-bale/dto/create-incoming-bale.dto.js.map
D  server/dist/procurement/incoming-bale/dto/index.d.ts
D  server/dist/procurement/incoming-bale/dto/index.js
D  server/dist/procurement/incoming-bale/dto/index.js.map
D  server/dist/procurement/incoming-bale/incoming-bale.controller.d.ts
D  server/dist/procurement/incoming-bale/incoming-bale.controller.js
D  server/dist/procurement/incoming-bale/incoming-bale.controller.js.map
D  server/dist/procurement/incoming-bale/incoming-bale.module.d.ts
D  server/dist/procurement/incoming-bale/incoming-bale.module.js
D  server/dist/procurement/incoming-bale/incoming-bale.module.js.map
D  server/dist/procurement/incoming-bale/incoming-bale.service.d.ts
D  server/dist/procurement/incoming-bale/incoming-bale.service.js
D  server/dist/procurement/incoming-bale/incoming-bale.service.js.map
D  server/dist/procurement/procurement.module.d.ts
D  server/dist/procurement/procurement.module.js
D  server/dist/procurement/procurement.module.js.map
D  server/dist/procurement/purchase-order/dto/create-purchase-order.dto.d.ts
D  server/dist/procurement/purchase-order/dto/create-purchase-order.dto.js
D  server/dist/procurement/purchase-order/dto/create-purchase-order.dto.js.map
D  server/dist/procurement/purchase-order/dto/index.d.ts
D  server/dist/procurement/purchase-order/dto/index.js
D  server/dist/procurement/purchase-order/dto/index.js.map
D  server/dist/procurement/purchase-order/dto/update-purchase-order.dto.d.ts
D  server/dist/procurement/purchase-order/dto/update-purchase-order.dto.js
D  server/dist/procurement/purchase-order/dto/update-purchase-order.dto.js.map
D  server/dist/procurement/purchase-order/purchase-order.controller.d.ts
D  server/dist/procurement/purchase-order/purchase-order.controller.js
D  server/dist/procurement/purchase-order/purchase-order.controller.js.map
D  server/dist/procurement/purchase-order/purchase-order.module.d.ts
D  server/dist/procurement/purchase-order/purchase-order.module.js
D  server/dist/procurement/purchase-order/purchase-order.module.js.map
D  server/dist/procurement/purchase-order/purchase-order.service.d.ts
D  server/dist/procurement/purchase-order/purchase-order.service.js
D  server/dist/procurement/purchase-order/purchase-order.service.js.map
D  server/dist/procurement/rag/dto/create-rag.dto.d.ts
D  server/dist/procurement/rag/dto/create-rag.dto.js
D  server/dist/procurement/rag/dto/create-rag.dto.js.map
D  server/dist/procurement/rag/dto/index.d.ts
D  server/dist/procurement/rag/dto/index.js
D  server/dist/procurement/rag/dto/index.js.map
D  server/dist/procurement/rag/rag.controller.d.ts
D  server/dist/procurement/rag/rag.controller.js
D  server/dist/procurement/rag/rag.controller.js.map
D  server/dist/procurement/rag/rag.module.d.ts
D  server/dist/procurement/rag/rag.module.js
D  server/dist/procurement/rag/rag.module.js.map
D  server/dist/procurement/rag/rag.service.d.ts
D  server/dist/procurement/rag/rag.service.js
D  server/dist/procurement/rag/rag.service.js.map
D  server/dist/procurement/shared/tenant-sequence.module.d.ts
D  server/dist/procurement/shared/tenant-sequence.module.js
D  server/dist/procurement/shared/tenant-sequence.module.js.map
D  server/dist/procurement/shared/tenant-sequence.service.d.ts
D  server/dist/procurement/shared/tenant-sequence.service.js
D  server/dist/procurement/shared/tenant-sequence.service.js.map
D  server/dist/procurement/vendor/dto/create-vendor.dto.d.ts
D  server/dist/procurement/vendor/dto/create-vendor.dto.js
D  server/dist/procurement/vendor/dto/create-vendor.dto.js.map
D  server/dist/procurement/vendor/dto/index.d.ts
D  server/dist/procurement/vendor/dto/index.js
D  server/dist/procurement/vendor/dto/index.js.map
D  server/dist/procurement/vendor/vendor.controller.d.ts
D  server/dist/procurement/vendor/vendor.controller.js
D  server/dist/procurement/vendor/vendor.controller.js.map
D  server/dist/procurement/vendor/vendor.module.d.ts
D  server/dist/procurement/vendor/vendor.module.js
D  server/dist/procurement/vendor/vendor.module.js.map
D  server/dist/procurement/vendor/vendor.service.d.ts
D  server/dist/procurement/vendor/vendor.service.js
D  server/dist/procurement/vendor/vendor.service.js.map
D  server/dist/repack/dto/repack-allocation.dto.d.ts
D  server/dist/repack/dto/repack-allocation.dto.js
D  server/dist/repack/dto/repack-allocation.dto.js.map
D  server/dist/repack/qr-label/qr-label.controller.d.ts
D  server/dist/repack/qr-label/qr-label.controller.js
D  server/dist/repack/qr-label/qr-label.controller.js.map
D  server/dist/repack/qr-label/qr-label.module.d.ts
D  server/dist/repack/qr-label/qr-label.module.js
D  server/dist/repack/qr-label/qr-label.module.js.map
D  server/dist/repack/qr-label/qr-label.service.d.ts
D  server/dist/repack/qr-label/qr-label.service.js
D  server/dist/repack/qr-label/qr-label.service.js.map
D  server/dist/repack/qr-label/qr-payload.util.d.ts
D  server/dist/repack/qr-label/qr-payload.util.js
D  server/dist/repack/qr-label/qr-payload.util.js.map
D  server/dist/repack/repack-item/dto/create-repack-item.dto.d.ts
D  server/dist/repack/repack-item/dto/create-repack-item.dto.js
D  server/dist/repack/repack-item/dto/create-repack-item.dto.js.map
D  server/dist/repack/repack-item/dto/index.d.ts
D  server/dist/repack/repack-item/dto/index.js
D  server/dist/repack/repack-item/dto/index.js.map
D  server/dist/repack/repack-item/repack-item.controller.d.ts
D  server/dist/repack/repack-item/repack-item.controller.js
D  server/dist/repack/repack-item/repack-item.controller.js.map
D  server/dist/repack/repack-item/repack-item.module.d.ts
D  server/dist/repack/repack-item/repack-item.module.js
D  server/dist/repack/repack-item/repack-item.module.js.map
D  server/dist/repack/repack-item/repack-item.service.d.ts
D  server/dist/repack/repack-item/repack-item.service.js
D  server/dist/repack/repack-item/repack-item.service.js.map
D  server/dist/repack/repack-session/dto/create-repack-session.dto.d.ts
D  server/dist/repack/repack-session/dto/create-repack-session.dto.js
D  server/dist/repack/repack-session/dto/create-repack-session.dto.js.map
D  server/dist/repack/repack-session/dto/index.d.ts
D  server/dist/repack/repack-session/dto/index.js
D  server/dist/repack/repack-session/dto/index.js.map
D  server/dist/repack/repack-session/dto/update-repack-session.dto.d.ts
D  server/dist/repack/repack-session/dto/update-repack-session.dto.js
D  server/dist/repack/repack-session/dto/update-repack-session.dto.js.map
D  server/dist/repack/repack-session/repack-session.controller.d.ts
D  server/dist/repack/repack-session/repack-session.controller.js
D  server/dist/repack/repack-session/repack-session.controller.js.map
D  server/dist/repack/repack-session/repack-session.module.d.ts
D  server/dist/repack/repack-session/repack-session.module.js
D  server/dist/repack/repack-session/repack-session.module.js.map
D  server/dist/repack/repack-session/repack-session.service.d.ts
D  server/dist/repack/repack-session/repack-session.service.js
D  server/dist/repack/repack-session/repack-session.service.js.map
D  server/dist/repack/repack-unit/dto/allocate-repack-unit.dto.d.ts
D  server/dist/repack/repack-unit/dto/allocate-repack-unit.dto.js
D  server/dist/repack/repack-unit/dto/allocate-repack-unit.dto.js.map
D  server/dist/repack/repack-unit/dto/create-repack-unit-v2.dto.d.ts
D  server/dist/repack/repack-unit/dto/create-repack-unit-v2.dto.js
D  server/dist/repack/repack-unit/dto/create-repack-unit-v2.dto.js.map
D  server/dist/repack/repack-unit/dto/create-repack-unit.dto.d.ts
D  server/dist/repack/repack-unit/dto/create-repack-unit.dto.js
D  server/dist/repack/repack-unit/dto/create-repack-unit.dto.js.map
D  server/dist/repack/repack-unit/dto/deallocate-repack-unit.dto.d.ts
D  server/dist/repack/repack-unit/dto/deallocate-repack-unit.dto.js
D  server/dist/repack/repack-unit/dto/deallocate-repack-unit.dto.js.map
D  server/dist/repack/repack-unit/dto/index.d.ts
D  server/dist/repack/repack-unit/dto/index.js
D  server/dist/repack/repack-unit/dto/index.js.map
D  server/dist/repack/repack-unit/dto/seal-repack-unit-v3.dto.d.ts
D  server/dist/repack/repack-unit/dto/seal-repack-unit-v3.dto.js
D  server/dist/repack/repack-unit/dto/seal-repack-unit-v3.dto.js.map
D  server/dist/repack/repack-unit/repack-unit.controller.d.ts
D  server/dist/repack/repack-unit/repack-unit.controller.js
D  server/dist/repack/repack-unit/repack-unit.controller.js.map
D  server/dist/repack/repack-unit/repack-unit.module.d.ts
D  server/dist/repack/repack-unit/repack-unit.module.js
D  server/dist/repack/repack-unit/repack-unit.module.js.map
D  server/dist/repack/repack-unit/repack-unit.service.d.ts
D  server/dist/repack/repack-unit/repack-unit.service.js
D  server/dist/repack/repack-unit/repack-unit.service.js.map
D  server/dist/repack/repack-unit/unit-code.util.d.ts
D  server/dist/repack/repack-unit/unit-code.util.js
D  server/dist/repack/repack-unit/unit-code.util.js.map
D  server/dist/repack/repack.module.d.ts
D  server/dist/repack/repack.module.js
D  server/dist/repack/repack.module.js.map
D  server/dist/repack/shared/repack-allocation.service.d.ts
D  server/dist/repack/shared/repack-allocation.service.js
D  server/dist/repack/shared/repack-allocation.service.js.map
D  server/dist/repack/v3/repack-v3.service.d.ts
D  server/dist/repack/v3/repack-v3.service.js
D  server/dist/repack/v3/repack-v3.service.js.map
D  server/dist/reports/common/dto/report-filters.dto.d.ts
D  server/dist/reports/common/dto/report-filters.dto.js
D  server/dist/reports/common/dto/report-filters.dto.js.map
D  server/dist/reports/common/report-utils.d.ts
D  server/dist/reports/common/report-utils.js
D  server/dist/reports/common/report-utils.js.map
D  server/dist/reports/common/reports-audit.service.d.ts
D  server/dist/reports/common/reports-audit.service.js
D  server/dist/reports/common/reports-audit.service.js.map
D  server/dist/reports/common/reports-consistency.service.d.ts
D  server/dist/reports/common/reports-consistency.service.js
D  server/dist/reports/common/reports-consistency.service.js.map
D  server/dist/reports/cost-reports/cost-reports.controller.d.ts
D  server/dist/reports/cost-reports/cost-reports.controller.js
D  server/dist/reports/cost-reports/cost-reports.controller.js.map
D  server/dist/reports/cost-reports/cost-reports.module.d.ts
D  server/dist/reports/cost-reports/cost-reports.module.js
D  server/dist/reports/cost-reports/cost-reports.module.js.map
D  server/dist/reports/cost-reports/cost-reports.service.d.ts
D  server/dist/reports/cost-reports/cost-reports.service.js
D  server/dist/reports/cost-reports/cost-reports.service.js.map
D  server/dist/reports/dashboard-reports/dashboard-reports.controller.d.ts
D  server/dist/reports/dashboard-reports/dashboard-reports.controller.js
D  server/dist/reports/dashboard-reports/dashboard-reports.controller.js.map
D  server/dist/reports/dashboard-reports/dashboard-reports.module.d.ts
D  server/dist/reports/dashboard-reports/dashboard-reports.module.js
D  server/dist/reports/dashboard-reports/dashboard-reports.module.js.map
D  server/dist/reports/dashboard-reports/dashboard-reports.service.d.ts
D  server/dist/reports/dashboard-reports/dashboard-reports.service.js
D  server/dist/reports/dashboard-reports/dashboard-reports.service.js.map
D  server/dist/reports/grading-reports/grading-reports.controller.d.ts
D  server/dist/reports/grading-reports/grading-reports.controller.js
D  server/dist/reports/grading-reports/grading-reports.controller.js.map
D  server/dist/reports/grading-reports/grading-reports.module.d.ts
D  server/dist/reports/grading-reports/grading-reports.module.js
D  server/dist/reports/grading-reports/grading-reports.module.js.map
D  server/dist/reports/grading-reports/grading-reports.service.d.ts
D  server/dist/reports/grading-reports/grading-reports.service.js
D  server/dist/reports/grading-reports/grading-reports.service.js.map
D  server/dist/reports/inventory-reports/inventory-reports.controller.d.ts
D  server/dist/reports/inventory-reports/inventory-reports.controller.js
D  server/dist/reports/inventory-reports/inventory-reports.controller.js.map
D  server/dist/reports/inventory-reports/inventory-reports.module.d.ts
D  server/dist/reports/inventory-reports/inventory-reports.module.js
D  server/dist/reports/inventory-reports/inventory-reports.module.js.map
D  server/dist/reports/inventory-reports/inventory-reports.service.d.ts
D  server/dist/reports/inventory-reports/inventory-reports.service.js
D  server/dist/reports/inventory-reports/inventory-reports.service.js.map
D  server/dist/reports/procurement-reports/procurement-reports.controller.d.ts
D  server/dist/reports/procurement-reports/procurement-reports.controller.js
D  server/dist/reports/procurement-reports/procurement-reports.controller.js.map
D  server/dist/reports/procurement-reports/procurement-reports.module.d.ts
D  server/dist/reports/procurement-reports/procurement-reports.module.js
D  server/dist/reports/procurement-reports/procurement-reports.module.js.map
D  server/dist/reports/procurement-reports/procurement-reports.service.d.ts
D  server/dist/reports/procurement-reports/procurement-reports.service.js
D  server/dist/reports/procurement-reports/procurement-reports.service.js.map
D  server/dist/reports/repack-reports/repack-reports.controller.d.ts
D  server/dist/reports/repack-reports/repack-reports.controller.js
D  server/dist/reports/repack-reports/repack-reports.controller.js.map
D  server/dist/reports/repack-reports/repack-reports.module.d.ts
D  server/dist/reports/repack-reports/repack-reports.module.js
D  server/dist/reports/repack-reports/repack-reports.module.js.map
D  server/dist/reports/repack-reports/repack-reports.service.d.ts
D  server/dist/reports/repack-reports/repack-reports.service.js
D  server/dist/reports/repack-reports/repack-reports.service.js.map
D  server/dist/reports/reports.module.d.ts
D  server/dist/reports/reports.module.js
D  server/dist/reports/reports.module.js.map
D  server/dist/reports/sorting-reports/sorting-reports.controller.d.ts
D  server/dist/reports/sorting-reports/sorting-reports.controller.js
D  server/dist/reports/sorting-reports/sorting-reports.controller.js.map
D  server/dist/reports/sorting-reports/sorting-reports.module.d.ts
D  server/dist/reports/sorting-reports/sorting-reports.module.js
D  server/dist/reports/sorting-reports/sorting-reports.module.js.map
D  server/dist/reports/sorting-reports/sorting-reports.service.d.ts
D  server/dist/reports/sorting-reports/sorting-reports.service.js
D  server/dist/reports/sorting-reports/sorting-reports.service.js.map
D  server/dist/reports/waste-reports/waste-reports.controller.d.ts
D  server/dist/reports/waste-reports/waste-reports.controller.js
D  server/dist/reports/waste-reports/waste-reports.controller.js.map
D  server/dist/reports/waste-reports/waste-reports.module.d.ts
D  server/dist/reports/waste-reports/waste-reports.module.js
D  server/dist/reports/waste-reports/waste-reports.module.js.map
D  server/dist/reports/waste-reports/waste-reports.service.d.ts
D  server/dist/reports/waste-reports/waste-reports.service.js
D  server/dist/reports/waste-reports/waste-reports.service.js.map
D  server/dist/reports/worker-reports/worker-reports.controller.d.ts
D  server/dist/reports/worker-reports/worker-reports.controller.js
D  server/dist/reports/worker-reports/worker-reports.controller.js.map
D  server/dist/reports/worker-reports/worker-reports.module.d.ts
D  server/dist/reports/worker-reports/worker-reports.module.js
D  server/dist/reports/worker-reports/worker-reports.module.js.map
D  server/dist/reports/worker-reports/worker-reports.service.d.ts
D  server/dist/reports/worker-reports/worker-reports.service.js
D  server/dist/reports/worker-reports/worker-reports.service.js.map
D  server/dist/roles/dto/assign-permission.dto.d.ts
D  server/dist/roles/dto/assign-permission.dto.js
D  server/dist/roles/dto/assign-permission.dto.js.map
D  server/dist/roles/dto/create-role.dto.d.ts
D  server/dist/roles/dto/create-role.dto.js
D  server/dist/roles/dto/create-role.dto.js.map
D  server/dist/roles/dto/index.d.ts
D  server/dist/roles/dto/index.js
D  server/dist/roles/dto/index.js.map
D  server/dist/roles/dto/update-role.dto.d.ts
D  server/dist/roles/dto/update-role.dto.js
D  server/dist/roles/dto/update-role.dto.js.map
D  server/dist/roles/roles.controller.d.ts
D  server/dist/roles/roles.controller.js
D  server/dist/roles/roles.controller.js.map
D  server/dist/roles/roles.module.d.ts
D  server/dist/roles/roles.module.js
D  server/dist/roles/roles.module.js.map
D  server/dist/roles/roles.service.d.ts
D  server/dist/roles/roles.service.js
D  server/dist/roles/roles.service.js.map
D  server/dist/sorting-facade/outputs/sorting-outputs-facade.controller.d.ts
D  server/dist/sorting-facade/outputs/sorting-outputs-facade.controller.js
D  server/dist/sorting-facade/outputs/sorting-outputs-facade.controller.js.map
D  server/dist/sorting-facade/sorting-facade.module.d.ts
D  server/dist/sorting-facade/sorting-facade.module.js
D  server/dist/sorting-facade/sorting-facade.module.js.map
D  server/dist/sorting-facade/stage-1/dto.d.ts
D  server/dist/sorting-facade/stage-1/dto.js
D  server/dist/sorting-facade/stage-1/dto.js.map
D  server/dist/sorting-facade/stage-1/sorting-stage1-facade.controller.d.ts
D  server/dist/sorting-facade/stage-1/sorting-stage1-facade.controller.js
D  server/dist/sorting-facade/stage-1/sorting-stage1-facade.controller.js.map
D  server/dist/sorting-facade/stage-2/dto.d.ts
D  server/dist/sorting-facade/stage-2/dto.js
D  server/dist/sorting-facade/stage-2/dto.js.map
D  server/dist/sorting-facade/stage-2/sorting-stage2-facade.controller.d.ts
D  server/dist/sorting-facade/stage-2/sorting-stage2-facade.controller.js
D  server/dist/sorting-facade/stage-2/sorting-stage2-facade.controller.js.map
D  server/dist/sorting-stage1/category-output/category-output.controller.d.ts
D  server/dist/sorting-stage1/category-output/category-output.controller.js
D  server/dist/sorting-stage1/category-output/category-output.controller.js.map
D  server/dist/sorting-stage1/category-output/category-output.module.d.ts
D  server/dist/sorting-stage1/category-output/category-output.module.js
D  server/dist/sorting-stage1/category-output/category-output.module.js.map
D  server/dist/sorting-stage1/category-output/category-output.service.d.ts
D  server/dist/sorting-stage1/category-output/category-output.service.js
D  server/dist/sorting-stage1/category-output/category-output.service.js.map
D  server/dist/sorting-stage1/sort-category-bucket/dto/create-sort-category-bucket.dto.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/dto/create-sort-category-bucket.dto.js
D  server/dist/sorting-stage1/sort-category-bucket/dto/create-sort-category-bucket.dto.js.map
D  server/dist/sorting-stage1/sort-category-bucket/dto/index.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/dto/index.js
D  server/dist/sorting-stage1/sort-category-bucket/dto/index.js.map
D  server/dist/sorting-stage1/sort-category-bucket/dto/update-sort-category-bucket.dto.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/dto/update-sort-category-bucket.dto.js
D  server/dist/sorting-stage1/sort-category-bucket/dto/update-sort-category-bucket.dto.js.map
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.controller.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.controller.js
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.controller.js.map
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.module.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.module.js
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.module.js.map
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.service.d.ts
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.service.js
D  server/dist/sorting-stage1/sort-category-bucket/sort-category-bucket.service.js.map
D  server/dist/sorting-stage1/sort-session/dto/create-sort-session.dto.d.ts
D  server/dist/sorting-stage1/sort-session/dto/create-sort-session.dto.js
D  server/dist/sorting-stage1/sort-session/dto/create-sort-session.dto.js.map
D  server/dist/sorting-stage1/sort-session/dto/index.d.ts
D  server/dist/sorting-stage1/sort-session/dto/index.js
D  server/dist/sorting-stage1/sort-session/dto/index.js.map
D  server/dist/sorting-stage1/sort-session/dto/update-sort-session.dto.d.ts
D  server/dist/sorting-stage1/sort-session/dto/update-sort-session.dto.js
D  server/dist/sorting-stage1/sort-session/dto/update-sort-session.dto.js.map
D  server/dist/sorting-stage1/sort-session/sort-session.controller.d.ts
D  server/dist/sorting-stage1/sort-session/sort-session.controller.js
D  server/dist/sorting-stage1/sort-session/sort-session.controller.js.map
D  server/dist/sorting-stage1/sort-session/sort-session.module.d.ts
D  server/dist/sorting-stage1/sort-session/sort-session.module.js
D  server/dist/sorting-stage1/sort-session/sort-session.module.js.map
D  server/dist/sorting-stage1/sort-session/sort-session.service.d.ts
D  server/dist/sorting-stage1/sort-session/sort-session.service.js
D  server/dist/sorting-stage1/sort-session/sort-session.service.js.map
D  server/dist/sorting-stage1/sorting-stage1.module.d.ts
D  server/dist/sorting-stage1/sorting-stage1.module.js
D  server/dist/sorting-stage1/sorting-stage1.module.js.map
D  server/dist/sorting-stage2/grade-bucket/dto/create-grade-bucket.dto.d.ts
D  server/dist/sorting-stage2/grade-bucket/dto/create-grade-bucket.dto.js
D  server/dist/sorting-stage2/grade-bucket/dto/create-grade-bucket.dto.js.map
D  server/dist/sorting-stage2/grade-bucket/dto/index.d.ts
D  server/dist/sorting-stage2/grade-bucket/dto/index.js
D  server/dist/sorting-stage2/grade-bucket/dto/index.js.map
D  server/dist/sorting-stage2/grade-bucket/dto/update-grade-bucket.dto.d.ts
D  server/dist/sorting-stage2/grade-bucket/dto/update-grade-bucket.dto.js
D  server/dist/sorting-stage2/grade-bucket/dto/update-grade-bucket.dto.js.map
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.controller.d.ts
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.controller.js
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.controller.js.map
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.module.d.ts
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.module.js
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.module.js.map
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.service.d.ts
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.service.js
D  server/dist/sorting-stage2/grade-bucket/grade-bucket.service.js.map
D  server/dist/sorting-stage2/grade-output/grade-output.controller.d.ts
D  server/dist/sorting-stage2/grade-output/grade-output.controller.js
D  server/dist/sorting-stage2/grade-output/grade-output.controller.js.map
D  server/dist/sorting-stage2/grade-output/grade-output.module.d.ts
D  server/dist/sorting-stage2/grade-output/grade-output.module.js
D  server/dist/sorting-stage2/grade-output/grade-output.module.js.map
D  server/dist/sorting-stage2/grade-output/grade-output.service.d.ts
D  server/dist/sorting-stage2/grade-output/grade-output.service.js
D  server/dist/sorting-stage2/grade-output/grade-output.service.js.map
D  server/dist/sorting-stage2/grade-session/dto/create-grade-session.dto.d.ts
D  server/dist/sorting-stage2/grade-session/dto/create-grade-session.dto.js
D  server/dist/sorting-stage2/grade-session/dto/create-grade-session.dto.js.map
D  server/dist/sorting-stage2/grade-session/dto/index.d.ts
D  server/dist/sorting-stage2/grade-session/dto/index.js
D  server/dist/sorting-stage2/grade-session/dto/index.js.map
D  server/dist/sorting-stage2/grade-session/dto/update-grade-session.dto.d.ts
D  server/dist/sorting-stage2/grade-session/dto/update-grade-session.dto.js
D  server/dist/sorting-stage2/grade-session/dto/update-grade-session.dto.js.map
D  server/dist/sorting-stage2/grade-session/grade-session.controller.d.ts
D  server/dist/sorting-stage2/grade-session/grade-session.controller.js
D  server/dist/sorting-stage2/grade-session/grade-session.controller.js.map
D  server/dist/sorting-stage2/grade-session/grade-session.module.d.ts
D  server/dist/sorting-stage2/grade-session/grade-session.module.js
D  server/dist/sorting-stage2/grade-session/grade-session.module.js.map
D  server/dist/sorting-stage2/grade-session/grade-session.service.d.ts
D  server/dist/sorting-stage2/grade-session/grade-session.service.js
D  server/dist/sorting-stage2/grade-session/grade-session.service.js.map
D  server/dist/sorting-stage2/grades/dto/index.d.ts
D  server/dist/sorting-stage2/grades/dto/index.js
D  server/dist/sorting-stage2/grades/dto/index.js.map
D  server/dist/sorting-stage2/grades/grades.controller.d.ts
D  server/dist/sorting-stage2/grades/grades.controller.js
D  server/dist/sorting-stage2/grades/grades.controller.js.map
D  server/dist/sorting-stage2/grades/grades.module.d.ts
D  server/dist/sorting-stage2/grades/grades.module.js
D  server/dist/sorting-stage2/grades/grades.module.js.map
D  server/dist/sorting-stage2/grades/grades.service.d.ts
D  server/dist/sorting-stage2/grades/grades.service.js
D  server/dist/sorting-stage2/grades/grades.service.js.map
D  server/dist/sorting-stage2/sorting-stage2.module.d.ts
D  server/dist/sorting-stage2/sorting-stage2.module.js
D  server/dist/sorting-stage2/sorting-stage2.module.js.map
D  server/dist/superadmin/dto/create-tenant.dto.d.ts
D  server/dist/superadmin/dto/create-tenant.dto.js
D  server/dist/superadmin/dto/create-tenant.dto.js.map
D  server/dist/superadmin/dto/index.d.ts
D  server/dist/superadmin/dto/index.js
D  server/dist/superadmin/dto/index.js.map
D  server/dist/superadmin/dto/tenant-response.dto.d.ts
D  server/dist/superadmin/dto/tenant-response.dto.js
D  server/dist/superadmin/dto/tenant-response.dto.js.map
D  server/dist/superadmin/dto/update-tenant.dto.d.ts
D  server/dist/superadmin/dto/update-tenant.dto.js
D  server/dist/superadmin/dto/update-tenant.dto.js.map
D  server/dist/superadmin/superadmin.controller.d.ts
D  server/dist/superadmin/superadmin.controller.js
D  server/dist/superadmin/superadmin.controller.js.map
D  server/dist/superadmin/superadmin.module.d.ts
D  server/dist/superadmin/superadmin.module.js
D  server/dist/superadmin/superadmin.module.js.map
D  server/dist/superadmin/superadmin.service.d.ts
D  server/dist/superadmin/superadmin.service.js
D  server/dist/superadmin/superadmin.service.js.map
D  server/dist/superadmin/tenant-bootstrap.service.d.ts
D  server/dist/superadmin/tenant-bootstrap.service.js
D  server/dist/superadmin/tenant-bootstrap.service.js.map
D  server/dist/tenant/dto/category.dto.d.ts
D  server/dist/tenant/dto/category.dto.js
D  server/dist/tenant/dto/category.dto.js.map
D  server/dist/tenant/dto/raw-category.dto.d.ts
D  server/dist/tenant/dto/raw-category.dto.js
D  server/dist/tenant/dto/raw-category.dto.js.map
D  server/dist/tenant/tenant.controller.d.ts
D  server/dist/tenant/tenant.controller.js
D  server/dist/tenant/tenant.controller.js.map
D  server/dist/tenant/tenant.module.d.ts
D  server/dist/tenant/tenant.module.js
D  server/dist/tenant/tenant.module.js.map
D  server/dist/tenant/tenant.service.d.ts
D  server/dist/tenant/tenant.service.js
D  server/dist/tenant/tenant.service.js.map
D  server/dist/tsconfig.tsbuildinfo
D  server/dist/users/dto/assign-role.dto.d.ts
D  server/dist/users/dto/assign-role.dto.js
D  server/dist/users/dto/assign-role.dto.js.map
D  server/dist/users/dto/create-user.dto.d.ts
D  server/dist/users/dto/create-user.dto.js
D  server/dist/users/dto/create-user.dto.js.map
D  server/dist/users/dto/index.d.ts
D  server/dist/users/dto/index.js
D  server/dist/users/dto/index.js.map
D  server/dist/users/dto/update-user.dto.d.ts
D  server/dist/users/dto/update-user.dto.js
D  server/dist/users/dto/update-user.dto.js.map
D  server/dist/users/users.controller.d.ts
D  server/dist/users/users.controller.js
D  server/dist/users/users.controller.js.map
D  server/dist/users/users.module.d.ts
D  server/dist/users/users.module.js
D  server/dist/users/users.module.js.map
D  server/dist/users/users.service.d.ts
D  server/dist/users/users.service.js
D  server/dist/users/users.service.js.map
D  server/dist/waste/dto/waste-category.dto.d.ts
D  server/dist/waste/dto/waste-category.dto.js
D  server/dist/waste/dto/waste-category.dto.js.map
D  server/dist/waste/dto/waste-line-item.dto.d.ts
D  server/dist/waste/dto/waste-line-item.dto.js
D  server/dist/waste/dto/waste-line-item.dto.js.map
D  server/dist/waste/waste.controller.d.ts
D  server/dist/waste/waste.controller.js
D  server/dist/waste/waste.controller.js.map
D  server/dist/waste/waste.module.d.ts
D  server/dist/waste/waste.module.js
D  server/dist/waste/waste.module.js.map
D  server/dist/waste/waste.service.d.ts
D  server/dist/waste/waste.service.js
D  server/dist/waste/waste.service.js.map
 M server/src/app.module.ts
 M server/src/auth/auth.service.ts
 M server/src/auth/dto/login.dto.ts
 M server/src/procurement/vendor/dto/index.ts
 M server/src/procurement/vendor/vendor.service.ts
 M server/src/superadmin/dto/create-tenant.dto.ts
 M server/src/superadmin/dto/tenant-response.dto.ts
 M server/src/superadmin/dto/update-tenant.dto.ts
 M server/src/superadmin/superadmin.controller.ts
 M server/src/superadmin/superadmin.service.ts
 M server/src/superadmin/tenant-bootstrap.service.ts
 M server/src/tenant/tenant.controller.ts
 M server/src/tenant/tenant.service.ts
 M server/src/users/dto/update-user.dto.ts
 M server/src/users/users.service.ts
 M server/src/waste/waste.controller.ts
 M server/src/waste/waste.service.ts
 M thriftos-frontend/src/app/app.routes.ts
 M thriftos-frontend/src/app/core/auth/auth.interceptor.ts
 M thriftos-frontend/src/app/core/auth/auth.models.ts
 M thriftos-frontend/src/app/core/auth/auth.ts
 M thriftos-frontend/src/app/core/guards/auth-guard.ts
 M thriftos-frontend/src/app/core/guards/permission-guard.ts
 M thriftos-frontend/src/app/core/guards/super-admin-guard.ts
 M thriftos-frontend/src/app/core/tenant/tenant.service.ts
 M thriftos-frontend/src/app/features/auth/login/login.component.ts
 M thriftos-frontend/src/app/features/auth/login/login.ts
 M thriftos-frontend/src/app/features/dashboard/dashboard/dashboard.ts
 M thriftos-frontend/src/app/features/shell/shell.component.ts
 M thriftos-frontend/src/app/modules/admin/admin.models.ts
 M thriftos-frontend/src/app/modules/admin/admin.routes.ts
 M thriftos-frontend/src/app/modules/admin/admin.service.ts
 M thriftos-frontend/src/app/modules/admin/categories/category-management.html
 M thriftos-frontend/src/app/modules/admin/categories/category-management.ts
 M thriftos-frontend/src/app/modules/admin/grades/grade-management.html
 M thriftos-frontend/src/app/modules/admin/grades/grade-management.ts
 M thriftos-frontend/src/app/modules/admin/roles/role-list.html
 M thriftos-frontend/src/app/modules/admin/roles/role-list.ts
 M thriftos-frontend/src/app/modules/admin/super-admin/super-admin.routes.ts
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenant-detail/tenant-detail.html
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenant-detail/tenant-detail.ts
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenant-form-drawer/tenant-form-drawer.html
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenant-form-drawer/tenant-form-drawer.ts
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenant.models.ts
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenants-list/tenants-list.html
 M thriftos-frontend/src/app/modules/admin/super-admin/tenants/tenants-list/tenants-list.ts
 M thriftos-frontend/src/app/modules/admin/tenant/tenant-settings.html
 M thriftos-frontend/src/app/modules/admin/tenant/tenant-settings.scss
 M thriftos-frontend/src/app/modules/admin/tenant/tenant-settings.ts
 M thriftos-frontend/src/app/modules/admin/users/user-list.html
 M thriftos-frontend/src/app/modules/admin/users/user-list.ts
 M thriftos-frontend/src/app/modules/admin/vendors/vendor-form-drawer.html
 M thriftos-frontend/src/app/modules/admin/vendors/vendor-form-drawer.ts
 M thriftos-frontend/src/app/modules/admin/vendors/vendor-management.html
 M thriftos-frontend/src/app/modules/admin/vendors/vendor-management.ts
 M thriftos-frontend/src/app/modules/admin/warehouses/warehouse-management.html
 M thriftos-frontend/src/app/modules/admin/warehouses/warehouse-management.ts
 M thriftos-frontend/src/app/modules/admin/waste-categories/waste-category-form.component.ts
 M thriftos-frontend/src/app/modules/admin/waste-categories/waste-category-list.component.ts
 M thriftos-frontend/src/app/modules/admin/waste-categories/waste-category.service.ts
 M thriftos-frontend/src/app/modules/inventory/inventory.models.ts
 M thriftos-frontend/src/app/modules/procurement/containers/container-charge-create/container-charge-create.ts
 M thriftos-frontend/src/app/modules/procurement/containers/container-detail/container-detail.html
 M thriftos-frontend/src/app/modules/procurement/containers/container-detail/container-detail.ts
 M thriftos-frontend/src/app/modules/procurement/incoming-bales/incoming-bale-detail/incoming-bale-detail.ts
 M thriftos-frontend/src/app/modules/procurement/purchase-orders/purchase-order-create/purchase-order-create.ts
 M thriftos-frontend/src/app/modules/procurement/rags/rag-edit-drawer.ts
 M thriftos-frontend/src/app/modules/procurement/rags/rag-list.html
 M thriftos-frontend/src/app/modules/procurement/rags/rag-list.ts
 M thriftos-frontend/src/app/modules/procurement/shared/cost-breakdown-panel/cost-breakdown-panel.html
 M thriftos-frontend/src/app/modules/procurement/shared/cost-breakdown-panel/cost-breakdown-panel.ts
 M thriftos-frontend/src/app/modules/repack/repack.service.ts
 M thriftos-frontend/src/app/modules/repack/workspace/repack-workspace.page.ts
 M thriftos-frontend/src/app/modules/reports/dashboard/reports-dashboard.ts
 M thriftos-frontend/src/app/modules/reports/pages/final-product-cost-report/final-product-cost-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/inventory-movements-report/inventory-movements-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/inventory-report/inventory-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/procurement-report/procurement-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/procurement-summary-report/procurement-summary-report.html
 M thriftos-frontend/src/app/modules/reports/pages/procurement-summary-report/procurement-summary-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/repack-summary-report/repack-summary-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/sorting-outputs-report/sorting-outputs-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/sorting-waste-report/sorting-waste-report.ts
 M thriftos-frontend/src/app/modules/reports/pages/waste-report/waste-report.ts
 M thriftos-frontend/src/app/shared/ui/app-dropdown/app-dropdown.component.html
 M thriftos-frontend/src/app/shared/ui/app-dropdown/app-dropdown.component.scss
 M thriftos-frontend/src/app/shared/ui/app-dropdown/app-dropdown.component.ts
 M thriftos-frontend/src/app/shared/ui/app-shell-layout/app-shell-layout.component.ts
 M thriftos-frontend/src/app/shared/ui/table/app-table.component.scss
 M thriftos-frontend/src/app/shared/ui/table/app-table.component.ts
 M thriftos-frontend/src/styles/_tokens.scss
?? docs/FINAL_REPORT.md
?? server/src/admin/
?? server/src/common/currency/
?? server/src/procurement/vendor/dto/update-vendor.dto.ts
?? server/src/tenant/dto/tenant-settings.dto.ts
?? server/src/tenant/dto/warehouse.dto.ts
?? thriftos-frontend/src/app/core/guards/admin-area.guard.ts
?? thriftos-frontend/src/app/core/guards/tenant-area.guard.ts
?? thriftos-frontend/src/app/core/money/
?? thriftos-frontend/src/app/features/admin-shell/
?? thriftos-frontend/src/app/features/auth/post-login-redirect.component.ts
?? thriftos-frontend/src/app/features/legacy/
?? thriftos-frontend/src/app/modules/admin/categories/category-form.component.ts
?? thriftos-frontend/src/app/modules/admin/grades/grade-form.component.ts
?? thriftos-frontend/src/app/modules/admin/roles/role-form.component.scss
?? thriftos-frontend/src/app/modules/admin/roles/role-form.component.ts
?? thriftos-frontend/src/app/modules/admin/users/user-form.component.ts
?? thriftos-frontend/src/app/modules/admin/vendors/vendor-form.component.ts
?? thriftos-frontend/src/app/modules/admin/warehouses/warehouse-form.component.ts
```

### Unstaged diff summary (git diff --stat)
```
 .gitignore                                         |   7 +
 prisma/schema.prisma                               |   1 +
 server/src/app.module.ts                           |   2 +
 server/src/auth/auth.service.ts                    |   6 +
 server/src/auth/dto/login.dto.ts                   |   2 +
 server/src/procurement/vendor/dto/index.ts         |   1 +
 server/src/procurement/vendor/vendor.service.ts    |  45 +++-
 server/src/superadmin/dto/create-tenant.dto.ts     |   9 +
 server/src/superadmin/dto/tenant-response.dto.ts   |  10 +-
 server/src/superadmin/dto/update-tenant.dto.ts     |  10 +-
 server/src/superadmin/superadmin.controller.ts     |  12 +-
 server/src/superadmin/superadmin.service.ts        |  53 +++-
 server/src/superadmin/tenant-bootstrap.service.ts  |  31 ++-
 server/src/tenant/tenant.controller.ts             |  54 ++++
 server/src/tenant/tenant.service.ts                | 295 ++++++++++++++++++++-
 server/src/users/dto/update-user.dto.ts            |   6 +-
 server/src/users/users.service.ts                  |  19 +-
 server/src/waste/waste.controller.ts               |  10 +-
 server/src/waste/waste.service.ts                  |  34 +++
 thriftos-frontend/src/app/app.routes.ts            |  64 +++--
 .../src/app/core/auth/auth.interceptor.ts          |   2 +-
 thriftos-frontend/src/app/core/auth/auth.models.ts |   5 +-
 thriftos-frontend/src/app/core/auth/auth.ts        |  15 +-
 .../src/app/core/guards/auth-guard.ts              |   4 +-
 .../src/app/core/guards/permission-guard.ts        |   5 +-
 .../src/app/core/guards/super-admin-guard.ts       |   5 +-
 .../src/app/core/tenant/tenant.service.ts          |  10 +-
 .../src/app/features/auth/login/login.component.ts |  49 +++-
 .../src/app/features/auth/login/login.ts           |   2 +-
 .../app/features/dashboard/dashboard/dashboard.ts  |   5 +-
 .../src/app/features/shell/shell.component.ts      |  64 +++--
 .../src/app/modules/admin/admin.models.ts          |  23 +-
 .../src/app/modules/admin/admin.routes.ts          | 140 ++++++++++
 .../src/app/modules/admin/admin.service.ts         | 227 +++++++++++++---
 .../admin/categories/category-management.html      | 173 ++++++------
 .../admin/categories/category-management.ts        | 148 ++++++++---
 .../app/modules/admin/grades/grade-management.html | 163 ++++--------
 .../app/modules/admin/grades/grade-management.ts   |  83 ++----
 .../src/app/modules/admin/roles/role-list.html     | 222 +++++-----------
 .../src/app/modules/admin/roles/role-list.ts       | 135 ++++------
 .../admin/super-admin/super-admin.routes.ts        |  55 ++++
 .../tenants/tenant-detail/tenant-detail.html       | 209 ++++++---------
 .../tenants/tenant-detail/tenant-detail.ts         |  57 ++--
 .../tenant-form-drawer/tenant-form-drawer.html     |   2 +-
 .../tenant-form-drawer/tenant-form-drawer.ts       |   9 +-
 .../admin/super-admin/tenants/tenant.models.ts     |  14 +-
 .../tenants/tenants-list/tenants-list.html         | 242 +++++------------
 .../tenants/tenants-list/tenants-list.ts           | 167 ++++++++++--
 .../app/modules/admin/tenant/tenant-settings.html  |  20 +-
 .../app/modules/admin/tenant/tenant-settings.scss  |  18 ++
 .../app/modules/admin/tenant/tenant-settings.ts    |  44 ++-
 .../src/app/modules/admin/users/user-list.html     |  43 +--
 .../src/app/modules/admin/users/user-list.ts       |  41 +--
 .../modules/admin/vendors/vendor-form-drawer.html  |  52 +---
 .../modules/admin/vendors/vendor-form-drawer.ts    |  40 ++-
 .../modules/admin/vendors/vendor-management.html   | 205 ++++++--------
 .../app/modules/admin/vendors/vendor-management.ts | 212 +++++++++++++--
 .../admin/warehouses/warehouse-management.html     | 175 ++++++------
 .../admin/warehouses/warehouse-management.ts       | 140 +++++++---
 .../waste-category-form.component.ts               |  15 +-
 .../waste-category-list.component.ts               |  64 +++--
 .../waste-categories/waste-category.service.ts     |  15 +-
 .../src/app/modules/inventory/inventory.models.ts  |  24 ++
 .../container-charge-create.ts                     |   5 +-
 .../container-detail/container-detail.html         |   4 +-
 .../container-detail/container-detail.ts           |   6 +-
 .../incoming-bale-detail/incoming-bale-detail.ts   |   4 +-
 .../purchase-order-create/purchase-order-create.ts |   6 +-
 .../modules/procurement/rags/rag-edit-drawer.ts    |   7 +-
 .../src/app/modules/procurement/rags/rag-list.html |   2 +-
 .../src/app/modules/procurement/rags/rag-list.ts   |   7 +-
 .../cost-breakdown-panel/cost-breakdown-panel.html |   6 +-
 .../cost-breakdown-panel/cost-breakdown-panel.ts   |   6 +-
 .../src/app/modules/repack/repack.service.ts       |  10 +
 .../repack/workspace/repack-workspace.page.ts      |  23 +-
 .../modules/reports/dashboard/reports-dashboard.ts |   9 +-
 .../final-product-cost-report.ts                   |   8 +-
 .../inventory-movements-report.ts                  |   8 +-
 .../pages/inventory-report/inventory-report.ts     |   8 +-
 .../pages/procurement-report/procurement-report.ts |   8 +-
 .../procurement-summary-report.html                |  10 +-
 .../procurement-summary-report.ts                  |  14 +-
 .../repack-summary-report/repack-summary-report.ts |   8 +-
 .../sorting-outputs-report.ts                      |   8 +-
 .../sorting-waste-report/sorting-waste-report.ts   |   8 +-
 .../reports/pages/waste-report/waste-report.ts     |   8 +-
 .../ui/app-dropdown/app-dropdown.component.html    |   3 +-
 .../ui/app-dropdown/app-dropdown.component.scss    |   6 -
 .../ui/app-dropdown/app-dropdown.component.ts      |   3 +-
 .../app-shell-layout/app-shell-layout.component.ts |  57 ++++
 .../app/shared/ui/table/app-table.component.scss   |  34 ++-
 .../src/app/shared/ui/table/app-table.component.ts |   3 +-
 thriftos-frontend/src/styles/_tokens.scss          |  49 ++--
 93 files changed, 2818 insertions(+), 1534 deletions(-)
```

### Staged diff summary (git diff --cached --stat)
```
 server/dist/app.module.d.ts                        |   2 -
 server/dist/app.module.js                          |  79 ---
 server/dist/app.module.js.map                      |   1 -
 server/dist/audit/audit.module.d.ts                |   2 -
 server/dist/audit/audit.module.js                  |  22 -
 server/dist/audit/audit.module.js.map              |   1 -
 server/dist/audit/audit.service.d.ts               |  77 ---
 server/dist/audit/audit.service.js                 |  73 ---
 server/dist/audit/audit.service.js.map             |   1 -
 server/dist/auth/auth.controller.d.ts              |  15 -
 server/dist/auth/auth.controller.js                | 115 ----
 server/dist/auth/auth.controller.js.map            |   1 -
 server/dist/auth/auth.module.d.ts                  |   2 -
 server/dist/auth/auth.module.js                    |  60 --
 server/dist/auth/auth.module.js.map                |   1 -
 server/dist/auth/auth.service.d.ts                 |  27 -
 server/dist/auth/auth.service.js                   | 268 ---------
 server/dist/auth/auth.service.js.map               |   1 -
 server/dist/auth/dto/index.d.ts                    |   2 -
 server/dist/auth/dto/index.js                      |  19 -
 server/dist/auth/dto/index.js.map                  |   1 -
 server/dist/auth/dto/login.dto.d.ts                |  16 -
 server/dist/auth/dto/login.dto.js                  |  31 -
 server/dist/auth/dto/login.dto.js.map              |   1 -
 server/dist/auth/dto/refresh.dto.d.ts              |   8 -
 server/dist/auth/dto/refresh.dto.js                |  25 -
 server/dist/auth/dto/refresh.dto.js.map            |   1 -
 server/dist/auth/jwt.strategy.d.ts                 |  18 -
 server/dist/auth/jwt.strategy.js                   |  56 --
 server/dist/auth/jwt.strategy.js.map               |   1 -
 server/dist/auth/password.service.d.ts             |   6 -
 server/dist/auth/password.service.js               |  35 --
 server/dist/auth/password.service.js.map           |   1 -
 server/dist/common/common.module.d.ts              |   2 -
 server/dist/common/common.module.js                |  24 -
 server/dist/common/common.module.js.map            |   1 -
 .../common/decorators/current-user.decorator.d.ts  |   8 -
 .../common/decorators/current-user.decorator.js    |  13 -
 .../decorators/current-user.decorator.js.map       |   1 -
 server/dist/common/decorators/index.d.ts           |   4 -
 server/dist/common/decorators/index.js             |  21 -
 server/dist/common/decorators/index.js.map         |   1 -
 .../common/decorators/permissions.decorator.d.ts   |   4 -
 .../common/decorators/permissions.decorator.js     |  11 -
 .../common/decorators/permissions.decorator.js.map |   1 -
 .../dist/common/decorators/public.decorator.d.ts   |   2 -
 server/dist/common/decorators/public.decorator.js  |   8 -
 .../dist/common/decorators/public.decorator.js.map |   1 -
 .../common/decorators/super-admin.decorator.d.ts   |   2 -
 .../common/decorators/super-admin.decorator.js     |   8 -
 .../common/decorators/super-admin.decorator.js.map |   1 -
 server/dist/common/guards/index.d.ts               |   3 -
 server/dist/common/guards/index.js                 |  20 -
 server/dist/common/guards/index.js.map             |   1 -
 server/dist/common/guards/jwt-auth.guard.d.ts      |  10 -
 server/dist/common/guards/jwt-auth.guard.js        |  44 --
 server/dist/common/guards/jwt-auth.guard.js.map    |   1 -
 server/dist/common/guards/permission.guard.d.ts    |  14 -
 server/dist/common/guards/permission.guard.js      | 139 -----
 server/dist/common/guards/permission.guard.js.map  |   1 -
 server/dist/common/guards/tenant.guard.d.ts        |  11 -
 server/dist/common/guards/tenant.guard.js          | 109 ----
 server/dist/common/guards/tenant.guard.js.map      |   1 -
 server/dist/health/health.controller.d.ts          |  16 -
 server/dist/health/health.controller.js            |  97 ----
 server/dist/health/health.controller.js.map        |   1 -
 server/dist/health/health.module.d.ts              |   2 -
 server/dist/health/health.module.js                |  25 -
 server/dist/health/health.module.js.map            |   1 -
 server/dist/health/index.d.ts                      |   3 -
 server/dist/health/index.js                        |  20 -
 server/dist/health/index.js.map                    |   1 -
 server/dist/health/prisma.health.d.ts              |   7 -
 server/dist/health/prisma.health.js                |  36 --
 server/dist/health/prisma.health.js.map            |   1 -
 server/dist/inventory/inventory.controller.d.ts    | 197 -------
 server/dist/inventory/inventory.controller.js      | 117 ----
 server/dist/inventory/inventory.controller.js.map  |   1 -
 server/dist/inventory/inventory.module.d.ts        |   2 -
 server/dist/inventory/inventory.module.js          |  25 -
 server/dist/inventory/inventory.module.js.map      |   1 -
 server/dist/inventory/inventory.service.d.ts       | 204 -------
 server/dist/inventory/inventory.service.js         | 315 ----------
 server/dist/inventory/inventory.service.js.map     |   1 -
 server/dist/main.d.ts                              |   1 -
 server/dist/main.js                                |  93 ---
 server/dist/main.js.map                            |   1 -
 server/dist/me/me.controller.d.ts                  |  19 -
 server/dist/me/me.controller.js                    |  79 ---
 server/dist/me/me.controller.js.map                |   1 -
 server/dist/me/me.module.d.ts                      |   2 -
 server/dist/me/me.module.js                        |  23 -
 server/dist/me/me.module.js.map                    |   1 -
 .../dist/permissions/permissions.controller.d.ts   |  21 -
 server/dist/permissions/permissions.controller.js  |  49 --
 .../dist/permissions/permissions.controller.js.map |   1 -
 server/dist/permissions/permissions.module.d.ts    |   2 -
 server/dist/permissions/permissions.module.js      |  23 -
 server/dist/permissions/permissions.module.js.map  |   1 -
 server/dist/permissions/permissions.service.d.ts   |  37 --
 server/dist/permissions/permissions.service.js     |  53 --
 server/dist/permissions/permissions.service.js.map |   1 -
 server/dist/prisma/prisma.module.d.ts              |   2 -
 server/dist/prisma/prisma.module.js                |  22 -
 server/dist/prisma/prisma.module.js.map            |   1 -
 server/dist/prisma/prisma.service.d.ts             |   8 -
 server/dist/prisma/prisma.service.js               |  38 --
 server/dist/prisma/prisma.service.js.map           |   1 -
 .../container/container.controller.d.ts            | 308 ----------
 .../procurement/container/container.controller.js  | 175 ------
 .../container/container.controller.js.map          |   1 -
 .../procurement/container/container.module.d.ts    |   2 -
 .../dist/procurement/container/container.module.js |  26 -
 .../procurement/container/container.module.js.map  |   1 -
 .../procurement/container/container.service.d.ts   | 318 ----------
 .../procurement/container/container.service.js     | 305 ----------
 .../procurement/container/container.service.js.map |   1 -
 .../container/dto/create-container-charge.dto.d.ts |   6 -
 .../container/dto/create-container-charge.dto.js   |  33 --
 .../dto/create-container-charge.dto.js.map         |   1 -
 .../container/dto/create-container.dto.d.ts        |  20 -
 .../container/dto/create-container.dto.js          | 117 ----
 .../container/dto/create-container.dto.js.map      |   1 -
 server/dist/procurement/container/dto/index.d.ts   |   4 -
 server/dist/procurement/container/dto/index.js     |  21 -
 server/dist/procurement/container/dto/index.js.map |   1 -
 .../container/dto/update-container-status.dto.d.ts |   4 -
 .../container/dto/update-container-status.dto.js   |  22 -
 .../dto/update-container-status.dto.js.map         |   1 -
 .../container/dto/update-container.dto.d.ts        |  19 -
 .../container/dto/update-container.dto.js          | 114 ----
 .../container/dto/update-container.dto.js.map      |   1 -
 .../cost-allocation/cost-allocation.service.d.ts   |  39 --
 .../cost-allocation/cost-allocation.service.js     | 178 ------
 .../cost-allocation/cost-allocation.service.js.map |   1 -
 .../procurement-dashboard.controller.d.ts          |  36 --
 .../dashboard/procurement-dashboard.controller.js  |  48 --
 .../procurement-dashboard.controller.js.map        |   1 -
 .../dashboard/procurement-dashboard.module.d.ts    |   2 -
 .../dashboard/procurement-dashboard.module.js      |  25 -
 .../dashboard/procurement-dashboard.module.js.map  |   1 -
 .../dashboard/procurement-dashboard.service.d.ts   |  35 --
 .../dashboard/procurement-dashboard.service.js     | 133 -----
 .../dashboard/procurement-dashboard.service.js.map |   1 -
 .../dto/create-incoming-bale.dto.d.ts              |   8 -
 .../incoming-bale/dto/create-incoming-bale.dto.js  |  49 --
 .../dto/create-incoming-bale.dto.js.map            |   1 -
 .../dist/procurement/incoming-bale/dto/index.d.ts  |   1 -
 server/dist/procurement/incoming-bale/dto/index.js |  18 -
 .../procurement/incoming-bale/dto/index.js.map     |   1 -
 .../incoming-bale/incoming-bale.controller.d.ts    | 187 ------
 .../incoming-bale/incoming-bale.controller.js      | 119 ----
 .../incoming-bale/incoming-bale.controller.js.map  |   1 -
 .../incoming-bale/incoming-bale.module.d.ts        |   2 -
 .../incoming-bale/incoming-bale.module.js          |  26 -
 .../incoming-bale/incoming-bale.module.js.map      |   1 -
 .../incoming-bale/incoming-bale.service.d.ts       | 198 -------
 .../incoming-bale/incoming-bale.service.js         | 405 -------------
 .../incoming-bale/incoming-bale.service.js.map     |   1 -
 server/dist/procurement/procurement.module.d.ts    |   2 -
 server/dist/procurement/procurement.module.js      |  35 --
 server/dist/procurement/procurement.module.js.map  |   1 -
 .../dto/create-purchase-order.dto.d.ts             |   6 -
 .../dto/create-purchase-order.dto.js               |  33 --
 .../dto/create-purchase-order.dto.js.map           |   1 -
 .../dist/procurement/purchase-order/dto/index.d.ts |   2 -
 .../dist/procurement/purchase-order/dto/index.js   |  19 -
 .../procurement/purchase-order/dto/index.js.map    |   1 -
 .../dto/update-purchase-order.dto.d.ts             |   4 -
 .../dto/update-purchase-order.dto.js               |  28 -
 .../dto/update-purchase-order.dto.js.map           |   1 -
 .../purchase-order/purchase-order.controller.d.ts  | 307 ----------
 .../purchase-order/purchase-order.controller.js    | 126 ----
 .../purchase-order.controller.js.map               |   1 -
 .../purchase-order/purchase-order.module.d.ts      |   2 -
 .../purchase-order/purchase-order.module.js        |  25 -
 .../purchase-order/purchase-order.module.js.map    |   1 -
 .../purchase-order/purchase-order.service.d.ts     | 314 ----------
 .../purchase-order/purchase-order.service.js       | 220 -------
 .../purchase-order/purchase-order.service.js.map   |   1 -
 .../dist/procurement/rag/dto/create-rag.dto.d.ts   |   8 -
 server/dist/procurement/rag/dto/create-rag.dto.js  |  44 --
 .../dist/procurement/rag/dto/create-rag.dto.js.map |   1 -
 server/dist/procurement/rag/dto/index.d.ts         |   1 -
 server/dist/procurement/rag/dto/index.js           |  18 -
 server/dist/procurement/rag/dto/index.js.map       |   1 -
 server/dist/procurement/rag/rag.controller.d.ts    | 108 ----
 server/dist/procurement/rag/rag.controller.js      | 103 ----
 server/dist/procurement/rag/rag.controller.js.map  |   1 -
 server/dist/procurement/rag/rag.module.d.ts        |   2 -
 server/dist/procurement/rag/rag.module.js          |  26 -
 server/dist/procurement/rag/rag.module.js.map      |   1 -
 server/dist/procurement/rag/rag.service.d.ts       | 118 ----
 server/dist/procurement/rag/rag.service.js         | 209 -------
 server/dist/procurement/rag/rag.service.js.map     |   1 -
 .../procurement/shared/tenant-sequence.module.d.ts |   2 -
 .../procurement/shared/tenant-sequence.module.js   |  21 -
 .../shared/tenant-sequence.module.js.map           |   1 -
 .../shared/tenant-sequence.service.d.ts            |  20 -
 .../procurement/shared/tenant-sequence.service.js  |  62 --
 .../shared/tenant-sequence.service.js.map          |   1 -
 .../procurement/vendor/dto/create-vendor.dto.d.ts  |   5 -
 .../procurement/vendor/dto/create-vendor.dto.js    |  35 --
 .../vendor/dto/create-vendor.dto.js.map            |   1 -
 server/dist/procurement/vendor/dto/index.d.ts      |   1 -
 server/dist/procurement/vendor/dto/index.js        |  18 -
 server/dist/procurement/vendor/dto/index.js.map    |   1 -
 .../dist/procurement/vendor/vendor.controller.d.ts |  28 -
 .../dist/procurement/vendor/vendor.controller.js   |  63 --
 .../procurement/vendor/vendor.controller.js.map    |   1 -
 server/dist/procurement/vendor/vendor.module.d.ts  |   2 -
 server/dist/procurement/vendor/vendor.module.js    |  23 -
 .../dist/procurement/vendor/vendor.module.js.map   |   1 -
 server/dist/procurement/vendor/vendor.service.d.ts |  48 --
 server/dist/procurement/vendor/vendor.service.js   |  95 ---
 .../dist/procurement/vendor/vendor.service.js.map  |   1 -
 server/dist/repack/dto/repack-allocation.dto.d.ts  |  27 -
 server/dist/repack/dto/repack-allocation.dto.js    | 109 ----
 .../dist/repack/dto/repack-allocation.dto.js.map   |   1 -
 .../dist/repack/qr-label/qr-label.controller.d.ts  |  25 -
 server/dist/repack/qr-label/qr-label.controller.js |  47 --
 .../repack/qr-label/qr-label.controller.js.map     |   1 -
 server/dist/repack/qr-label/qr-label.module.d.ts   |   2 -
 server/dist/repack/qr-label/qr-label.module.js     |  23 -
 server/dist/repack/qr-label/qr-label.module.js.map |   1 -
 server/dist/repack/qr-label/qr-label.service.d.ts  |  23 -
 server/dist/repack/qr-label/qr-label.service.js    |  60 --
 .../dist/repack/qr-label/qr-label.service.js.map   |   1 -
 server/dist/repack/qr-label/qr-payload.util.d.ts   |  11 -
 server/dist/repack/qr-label/qr-payload.util.js     |  10 -
 server/dist/repack/qr-label/qr-payload.util.js.map |   1 -
 .../repack-item/dto/create-repack-item.dto.d.ts    |   5 -
 .../repack-item/dto/create-repack-item.dto.js      |  31 -
 .../repack-item/dto/create-repack-item.dto.js.map  |   1 -
 server/dist/repack/repack-item/dto/index.d.ts      |   1 -
 server/dist/repack/repack-item/dto/index.js        |  18 -
 server/dist/repack/repack-item/dto/index.js.map    |   1 -
 .../repack/repack-item/repack-item.controller.d.ts |  59 --
 .../repack/repack-item/repack-item.controller.js   |  50 --
 .../repack-item/repack-item.controller.js.map      |   1 -
 .../repack/repack-item/repack-item.module.d.ts     |   2 -
 .../dist/repack/repack-item/repack-item.module.js  |  23 -
 .../repack/repack-item/repack-item.module.js.map   |   1 -
 .../repack/repack-item/repack-item.service.d.ts    |  60 --
 .../dist/repack/repack-item/repack-item.service.js | 171 ------
 .../repack/repack-item/repack-item.service.js.map  |   1 -
 .../dto/create-repack-session.dto.d.ts             |   4 -
 .../dto/create-repack-session.dto.js               |  27 -
 .../dto/create-repack-session.dto.js.map           |   1 -
 server/dist/repack/repack-session/dto/index.d.ts   |   2 -
 server/dist/repack/repack-session/dto/index.js     |  19 -
 server/dist/repack/repack-session/dto/index.js.map |   1 -
 .../dto/update-repack-session.dto.d.ts             |   4 -
 .../dto/update-repack-session.dto.js               |  27 -
 .../dto/update-repack-session.dto.js.map           |   1 -
 .../repack-session/repack-session.controller.d.ts  | 137 -----
 .../repack-session/repack-session.controller.js    | 110 ----
 .../repack-session.controller.js.map               |   1 -
 .../repack-session/repack-session.module.d.ts      |   2 -
 .../repack/repack-session/repack-session.module.js |  23 -
 .../repack-session/repack-session.module.js.map    |   1 -
 .../repack-session/repack-session.service.d.ts     | 141 -----
 .../repack-session/repack-session.service.js       | 151 -----
 .../repack-session/repack-session.service.js.map   |   1 -
 .../repack-unit/dto/allocate-repack-unit.dto.d.ts  |   7 -
 .../repack-unit/dto/allocate-repack-unit.dto.js    |  36 --
 .../dto/allocate-repack-unit.dto.js.map            |   1 -
 .../repack-unit/dto/create-repack-unit-v2.dto.d.ts |  12 -
 .../repack-unit/dto/create-repack-unit-v2.dto.js   |  55 --
 .../dto/create-repack-unit-v2.dto.js.map           |   1 -
 .../repack-unit/dto/create-repack-unit.dto.d.ts    |   8 -
 .../repack-unit/dto/create-repack-unit.dto.js      |  43 --
 .../repack-unit/dto/create-repack-unit.dto.js.map  |   1 -
 .../dto/deallocate-repack-unit.dto.d.ts            |   3 -
 .../repack-unit/dto/deallocate-repack-unit.dto.js  |  21 -
 .../dto/deallocate-repack-unit.dto.js.map          |   1 -
 server/dist/repack/repack-unit/dto/index.d.ts      |   5 -
 server/dist/repack/repack-unit/dto/index.js        |  22 -
 server/dist/repack/repack-unit/dto/index.js.map    |   1 -
 .../repack-unit/dto/seal-repack-unit-v3.dto.d.ts   |   3 -
 .../repack-unit/dto/seal-repack-unit-v3.dto.js     |  22 -
 .../repack-unit/dto/seal-repack-unit-v3.dto.js.map |   1 -
 .../repack/repack-unit/repack-unit.controller.d.ts | 336 -----------
 .../repack/repack-unit/repack-unit.controller.js   | 316 ----------
 .../repack-unit/repack-unit.controller.js.map      |   1 -
 .../repack/repack-unit/repack-unit.module.d.ts     |   2 -
 .../dist/repack/repack-unit/repack-unit.module.js  |  25 -
 .../repack/repack-unit/repack-unit.module.js.map   |   1 -
 .../repack/repack-unit/repack-unit.service.d.ts    | 424 --------------
 .../dist/repack/repack-unit/repack-unit.service.js | 645 ---------------------
 .../repack/repack-unit/repack-unit.service.js.map  |   1 -
 server/dist/repack/repack-unit/unit-code.util.d.ts |   3 -
 server/dist/repack/repack-unit/unit-code.util.js   |  22 -
 .../dist/repack/repack-unit/unit-code.util.js.map  |   1 -
 server/dist/repack/repack.module.d.ts              |   2 -
 server/dist/repack/repack.module.js                |  23 -
 server/dist/repack/repack.module.js.map            |   1 -
 .../repack/shared/repack-allocation.service.d.ts   |  50 --
 .../repack/shared/repack-allocation.service.js     | 599 -------------------
 .../repack/shared/repack-allocation.service.js.map |   1 -
 server/dist/repack/v3/repack-v3.service.d.ts       |  58 --
 server/dist/repack/v3/repack-v3.service.js         | 470 ---------------
 server/dist/repack/v3/repack-v3.service.js.map     |   1 -
 .../reports/common/dto/report-filters.dto.d.ts     |   9 -
 .../dist/reports/common/dto/report-filters.dto.js  |  52 --
 .../reports/common/dto/report-filters.dto.js.map   |   1 -
 server/dist/reports/common/report-utils.d.ts       |   8 -
 server/dist/reports/common/report-utils.js         |  41 --
 server/dist/reports/common/report-utils.js.map     |   1 -
 .../dist/reports/common/reports-audit.service.d.ts |  12 -
 .../dist/reports/common/reports-audit.service.js   |  35 --
 .../reports/common/reports-audit.service.js.map    |   1 -
 .../common/reports-consistency.service.d.ts        |   6 -
 .../reports/common/reports-consistency.service.js  | 172 ------
 .../common/reports-consistency.service.js.map      |   1 -
 .../cost-reports/cost-reports.controller.d.ts      |  80 ---
 .../cost-reports/cost-reports.controller.js        | 200 -------
 .../cost-reports/cost-reports.controller.js.map    |   1 -
 .../reports/cost-reports/cost-reports.module.d.ts  |   2 -
 .../reports/cost-reports/cost-reports.module.js    |  27 -
 .../cost-reports/cost-reports.module.js.map        |   1 -
 .../reports/cost-reports/cost-reports.service.d.ts |  89 ---
 .../reports/cost-reports/cost-reports.service.js   | 290 ---------
 .../cost-reports/cost-reports.service.js.map       |   1 -
 .../dashboard-reports.controller.d.ts              |  58 --
 .../dashboard-reports.controller.js                |  58 --
 .../dashboard-reports.controller.js.map            |   1 -
 .../dashboard-reports.module.d.ts                  |   2 -
 .../dashboard-reports/dashboard-reports.module.js  |  26 -
 .../dashboard-reports.module.js.map                |   1 -
 .../dashboard-reports.service.d.ts                 |  68 ---
 .../dashboard-reports/dashboard-reports.service.js | 304 ----------
 .../dashboard-reports.service.js.map               |   1 -
 .../grading-reports.controller.d.ts                |  31 -
 .../grading-reports/grading-reports.controller.js  | 132 -----
 .../grading-reports.controller.js.map              |   1 -
 .../grading-reports/grading-reports.module.d.ts    |   2 -
 .../grading-reports/grading-reports.module.js      |  26 -
 .../grading-reports/grading-reports.module.js.map  |   1 -
 .../grading-reports/grading-reports.service.d.ts   |  31 -
 .../grading-reports/grading-reports.service.js     | 161 -----
 .../grading-reports/grading-reports.service.js.map |   1 -
 .../inventory-reports.controller.d.ts              |  88 ---
 .../inventory-reports.controller.js                | 222 -------
 .../inventory-reports.controller.js.map            |   1 -
 .../inventory-reports.module.d.ts                  |   2 -
 .../inventory-reports/inventory-reports.module.js  |  27 -
 .../inventory-reports.module.js.map                |   1 -
 .../inventory-reports.service.d.ts                 |  80 ---
 .../inventory-reports/inventory-reports.service.js | 260 ---------
 .../inventory-reports.service.js.map               |   1 -
 .../procurement-reports.controller.d.ts            |  75 ---
 .../procurement-reports.controller.js              | 188 ------
 .../procurement-reports.controller.js.map          |   1 -
 .../procurement-reports.module.d.ts                |   2 -
 .../procurement-reports.module.js                  |  27 -
 .../procurement-reports.module.js.map              |   1 -
 .../procurement-reports.service.d.ts               |  73 ---
 .../procurement-reports.service.js                 | 324 -----------
 .../procurement-reports.service.js.map             |   1 -
 .../repack-reports/repack-reports.controller.d.ts  |  55 --
 .../repack-reports/repack-reports.controller.js    | 190 ------
 .../repack-reports.controller.js.map               |   1 -
 .../repack-reports/repack-reports.module.d.ts      |   2 -
 .../repack-reports/repack-reports.module.js        |  27 -
 .../repack-reports/repack-reports.module.js.map    |   1 -
 .../repack-reports/repack-reports.service.d.ts     |  66 ---
 .../repack-reports/repack-reports.service.js       | 215 -------
 .../repack-reports/repack-reports.service.js.map   |   1 -
 server/dist/reports/reports.module.d.ts            |   2 -
 server/dist/reports/reports.module.js              |  38 --
 server/dist/reports/reports.module.js.map          |   1 -
 .../sorting-reports.controller.d.ts                | 169 ------
 .../sorting-reports/sorting-reports.controller.js  | 284 ---------
 .../sorting-reports.controller.js.map              |   1 -
 .../sorting-reports/sorting-reports.module.d.ts    |   2 -
 .../sorting-reports/sorting-reports.module.js      |  27 -
 .../sorting-reports/sorting-reports.module.js.map  |   1 -
 .../sorting-reports/sorting-reports.service.d.ts   | 186 ------
 .../sorting-reports/sorting-reports.service.js     | 590 -------------------
 .../sorting-reports/sorting-reports.service.js.map |   1 -
 .../waste-reports/waste-reports.controller.d.ts    |  35 --
 .../waste-reports/waste-reports.controller.js      | 141 -----
 .../waste-reports/waste-reports.controller.js.map  |   1 -
 .../waste-reports/waste-reports.module.d.ts        |   2 -
 .../reports/waste-reports/waste-reports.module.js  |  27 -
 .../waste-reports/waste-reports.module.js.map      |   1 -
 .../waste-reports/waste-reports.service.d.ts       |  32 -
 .../reports/waste-reports/waste-reports.service.js | 242 --------
 .../waste-reports/waste-reports.service.js.map     |   1 -
 .../worker-reports/worker-reports.controller.d.ts  |  26 -
 .../worker-reports/worker-reports.controller.js    | 102 ----
 .../worker-reports.controller.js.map               |   1 -
 .../worker-reports/worker-reports.module.d.ts      |   2 -
 .../worker-reports/worker-reports.module.js        |  26 -
 .../worker-reports/worker-reports.module.js.map    |   1 -
 .../worker-reports/worker-reports.service.d.ts     |  22 -
 .../worker-reports/worker-reports.service.js       | 100 ----
 .../worker-reports/worker-reports.service.js.map   |   1 -
 server/dist/roles/dto/assign-permission.dto.d.ts   |   6 -
 server/dist/roles/dto/assign-permission.dto.js     |  31 -
 server/dist/roles/dto/assign-permission.dto.js.map |   1 -
 server/dist/roles/dto/create-role.dto.d.ts         |   4 -
 server/dist/roles/dto/create-role.dto.js           |  30 -
 server/dist/roles/dto/create-role.dto.js.map       |   1 -
 server/dist/roles/dto/index.d.ts                   |   3 -
 server/dist/roles/dto/index.js                     |  20 -
 server/dist/roles/dto/index.js.map                 |   1 -
 server/dist/roles/dto/update-role.dto.d.ts         |   4 -
 server/dist/roles/dto/update-role.dto.js           |  30 -
 server/dist/roles/dto/update-role.dto.js.map       |   1 -
 server/dist/roles/roles.controller.d.ts            | 172 ------
 server/dist/roles/roles.controller.js              | 156 -----
 server/dist/roles/roles.controller.js.map          |   1 -
 server/dist/roles/roles.module.d.ts                |   2 -
 server/dist/roles/roles.module.js                  |  23 -
 server/dist/roles/roles.module.js.map              |   1 -
 server/dist/roles/roles.service.d.ts               | 171 ------
 server/dist/roles/roles.service.js                 | 271 ---------
 server/dist/roles/roles.service.js.map             |   1 -
 .../outputs/sorting-outputs-facade.controller.d.ts | 181 ------
 .../outputs/sorting-outputs-facade.controller.js   |  93 ---
 .../sorting-outputs-facade.controller.js.map       |   1 -
 .../dist/sorting-facade/sorting-facade.module.d.ts |   2 -
 .../dist/sorting-facade/sorting-facade.module.js   |  42 --
 .../sorting-facade/sorting-facade.module.js.map    |   1 -
 server/dist/sorting-facade/stage-1/dto.d.ts        |  23 -
 server/dist/sorting-facade/stage-1/dto.js          |  89 ---
 server/dist/sorting-facade/stage-1/dto.js.map      |   1 -
 .../stage-1/sorting-stage1-facade.controller.d.ts  | 278 ---------
 .../stage-1/sorting-stage1-facade.controller.js    | 396 -------------
 .../sorting-stage1-facade.controller.js.map        |   1 -
 server/dist/sorting-facade/stage-2/dto.d.ts        |  22 -
 server/dist/sorting-facade/stage-2/dto.js          |  83 ---
 server/dist/sorting-facade/stage-2/dto.js.map      |   1 -
 .../stage-2/sorting-stage2-facade.controller.d.ts  | 363 ------------
 .../stage-2/sorting-stage2-facade.controller.js    | 311 ----------
 .../sorting-stage2-facade.controller.js.map        |   1 -
 .../category-output.controller.d.ts                | 143 -----
 .../category-output/category-output.controller.js  |  79 ---
 .../category-output.controller.js.map              |   1 -
 .../category-output/category-output.module.d.ts    |   2 -
 .../category-output/category-output.module.js      |  23 -
 .../category-output/category-output.module.js.map  |   1 -
 .../category-output/category-output.service.d.ts   | 149 -----
 .../category-output/category-output.service.js     | 145 -----
 .../category-output/category-output.service.js.map |   1 -
 .../dto/create-sort-category-bucket.dto.d.ts       |   5 -
 .../dto/create-sort-category-bucket.dto.js         |  32 -
 .../dto/create-sort-category-bucket.dto.js.map     |   1 -
 .../sort-category-bucket/dto/index.d.ts            |   2 -
 .../sort-category-bucket/dto/index.js              |  19 -
 .../sort-category-bucket/dto/index.js.map          |   1 -
 .../dto/update-sort-category-bucket.dto.d.ts       |   4 -
 .../dto/update-sort-category-bucket.dto.js         |  27 -
 .../dto/update-sort-category-bucket.dto.js.map     |   1 -
 .../sort-category-bucket.controller.d.ts           |  29 -
 .../sort-category-bucket.controller.js             |  80 ---
 .../sort-category-bucket.controller.js.map         |   1 -
 .../sort-category-bucket.module.d.ts               |   2 -
 .../sort-category-bucket.module.js                 |  23 -
 .../sort-category-bucket.module.js.map             |   1 -
 .../sort-category-bucket.service.d.ts              |  31 -
 .../sort-category-bucket.service.js                | 139 -----
 .../sort-category-bucket.service.js.map            |   1 -
 .../sort-session/dto/create-sort-session.dto.d.ts  |   6 -
 .../sort-session/dto/create-sort-session.dto.js    |  37 --
 .../dto/create-sort-session.dto.js.map             |   1 -
 .../sorting-stage1/sort-session/dto/index.d.ts     |   2 -
 .../dist/sorting-stage1/sort-session/dto/index.js  |  19 -
 .../sorting-stage1/sort-session/dto/index.js.map   |   1 -
 .../sort-session/dto/update-sort-session.dto.d.ts  |   4 -
 .../sort-session/dto/update-sort-session.dto.js    |  27 -
 .../dto/update-sort-session.dto.js.map             |   1 -
 .../sort-session/sort-session.controller.d.ts      | 178 ------
 .../sort-session/sort-session.controller.js        | 111 ----
 .../sort-session/sort-session.controller.js.map    |   1 -
 .../sort-session/sort-session.module.d.ts          |   2 -
 .../sort-session/sort-session.module.js            |  23 -
 .../sort-session/sort-session.module.js.map        |   1 -
 .../sort-session/sort-session.service.d.ts         | 183 ------
 .../sort-session/sort-session.service.js           | 303 ----------
 .../sort-session/sort-session.service.js.map       |   1 -
 .../dist/sorting-stage1/sorting-stage1.module.d.ts |   2 -
 .../dist/sorting-stage1/sorting-stage1.module.js   |  22 -
 .../sorting-stage1/sorting-stage1.module.js.map    |   1 -
 .../grade-bucket/dto/create-grade-bucket.dto.d.ts  |   5 -
 .../grade-bucket/dto/create-grade-bucket.dto.js    |  32 -
 .../dto/create-grade-bucket.dto.js.map             |   1 -
 .../sorting-stage2/grade-bucket/dto/index.d.ts     |   2 -
 .../dist/sorting-stage2/grade-bucket/dto/index.js  |  19 -
 .../sorting-stage2/grade-bucket/dto/index.js.map   |   1 -
 .../grade-bucket/dto/update-grade-bucket.dto.d.ts  |   4 -
 .../grade-bucket/dto/update-grade-bucket.dto.js    |  27 -
 .../dto/update-grade-bucket.dto.js.map             |   1 -
 .../grade-bucket/grade-bucket.controller.d.ts      |  29 -
 .../grade-bucket/grade-bucket.controller.js        |  80 ---
 .../grade-bucket/grade-bucket.controller.js.map    |   1 -
 .../grade-bucket/grade-bucket.module.d.ts          |   2 -
 .../grade-bucket/grade-bucket.module.js            |  23 -
 .../grade-bucket/grade-bucket.module.js.map        |   1 -
 .../grade-bucket/grade-bucket.service.d.ts         |  31 -
 .../grade-bucket/grade-bucket.service.js           | 135 -----
 .../grade-bucket/grade-bucket.service.js.map       |   1 -
 .../grade-output/grade-output.controller.d.ts      | 146 -----
 .../grade-output/grade-output.controller.js        |  64 --
 .../grade-output/grade-output.controller.js.map    |   1 -
 .../grade-output/grade-output.module.d.ts          |   2 -
 .../grade-output/grade-output.module.js            |  23 -
 .../grade-output/grade-output.module.js.map        |   1 -
 .../grade-output/grade-output.service.d.ts         | 189 ------
 .../grade-output/grade-output.service.js           | 222 -------
 .../grade-output/grade-output.service.js.map       |   1 -
 .../dto/create-grade-session.dto.d.ts              |   5 -
 .../grade-session/dto/create-grade-session.dto.js  |  31 -
 .../dto/create-grade-session.dto.js.map            |   1 -
 .../sorting-stage2/grade-session/dto/index.d.ts    |   2 -
 .../dist/sorting-stage2/grade-session/dto/index.js |  19 -
 .../sorting-stage2/grade-session/dto/index.js.map  |   1 -
 .../dto/update-grade-session.dto.d.ts              |   4 -
 .../grade-session/dto/update-grade-session.dto.js  |  27 -
 .../dto/update-grade-session.dto.js.map            |   1 -
 .../grade-session/grade-session.controller.d.ts    | 187 ------
 .../grade-session/grade-session.controller.js      | 111 ----
 .../grade-session/grade-session.controller.js.map  |   1 -
 .../grade-session/grade-session.module.d.ts        |   2 -
 .../grade-session/grade-session.module.js          |  23 -
 .../grade-session/grade-session.module.js.map      |   1 -
 .../grade-session/grade-session.service.d.ts       | 192 ------
 .../grade-session/grade-session.service.js         | 289 ---------
 .../grade-session/grade-session.service.js.map     |   1 -
 server/dist/sorting-stage2/grades/dto/index.d.ts   |  11 -
 server/dist/sorting-stage2/grades/dto/index.js     |  56 --
 server/dist/sorting-stage2/grades/dto/index.js.map |   1 -
 .../sorting-stage2/grades/grades.controller.d.ts   |  68 ---
 .../sorting-stage2/grades/grades.controller.js     | 117 ----
 .../sorting-stage2/grades/grades.controller.js.map |   1 -
 .../dist/sorting-stage2/grades/grades.module.d.ts  |   2 -
 server/dist/sorting-stage2/grades/grades.module.js |  23 -
 .../sorting-stage2/grades/grades.module.js.map     |   1 -
 .../dist/sorting-stage2/grades/grades.service.d.ts |  69 ---
 .../dist/sorting-stage2/grades/grades.service.js   | 131 -----
 .../sorting-stage2/grades/grades.service.js.map    |   1 -
 .../dist/sorting-stage2/sorting-stage2.module.d.ts |   2 -
 .../dist/sorting-stage2/sorting-stage2.module.js   |  23 -
 .../sorting-stage2/sorting-stage2.module.js.map    |   1 -
 server/dist/superadmin/dto/create-tenant.dto.d.ts  |  11 -
 server/dist/superadmin/dto/create-tenant.dto.js    |  70 ---
 .../dist/superadmin/dto/create-tenant.dto.js.map   |   1 -
 server/dist/superadmin/dto/index.d.ts              |   3 -
 server/dist/superadmin/dto/index.js                |  20 -
 server/dist/superadmin/dto/index.js.map            |   1 -
 .../dist/superadmin/dto/tenant-response.dto.d.ts   |  24 -
 server/dist/superadmin/dto/tenant-response.dto.js  |  10 -
 .../dist/superadmin/dto/tenant-response.dto.js.map |   1 -
 server/dist/superadmin/dto/update-tenant.dto.d.ts  |   7 -
 server/dist/superadmin/dto/update-tenant.dto.js    |  42 --
 .../dist/superadmin/dto/update-tenant.dto.js.map   |   1 -
 server/dist/superadmin/superadmin.controller.d.ts  |  26 -
 server/dist/superadmin/superadmin.controller.js    | 132 -----
 .../dist/superadmin/superadmin.controller.js.map   |   1 -
 server/dist/superadmin/superadmin.module.d.ts      |   2 -
 server/dist/superadmin/superadmin.module.js        |  26 -
 server/dist/superadmin/superadmin.module.js.map    |   1 -
 server/dist/superadmin/superadmin.service.d.ts     |  21 -
 server/dist/superadmin/superadmin.service.js       | 168 ------
 server/dist/superadmin/superadmin.service.js.map   |   1 -
 .../dist/superadmin/tenant-bootstrap.service.d.ts  |  19 -
 server/dist/superadmin/tenant-bootstrap.service.js | 182 ------
 .../superadmin/tenant-bootstrap.service.js.map     |   1 -
 server/dist/tenant/dto/category.dto.d.ts           |   9 -
 server/dist/tenant/dto/category.dto.js             |  46 --
 server/dist/tenant/dto/category.dto.js.map         |   1 -
 server/dist/tenant/dto/raw-category.dto.d.ts       |  10 -
 server/dist/tenant/dto/raw-category.dto.js         |  48 --
 server/dist/tenant/dto/raw-category.dto.js.map     |   1 -
 server/dist/tenant/tenant.controller.d.ts          | 139 -----
 server/dist/tenant/tenant.controller.js            | 214 -------
 server/dist/tenant/tenant.controller.js.map        |   1 -
 server/dist/tenant/tenant.module.d.ts              |   2 -
 server/dist/tenant/tenant.module.js                |  25 -
 server/dist/tenant/tenant.module.js.map            |   1 -
 server/dist/tenant/tenant.service.d.ts             | 137 -----
 server/dist/tenant/tenant.service.js               | 213 -------
 server/dist/tenant/tenant.service.js.map           |   1 -
 server/dist/tsconfig.tsbuildinfo                   |   1 -
 server/dist/users/dto/assign-role.dto.d.ts         |   6 -
 server/dist/users/dto/assign-role.dto.js           |  31 -
 server/dist/users/dto/assign-role.dto.js.map       |   1 -
 server/dist/users/dto/create-user.dto.d.ts         |   6 -
 server/dist/users/dto/create-user.dto.js           |  41 --
 server/dist/users/dto/create-user.dto.js.map       |   1 -
 server/dist/users/dto/index.d.ts                   |   3 -
 server/dist/users/dto/index.js                     |  20 -
 server/dist/users/dto/index.js.map                 |   1 -
 server/dist/users/dto/update-user.dto.d.ts         |   4 -
 server/dist/users/dto/update-user.dto.js           |  29 -
 server/dist/users/dto/update-user.dto.js.map       |   1 -
 server/dist/users/users.controller.d.ts            | 355 ------------
 server/dist/users/users.controller.js              | 187 ------
 server/dist/users/users.controller.js.map          |   1 -
 server/dist/users/users.module.d.ts                |   2 -
 server/dist/users/users.module.js                  |  25 -
 server/dist/users/users.module.js.map              |   1 -
 server/dist/users/users.service.d.ts               | 358 ------------
 server/dist/users/users.service.js                 | 338 -----------
 server/dist/users/users.service.js.map             |   1 -
 server/dist/waste/dto/waste-category.dto.d.ts      |  12 -
 server/dist/waste/dto/waste-category.dto.js        |  55 --
 server/dist/waste/dto/waste-category.dto.js.map    |   1 -
 server/dist/waste/dto/waste-line-item.dto.d.ts     |  27 -
 server/dist/waste/dto/waste-line-item.dto.js       |  53 --
 server/dist/waste/dto/waste-line-item.dto.js.map   |   1 -
 server/dist/waste/waste.controller.d.ts            |  73 ---
 server/dist/waste/waste.controller.js              | 104 ----
 server/dist/waste/waste.controller.js.map          |   1 -
 server/dist/waste/waste.module.d.ts                |   2 -
 server/dist/waste/waste.module.js                  |  25 -
 server/dist/waste/waste.module.js.map              |   1 -
 server/dist/waste/waste.service.d.ts               | 156 -----
 server/dist/waste/waste.service.js                 | 148 -----
 server/dist/waste/waste.service.js.map             |   1 -
 622 files changed, 29617 deletions(-)
```
