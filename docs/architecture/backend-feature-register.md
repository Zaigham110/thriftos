# ThriftOS V3 — Backend Feature Register

## Overview

This document catalogs all backend API features implemented in ThriftOS V3. Each feature is assigned a unique ID for tracking frontend coverage.

---

## 🔐 Authentication Domain (AUTH)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| AUTH-001 | User Login | `/api/auth/login` | POST | ✅ Implemented |
| AUTH-002 | Token Refresh | `/api/auth/refresh` | POST | ✅ Implemented |
| AUTH-003 | User Logout | `/api/auth/logout` | POST | ✅ Implemented |
| AUTH-004 | Get Current User | `/api/me` | GET | ✅ Implemented |

---

## 🌍 Super Admin Domain (SA)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| SA-001 | List All Tenants | `/api/superadmin/tenants` | GET | ✅ Implemented |
| SA-002 | Create Tenant | `/api/superadmin/tenants` | POST | ✅ Implemented |
| SA-003 | Get Tenant by ID | `/api/superadmin/tenants/:id` | GET | ✅ Implemented |
| SA-004 | Update Tenant | `/api/superadmin/tenants/:id` | PUT | ✅ Implemented |
| SA-005 | Delete Tenant | `/api/superadmin/tenants/:id` | DELETE | ✅ Implemented |
| SA-006 | List Global Configs | `/api/superadmin/global-configs` | GET | ✅ Implemented |
| SA-007 | Create Global Config | `/api/superadmin/global-configs` | POST | ✅ Implemented |
| SA-008 | Update Global Config | `/api/superadmin/global-configs/:id` | PUT | ✅ Implemented |
| SA-009 | Delete Global Config | `/api/superadmin/global-configs/:id` | DELETE | ✅ Implemented |
| SA-010 | List Category Templates | `/api/superadmin/category-templates` | GET | ✅ Implemented |
| SA-011 | Create Category Template | `/api/superadmin/category-templates` | POST | ✅ Implemented |
| SA-012 | Update Category Template | `/api/superadmin/category-templates/:id` | PUT | ✅ Implemented |
| SA-013 | Delete Category Template | `/api/superadmin/category-templates/:id` | DELETE | ✅ Implemented |

---

## 👥 RBAC Domain (RBAC)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| RBAC-001 | List Users | `/api/users` | GET | ✅ Implemented |
| RBAC-002 | Create User | `/api/users` | POST | ✅ Implemented |
| RBAC-003 | Get User by ID | `/api/users/:id` | GET | ✅ Implemented |
| RBAC-004 | Update User | `/api/users/:id` | PUT | ✅ Implemented |
| RBAC-005 | Delete User | `/api/users/:id` | DELETE | ✅ Implemented |
| RBAC-006 | List Roles | `/api/roles` | GET | ✅ Implemented |
| RBAC-007 | Create Role | `/api/roles` | POST | ✅ Implemented |
| RBAC-008 | Get Role by ID | `/api/roles/:id` | GET | ✅ Implemented |
| RBAC-009 | Update Role | `/api/roles/:id` | PUT | ✅ Implemented |
| RBAC-010 | Delete Role | `/api/roles/:id` | DELETE | ✅ Implemented |
| RBAC-011 | Assign Role to User | `/api/users/:id/roles` | POST | ✅ Implemented |
| RBAC-012 | Remove Role from User | `/api/users/:id/roles/:roleId` | DELETE | ✅ Implemented |
| RBAC-013 | List All Permissions | `/api/permissions` | GET | ✅ Implemented |
| RBAC-014 | Assign Permission to Role | `/api/roles/:id/permissions` | POST | ✅ Implemented |
| RBAC-015 | Remove Permission from Role | `/api/roles/:id/permissions/:permId` | DELETE | ✅ Implemented |

---

## ⚙️ Tenant Configuration Domain (CFG)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| CFG-001 | List Categories | `/api/tenant/categories` | GET | ✅ Implemented |
| CFG-002 | Create Category | `/api/tenant/categories` | POST | ✅ Implemented |
| CFG-003 | Update Category | `/api/tenant/categories/:id` | PUT | ✅ Implemented |
| CFG-004 | Delete Category | `/api/tenant/categories/:id` | DELETE | ✅ Implemented |
| CFG-005 | List Grades | `/api/tenant/grades` | GET | ✅ Implemented |
| CFG-006 | Create Grade | `/api/tenant/grades` | POST | ✅ Implemented |
| CFG-007 | Update Grade | `/api/tenant/grades/:id` | PUT | ✅ Implemented |
| CFG-008 | Delete Grade | `/api/tenant/grades/:id` | DELETE | ✅ Implemented |
| CFG-009 | List Warehouses | `/api/inventory/warehouses` | GET | ✅ Implemented |
| CFG-010 | Create Warehouse | `/api/inventory/warehouses` | POST | ✅ Implemented |
| CFG-011 | Update Warehouse | `/api/inventory/warehouses/:id` | PUT | ✅ Implemented |
| CFG-012 | Delete Warehouse | `/api/inventory/warehouses/:id` | DELETE | ✅ Implemented |

