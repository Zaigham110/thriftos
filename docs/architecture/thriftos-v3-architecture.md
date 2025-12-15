# ------------------------------------------------------------

# ⭐ 0. SYSTEM OVERVIEW

# ------------------------------------------------------------

ThriftOS V3 is a **modern, industrial-grade ERP** designed for textile recycling / thrift processing businesses of all sizes (SME → enterprise).
It supports:

### ✔ Container procurement

### ✔ Loose bale procurement

### ✔ Sorting pipeline (Stage 1: Category)

### ✔ Sorting pipeline (Stage 2: Grade)

### ✔ Repacking into final sellable units (bales/packs)

### ✔ Dual measurement inventory (weight & pcs)

### ✔ Automated multi-stage cost allocation

### ✔ Complex workflow monitoring

### ✔ QR-code based stock identities

### ✔ Strict RBAC and tenant isolation

### ✔ Expandable backend

### ✔ Modern enterprise Angular + Tailwind UI

---

# ------------------------------------------------------------

# ⭐ 1. MODULE MAP (SYSTEM DOMAINS)

# ------------------------------------------------------------

ThriftOS V3 consists of **9 core domains**:

## 1. Super Admin Domain

* Tenants
* Global configurations
* Global categories & template settings
* Global permissions

## 2. Configuration Domain

Tenant-level:

* Categories
* Grades
* Units (KG, PCS)
* Warehouses
* Locations

## 3. Procurement Domain

Supports:

* Containers
* Loose Bales
* Shipment details
* Vendors
* Cost allocation (CIF, customs, freight, duty, taxes)

Entities:

* PurchaseOrder
* Container
* ContainerCharges
* Rag
* IncomingBale

## 4. Sorting Stage 1 (Category Sorting)

Entities:

* SortSession
* SortCategoryBucket
* CategoryOutput

## 5. Sorting Stage 2 (Grading)

Entities:

* GradeSession
* GradeBucket
* GradeOutput

## 6. Repack/Bundle Domain

Entities:

* RepackSession
* RepackUnit
* RepackItem
* QR Labels

## 7. Inventory Domain

Entities:

* InventoryItem (tiered: category + grade)
* StockMovement
* WarehouseLocation

Supports:

* Weighted average cost
* Dual units

## 8. Sales Domain (Phase 6)

Entities:

* WholesaleOrder
* OrderItem
* ExportContainer
* PackingList

## 9. Reporting Domain

* Procurement performance
* Sorting KPIs
* Grading KPIs
* Worker performance
* Yield analysis
* Waste tracking
* Inventory summaries
* Cost analysis

---

# ------------------------------------------------------------

# ⭐ 2. ENTITY RELATIONSHIP DIAGRAM (ERD)

# ------------------------------------------------------------

**NOTE: This is the high-level ERD, refined for implementation.**

```
Tenant 1---* User
Tenant 1---* Category
Tenant 1---* Grade
Tenant 1---* Warehouse
Tenant 1---* Role
Role *---* Permission
User *---* Role

Tenant 1---* PurchaseOrder
PurchaseOrder 1---* Container
Container 1---* ContainerCharge
Container 1---* Rag
Container 1---* IncomingBale

Rag 1---* SortSession
SortSession 1---* SortCategoryBucket
SortCategoryBucket 1---* CategoryOutput

CategoryOutput 1---* GradeSession
GradeSession 1---* GradeBucket
GradeBucket 1---* GradeOutput

GradeOutput 1---* RepackSession
RepackSession 1---* RepackUnit
RepackUnit 1---* RepackItem

RepackUnit 1---1 QRLabel

RepackUnit 1---* InventoryItem
InventoryItem 1---* StockMovement
```

This ERD supports:

* Multi-stage material transformation
* Dual measurement units
* Flexible repacking
* Full audit trails

---

# ------------------------------------------------------------

# ⭐ 3. DOMAIN DEFINITIONS (DETAILED)

# ------------------------------------------------------------

Below is the deep domain model for implementation.

---

# 🟦 3.1 SUPER ADMIN DOMAIN (SaaS Layer)

### Tenant

```
id
name
companyCode
status (active/inactive)
currency
locale
createdAt
```

### GlobalConfig

```
id
key
valueJson
```

### GlobalCategoryTemplate

(Used as blueprint for tenants)

```
id
categoryName
defaultWeightUnit
defaultSortPriority
```

---

# 🟩 3.2 CONFIGURATION DOMAIN

### Category

```
id
tenantId
name
isActive
sortOrder
createdAt
```

### Grade

```
id
tenantId
name
description
rank
isActive
```

### Warehouse

```
id
tenantId
name
code
location
```

### Permission

```
id
code
name
group
```

---

# 🟧 3.3 PROCUREMENT DOMAIN

## PurchaseOrder

```
id
tenantId
vendorId
poNumber
poType (CONTAINER | LOOSE_BALE)
currency
totalCost
status (OPEN | RECEIVED | CLOSED)
createdAt
```

## Container

```
id
purchaseOrderId
containerNumber
referenceNumber
containerType
eta
grossWeight
netWeight
status
```

## ContainerCharge

```
id
containerId
description
amount
chargeType (CIF, Freight, Duty, Tax, PortHandling, Misc)
```

## Rag

```
id
containerId
ragCode
weightKg
allocatedCost
```

## IncomingBale

```
id
containerId (nullable)
vendorId
baleCode
categoryGuess
weightKg
cost
```

---

# 🟨 3.4 SORTING STAGE 1 — CATEGORY SORTING

### SortSession

