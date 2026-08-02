# ThriftOS System Rules, Architecture & Schema Knowledge

## 🎯 Frontend Design & Aesthetic Rules

1. **Brand Primary Color Integrity:**
   - Always stick to the project's primary brand color (`$primary` / `hsl(var(--primary))` / `#714b67` deep plum purple).
   - Never override the primary color with arbitrary blue gradients or unapproved color schemes.

2. **Minimalist Oracle / Odoo Style Enterprise ERP Aesthetics:**
   - **Page Background:** `#f9fafb` (Odoo / Oracle light background).
   - **Cards & Surfaces:** Pure `#ffffff` with subtle 1px border (`#e5e7eb` / `$gray-200`).
   - **Data Density:** High-density table rows (44px height) with 13px Inter font.
   - **Status Badges:** Subtle green/amber/red status pills with status dots.

3. **CTA & Header Icon Alignment:**
   - All page headers, toolbars, and CTA buttons must use Lucide icons.
   - Icons must be centered using flex alignment (`display: inline-flex; align-items: center; gap: 0.5rem;`).

---

## 🏗️ Core Architecture & Business Domains

ThriftOS is a multi-tenant ERP engineered for textile recycling, thrift sorting, repacking, inventory, and sales operations.

### 1. Multi-Tenancy & SaaS Governance
- **Tenant Context:** Every operational entity (User, PO, Container, Rag, Session, Item, Sale, Waste) MUST be scoped by `tenantId`.
- **RBAC Hierarchy:** `Tenant` ➔ `User` ➔ `UserRole` ➔ `Role` ➔ `RolePermission` ➔ `Permission`. Access control is strictly enforced on NestJS backend guards and frontend Angular guards.
- **Operation Modes:** A tenant is configured as `FULL_ERP`, `SIMPLIFIED_MOBILE`, or `USER_CHOICE`. Users may persist a preferred mode only when the tenant permits choice. The frontend's `LITE` label maps to the persisted/API value `SIMPLIFIED_MOBILE`.

### 2. Supply Chain & Sorting Workflow (End-to-End Lineage)
```text
PurchaseOrder (Vendor) 
  └─ Container (In-Transit -> Arrived -> Cleared -> Closed) [ContainerCharges]
       └─ Rag / Loose Bale (sourceType: CONTAINER | LOOSE_BALE) [Status: NOT_STARTED -> IN_SORTING -> SORTED]
            └─ SortSession (Stage 1: Category Sorting) [1-to-1 with Rag]
                 ├─ SortCategoryBucket ➔ CategoryOutput
                 └─ SortingWaste / WasteLineItem
                      └─ GradeSession (Stage 2: Grading)
                           ├─ GradeBucket ➔ GradeOutput (Tracking: totalAmount, usedAmount, remainingAmount)
                           └─ WasteLineItem
                                └─ RepackSession ➔ RepackUnit (Mixed-Source v2 via RepackInputAllocation)
                                     ├─ QRLabel
                                     └─ InventoryItem (Status: AVAILABLE | RESERVED | SOLD)
                                          └─ StockMovement (INTAKE | ADJUSTMENT | RESERVATION | RELEASE | SALE | EXPORT)
                                               └─ SaleLine ➔ Sale (Customer, Payment)
```

### 3. Key Enums & State Machines
- **RagStatus:** `NOT_STARTED` (available), `IN_SORTING` (locked in active session), `SORTED` (permanently closed - 1-time sorting rule).
- **RagSourceType:** `CONTAINER` (originates from container), `LOOSE_BALE` (standalone loose bale, `containerId = null`).
- **PurchaseOrderStatus:** `OPEN`, `RECEIVED`, `CLOSED`.
- **ContainerStatus:** `IN_TRANSIT`, `ARRIVED`, `CLEARED`, `CLOSED`.
- **GradingOutputStatus:** `AVAILABLE`, `PARTIALLY_USED`, `DEPLETED`, `READY_FOR_REPACK`.
- **RepackStatus:** `DRAFT`, `READY`, `SEALED`, `SOLD`, `RESERVED`.
- **AllocationMode:** `FIFO` (automatic cost/amount usage), `MANUAL` (user-selected grade outputs).
- **SaleStatus:** `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`.
- **InventoryStatus:** `AVAILABLE`, `RESERVED`, `SOLD`.