---

## 📦 Procurement Domain (PROC)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| PROC-001 | List Vendors | `/api/procurement/vendors` | GET | ✅ Implemented |
| PROC-002 | Create Vendor | `/api/procurement/vendors` | POST | ✅ Implemented |
| PROC-003 | Get Vendor by ID | `/api/procurement/vendors/:id` | GET | ✅ Implemented |
| PROC-004 | Update Vendor | `/api/procurement/vendors/:id` | PUT | ✅ Implemented |
| PROC-005 | Delete Vendor | `/api/procurement/vendors/:id` | DELETE | ✅ Implemented |
| PROC-006 | List Purchase Orders | `/api/procurement/purchase-orders` | GET | ✅ Implemented |
| PROC-007 | Create Purchase Order | `/api/procurement/purchase-orders` | POST | ✅ Implemented |
| PROC-008 | Get PO by ID | `/api/procurement/purchase-orders/:id` | GET | ✅ Implemented |
| PROC-009 | Update Purchase Order | `/api/procurement/purchase-orders/:id` | PUT | ✅ Implemented |
| PROC-010 | Delete Purchase Order | `/api/procurement/purchase-orders/:id` | DELETE | ✅ Implemented |
| PROC-011 | List Containers | `/api/procurement/containers` | GET | ✅ Implemented |
| PROC-012 | Create Container | `/api/procurement/containers` | POST | ✅ Implemented |
| PROC-013 | Get Container by ID | `/api/procurement/containers/:id` | GET | ✅ Implemented |
| PROC-014 | Update Container | `/api/procurement/containers/:id` | PUT | ✅ Implemented |
| PROC-015 | Delete Container | `/api/procurement/containers/:id` | DELETE | ✅ Implemented |
| PROC-016 | List Incoming Bales | `/api/procurement/incoming-bales` | GET | ✅ Implemented |
| PROC-017 | Create Incoming Bale | `/api/procurement/incoming-bales` | POST | ✅ Implemented |
| PROC-018 | Get Incoming Bale by ID | `/api/procurement/incoming-bales/:id` | GET | ✅ Implemented |
| PROC-019 | Update Incoming Bale | `/api/procurement/incoming-bales/:id` | PUT | ✅ Implemented |
| PROC-020 | Delete Incoming Bale | `/api/procurement/incoming-bales/:id` | DELETE | ✅ Implemented |
| PROC-021 | List Rags | `/api/procurement/rags` | GET | ✅ Implemented |
| PROC-022 | Create Rag | `/api/procurement/rags` | POST | ✅ Implemented |
| PROC-023 | Get Rag by ID | `/api/procurement/rags/:id` | GET | ✅ Implemented |
| PROC-024 | Update Rag | `/api/procurement/rags/:id` | PUT | ✅ Implemented |
| PROC-025 | Delete Rag | `/api/procurement/rags/:id` | DELETE | ✅ Implemented |
| PROC-026 | Add Container Charge | `/api/procurement/cost-allocation/containers/:id/charges` | POST | ✅ Implemented |
| PROC-027 | Update Container Charge | `/api/procurement/cost-allocation/charges/:id` | PUT | ✅ Implemented |
| PROC-028 | Delete Container Charge | `/api/procurement/cost-allocation/charges/:id` | DELETE | ✅ Implemented |
| PROC-029 | Get Container Cost Summary | `/api/procurement/cost-allocation/containers/:id/summary` | GET | ✅ Implemented |

---

## 🔄 Sorting Stage 1 Domain (SORT1)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| SORT1-001 | List Sort Sessions | `/api/sorting-stage1/sort-sessions` | GET | ✅ Implemented |
| SORT1-002 | Create Sort Session | `/api/sorting-stage1/sort-sessions` | POST | ✅ Implemented |
| SORT1-003 | Get Sort Session by ID | `/api/sorting-stage1/sort-sessions/:id` | GET | ✅ Implemented |
| SORT1-004 | Update Sort Session | `/api/sorting-stage1/sort-sessions/:id` | PUT | ✅ Implemented |
| SORT1-005 | Close Sort Session | `/api/sorting-stage1/sort-sessions/:id/close` | POST | ✅ Implemented |
| SORT1-006 | List Category Outputs | `/api/sorting-stage1/category-outputs` | GET | ✅ Implemented |
| SORT1-007 | Create Category Output | `/api/sorting-stage1/category-outputs` | POST | ✅ Implemented |
| SORT1-008 | Update Category Output | `/api/sorting-stage1/category-outputs/:id` | PUT | ✅ Implemented |
| SORT1-009 | Delete Category Output | `/api/sorting-stage1/category-outputs/:id` | DELETE | ✅ Implemented |

---