```
id
ragId | incomingBaleId
tenantId
workerId
supervisorId
startTime
endTime
totalInputWeight
totalOutputWeight
wasteWeight
status (OPEN | CLOSED)
```

### SortCategoryBucket

```
id
sortSessionId
categoryId
outputWeightKg
outputCount
```

---

# 🟥 3.5 SORTING STAGE 2 — GRADING

### GradeSession

```
id
categoryOutputId
workerId
supervisorId
startTime
endTime
status
```

### GradeBucket

```
id
gradeSessionId
gradeId
outputWeightKg
outputCount
```

---

# 🟪 3.6 REPACK / BUNDLING DOMAIN

### RepackSession

```
id
tenantId
workerId
supervisorId
startTime
endTime
status
```

### RepackUnit

```
id
repackSessionId
categoryId
gradeId
unitCode (auto)
unitType (KG_BALE | PCS_PACK | MIXED_BALE)
weightKg
pcsCount
totalCost
status (READY | SOLD | RESERVED)
```

### RepackItem

```
id
repackUnitId
sourceType (CATEGORY_OUTPUT | GRADE_OUTPUT)
sourceId
weightKg
pcsCount
```

### QRLabel

```
id
repackUnitId
qrCode
generatedAt
```

---

# 🟫 3.7 INVENTORY DOMAIN

### InventoryItem

```
id
tenantId
repackUnitId
categoryId
gradeId
weightKg
pcsCount
avgCost
warehouseId
status (AVAILABLE | RESERVED | SOLD)
```

### StockMovement

```
id
inventoryItemId
movementType (INTAKE | ADJUSTMENT | SALE | EXPORT)
quantityKg
quantityPcs
referenceId
metadataJson
createdAt
```

---

# ------------------------------------------------------------

# ⭐ 4. WORKFLOW BLUEPRINTS (CRITICAL)

# ------------------------------------------------------------

These define how raw materials become final inventory.

---

# 🔵 4.1 PROCUREMENT → SORTING 1

```
PurchaseOrder → Container → Rag
Rag opened → SortSession created
SortSession produces:
    CategoryOutput entries
    Waste weight
```

Cost Allocation:

```
Rag allocatedCost / ragWeightKg → cost per KG
CategoryOutput inherits cost
```

---

# 🟩 4.2 SORTING 1 → SORTING 2

```
CategoryOutput → GradeSession
GradeSession produces:
    GradeBuckets
    Waste
```

Cost Allocation:

```
Category cost → grade buckets by proportion
```

---

# 🟧 4.3 SORTING 2 → REPACK

```
GradeOutput → RepackSession → RepackUnit
```

Bale creation:

```
Pick grade buckets → combine → create a 40kg bale
Cost = (sum of gradeInputCost)
QR generated
```

---

# 🟪 4.4 REPACK → INVENTORY

```
RepackUnit finalized → InventoryItem created
StockMovement(INTAKE)
```

---

# ------------------------------------------------------------

# ⭐ 5. COST ALLOCATION ENGINE (Tiered)

# ------------------------------------------------------------

### Level 1 — Container → Rag/Bale

Formula:

```
allocatedCost = (itemWeightKg / containerNetWeightKg) × containerTotalCost
```

### Level 2 — Rag → Category buckets

```
categoryCost = (bucketWeight / totalOutputWeight) × ragCost
```

### Level 3 — Category → Grade buckets

```
gradeCost = (gradeWeight / categoryWeight) × categoryCost
```

### Level 4 — Grade → RepackUnit

```
unitCost = sum(gradeCostsUsedInUnit)
```

---

# ------------------------------------------------------------

# ⭐ 6. INVENTORY ENGINE (Dual Measurement)

# ------------------------------------------------------------

Each item may have **weightKg** and **pcsCount**.
Weighted average cost must support dual mode.

```
avgCostKg = totalCost / totalWeight
avgCostPcs = totalCost / totalPCS
```

Inventory updates through StockMovement events.

---

# ------------------------------------------------------------

# ⭐ 7. RBAC SYSTEM (Strict)

# ------------------------------------------------------------

### Roles:

* Super Admin
* Tenant Admin
* Manager
* Supervisor
* Procurement
* Sorting Staff
* Grading Staff
* Accountant
* Warehouse
* Read-Only

Each role links to permissions via:

```
role_permissions
user_roles
```

---

# ------------------------------------------------------------

# ⭐ 8. REPORTING ENGINE

# ------------------------------------------------------------

Key reports:

* Container cost breakdown
* Rag yield analysis
* Category output distribution
* Grade distribution
* Worker performance
* Waste tracking
* Repack efficiency
* Inventory aging
* Cost vs Sale Margin
* Category profitability

---

# ------------------------------------------------------------

# ⭐ 9. FRONTEND ARCHITECTURE (Angular 20 + Tailwind)

# ------------------------------------------------------------

Feature modules:

```
/app
  /core
  /shared
  /layout
  /procurement
  /sorting
  /grading
  /repack
  /inventory
  /reports
  /admin
```

UI components from ThriftUI.

Dense ERP UI (40px rows).

Slide-overs for forms.

---

# ------------------------------------------------------------

# ⭐ 10. FINAL PHASE BUILD PLAN

# ------------------------------------------------------------

### Phase 0 — ERD + Config Schema

### Phase 1 — Super Admin + Tenant Config

### Phase 2 — Procurement

### Phase 3 — Sorting Stage 1

### Phase 4 — Sorting Stage 2

### Phase 5 — Repack + QR

### Phase 6 — Inventory Engine

### Phase 7 — Reports

### Phase 8 — RBAC Permissions

### Phase 9 — Sales + Export

### Phase 10 — Accounting (Optional future)