---

## 📐 Data Model & Table Join Matrix (Prisma Keys)

| Entity / Table | Primary Key | Foreign Keys & Relations | Key Indexes |
|---|---|---|---|
| `Tenant` | `id` | - | `companyCode` (unique) |
| `User` | `id` | `tenantId` ➔ `Tenant.id` | `[tenantId, email]` (unique) |
| `Vendor` | `id` | `tenantId` ➔ `Tenant.id` | `[tenantId, name]` (unique), `vendorType` |
| `PurchaseOrder` | `id` | `tenantId` ➔ `Tenant.id`, `vendorId` ➔ `Vendor.id` | `[tenantId, poNumber]` (unique), `status` |
| `Container` | `id` | `tenantId` ➔ `Tenant.id`, `purchaseOrderId` ➔ `PurchaseOrder.id` | `[tenantId, containerNumber]` (unique), `status` |
| `ContainerCharge` | `id` | `containerId` ➔ `Container.id` | `containerId`, `chargeType` |
| `Rag` | `id` | `tenantId` ➔ `Tenant.id`, `containerId` ➔ `Container.id` (null for loose), `rawCategoryId` ➔ `RawCategory.id` | `[tenantId, ragCode]` (unique), `status`, `sourceType` |
| `SortSession` | `id` | `tenantId` ➔ `Tenant.id`, `ragId` ➔ `Rag.id` (1:1 Unique), `workerId`/`supervisorId` ➔ `User.id` | `ragId` (unique), `status` |
| `SortCategoryBucket` | `id` | `sortSessionId` ➔ `SortSession.id`, `categoryId` ➔ `Category.id` | `[sortSessionId, categoryId]` (unique) |
| `CategoryOutput` | `id` | `tenantId`, `sortCategoryBucketId`, `categoryId`, `ragId`, `containerId`, `sortSessionId` | `ragId`, `containerId`, `sortSessionId` |
| `SortingWaste` | `id` | `tenantId`, `sortSessionId` (1:1 Unique), `ragId`, `containerId` | `sortSessionId`, `ragId` |
| `GradeSession` | `id` | `tenantId`, `categoryOutputId` ➔ `CategoryOutput.id`, `workerId`/`supervisorId` ➔ `User.id` | `categoryOutputId`, `status` |
| `GradeBucket` | `id` | `gradeSessionId` ➔ `GradeSession.id`, `gradeId` ➔ `Grade.id` | `[gradeSessionId, gradeId]` (unique) |
| `GradeOutput` | `id` | `tenantId`, `gradeBucketId` ➔ `GradeBucket.id`, `gradeId` ➔ `Grade.id` | `gradeBucketId`, `status`, `measurementType` |
| `RepackSession` | `id` | `tenantId`, `workerId`/`supervisorId` ➔ `User.id` | `status` |
| `RepackUnit` | `id` | `tenantId`, `repackSessionId`, `categoryId`, `gradeId`, `containerId`, `ragId`, `sortSessionId`, `gradeSessionId` | `[tenantId, unitCode]` (unique), `status` |
| `RepackInputAllocation` | `id` | `tenantId`, `repackUnitId` ➔ `RepackUnit.id`, `gradingOutputId` ➔ `GradeOutput.id`, `containerId`, `ragBaleId` | `repackUnitId`, `gradingOutputId` |
| `QRLabel` | `id` | `repackUnitId` ➔ `RepackUnit.id` (1:1 Unique) | `qrCode` (unique) |
| `InventoryItem` | `id` | `tenantId`, `repackUnitId` ➔ `RepackUnit.id`, `categoryId`, `gradeId`, `warehouseId`, `containerId`, `ragId` | `status`, `repackUnitId`, `warehouseId` |
| `StockMovement` | `id` | `inventoryItemId` ➔ `InventoryItem.id` | `inventoryItemId`, `movementType` |
| `Customer` | `id` | `tenantId` ➔ `Tenant.id` | `[tenantId, name]` (unique) |
| `Sale` | `id` | `tenantId`, `customerId` ➔ `Customer.id`, `createdBy` ➔ `User.id` | `[tenantId, saleNumber]` (unique), `status` |
| `SaleLine` | `id` | `saleId` ➔ `Sale.id`, `inventoryItemId` ➔ `InventoryItem.id` | `saleId`, `inventoryItemId` |
| `InventoryReservation` | `id` | `tenantId`, `inventoryItemId` (1:1 Unique), `saleId`, `saleLineId` | `inventoryItemId`, `saleId` |
| `WasteCategory` | `id` | `tenantId`, `linkedCategoryId` ➔ `Category.id` (1:1 Unique) | `[tenantId, name]` (unique) |
| `WasteLineItem` | `id` | `tenantId`, `wasteCategoryId`, `sortSessionId`, `gradeSessionId`, `containerId`, `ragId`, `categoryOutputId` | `stage`, `wasteCategoryId`, `sortSessionId`, `gradeSessionId` |