## 🎯 Sorting Stage 2 Domain (SORT2)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| SORT2-001 | List Grade Sessions | `/api/sorting-stage2/grade-sessions` | GET | ✅ Implemented |
| SORT2-002 | Create Grade Session | `/api/sorting-stage2/grade-sessions` | POST | ✅ Implemented |
| SORT2-003 | Get Grade Session by ID | `/api/sorting-stage2/grade-sessions/:id` | GET | ✅ Implemented |
| SORT2-004 | Update Grade Session | `/api/sorting-stage2/grade-sessions/:id` | PUT | ✅ Implemented |
| SORT2-005 | Close Grade Session | `/api/sorting-stage2/grade-sessions/:id/close` | POST | ✅ Implemented |
| SORT2-006 | List Grade Outputs | `/api/sorting-stage2/grade-outputs` | GET | ✅ Implemented |
| SORT2-007 | Create Grade Output | `/api/sorting-stage2/grade-outputs` | POST | ✅ Implemented |
| SORT2-008 | Update Grade Output | `/api/sorting-stage2/grade-outputs/:id` | PUT | ✅ Implemented |
| SORT2-009 | Delete Grade Output | `/api/sorting-stage2/grade-outputs/:id` | DELETE | ✅ Implemented |

---

## 📦 Repack Domain (REPACK)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| REPACK-001 | List Repack Sessions | `/api/repack/repack-sessions` | GET | ✅ Implemented |
| REPACK-002 | Create Repack Session | `/api/repack/repack-sessions` | POST | ✅ Implemented |
| REPACK-003 | Get Repack Session by ID | `/api/repack/repack-sessions/:id` | GET | ✅ Implemented |
| REPACK-004 | Update Repack Session | `/api/repack/repack-sessions/:id` | PUT | ✅ Implemented |
| REPACK-005 | Close Repack Session | `/api/repack/repack-sessions/:id/close` | POST | ✅ Implemented |
| REPACK-006 | List Repack Units | `/api/repack/repack-units` | GET | ✅ Implemented |
| REPACK-007 | Create Repack Unit | `/api/repack/repack-units` | POST | ✅ Implemented |
| REPACK-008 | Get Repack Unit by ID | `/api/repack/repack-units/:id` | GET | ✅ Implemented |
| REPACK-009 | Update Repack Unit | `/api/repack/repack-units/:id` | PUT | ✅ Implemented |
| REPACK-010 | Delete Repack Unit | `/api/repack/repack-units/:id` | DELETE | ✅ Implemented |
| REPACK-011 | Generate QR Label | `/api/repack/qr-labels/:unitId` | GET | ✅ Implemented |
| REPACK-012 | Print QR Label | `/api/repack/qr-labels/:unitId/print` | GET | ✅ Implemented |

---

## 📊 Inventory Domain (INV)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| INV-001 | List Inventory Items | `/api/inventory/items` | GET | ✅ Implemented |
| INV-002 | Get Inventory Item by ID | `/api/inventory/items/:id` | GET | ✅ Implemented |
| INV-003 | Update Inventory Item | `/api/inventory/items/:id` | PUT | ✅ Implemented |
| INV-004 | List Stock Movements | `/api/inventory/stock-movements` | GET | ✅ Implemented |
| INV-005 | Create Stock Movement | `/api/inventory/stock-movements` | POST | ✅ Implemented |
| INV-006 | Get Stock Movement by ID | `/api/inventory/stock-movements/:id` | GET | ✅ Implemented |

---

## 📈 Reports Domain (RPT)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| RPT-001 | Procurement Summary Report | `/api/reports/procurement/summary` | GET | ✅ Implemented |
| RPT-002 | Procurement Detail Report | `/api/reports/procurement/detail` | GET | ✅ Implemented |
| RPT-003 | Cost Analysis Report | `/api/reports/cost/analysis` | GET | ✅ Implemented |
| RPT-004 | Grading Summary Report | `/api/reports/grading/summary` | GET | ✅ Implemented |
| RPT-005 | Grading Detail Report | `/api/reports/grading/detail` | GET | ✅ Implemented |
| RPT-006 | Inventory Summary Report | `/api/reports/inventory/summary` | GET | ✅ Implemented |
| RPT-007 | Inventory Detail Report | `/api/reports/inventory/detail` | GET | ✅ Implemented |
| RPT-008 | Repack Summary Report | `/api/reports/repack/summary` | GET | ✅ Implemented |
| RPT-009 | Repack Detail Report | `/api/reports/repack/detail` | GET | ✅ Implemented |
| RPT-010 | Sorting Summary Report | `/api/reports/sorting/summary` | GET | ✅ Implemented |
| RPT-011 | Sorting Detail Report | `/api/reports/sorting/detail` | GET | ✅ Implemented |

---

## 🏥 Health & System (SYS)

| ID | Feature | Endpoint | Method | Status |
|----|---------|----------|--------|--------|
| SYS-001 | Health Check | `/api/health` | GET | ✅ Implemented |
| SYS-002 | Detailed Health | `/api/health/detailed` | GET | ✅ Implemented |
| SYS-003 | Readiness Probe | `/api/health/ready` | GET | ✅ Implemented |
| SYS-004 | Liveness Probe | `/api/health/live` | GET | ✅ Implemented |

---

## Summary

- **Total Features**: 100+
- **Domains**: 10
- **All Features**: ✅ Implemented in Backend

This register is the source of truth for frontend coverage tracking.