---

## 🧮 Cost Allocation Engine Formulas

1. **Container Cost Allocation (Level 1):**
   Landed cost includes purchase cost + freight/customs/duties charges.
   $$\text{Allocated Rag Cost} = \left( \frac{\text{Rag Weight (kg)}}{\text{Container Net Weight (kg)}} \right) \times \left( \text{PO Cost} + \sum \text{Container Charges} \right)$$

2. **Stage 1 Category Cost Allocation (Level 2):**
   Allocates incoming Rag cost to generated Category outputs based on output weight ratio:
   $$\text{Category Output Cost} = \left( \frac{\text{Bucket Output Weight}}{\text{Total Session Output Weight}} \right) \times \text{Allocated Rag Cost}$$

3. **Stage 2 Grade Cost Allocation (Level 3):**
   Allocates Category Output cost across Grade buckets based on weight ratio:
   $$\text{Grade Output Cost} = \left( \frac{\text{Grade Bucket Output Weight}}{\text{Total Session Grade Weight}} \right) \times \text{Category Output Cost}$$

4. **Repack Unit Cost Allocation (Level 4 - Mixed-Source v2):**
   Sum of proportional costs derived from each allocated `GradeOutput`:
   $$\text{Repack Unit Cost} = \sum_{\text{allocations}} \left( \frac{\text{Amount Used}}{\text{Grade Output Total Amount}} \times \text{Grade Output Allocated Cost} \right)$$

5. **Dual Unit Inventory Costing:**
   $$\text{Average Cost per KG} = \frac{\text{Total Cost}}{\text{Total Weight (kg)}}, \quad \text{Average Cost per PCS} = \frac{\text{Total Cost}}{\text{Total PCS}}$$

---

## 🛡️ Mandatory Technical Directives for Future Development

1. **Strict Multi-Tenant Scoping:** All Prisma backend queries must include `where: { tenantId }` filter.
2. **One-Time Rag Sorting Enforcement:** Always verify `Rag.status === 'NOT_STARTED'` before initiating `SortSession`. Upon session start, transition `Rag.status` to `IN_SORTING`; upon finish, transition to `SORTED`.
3. **Traceability Chain Persistence:** When writing services for Repack, Inventory, or Waste, denormalize and pass `containerId` and `ragId` downstream to preserve audit lineage.
4. **Data Density & UI Rules:** Keep table row heights at 44px, use 13px Inter typography, deep plum `#714b67` for primary actions/accents, `#f9fafb` page backgrounds, and inline flex aligned Lucide icons.
5. **Continuous Architecture & Schema Synchronization:** Whenever Prisma schemas, database models, migrations, state machines, cost allocation formulas, or business workflows are created, updated, or modified during development, ALWAYS update `.agents/AGENTS.md` and related docs immediately to keep the system context in sync.
