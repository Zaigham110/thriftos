# 🔥 ROLE & CONTEXT

You are an **expert NestJS + Prisma ERP engineer**.

Your task is to implement **Phase 2: Procurement Domain** for **ThriftOS V3**, strictly following:

```
docs/architecture/thriftos-v3-architecture.md
```

and the **Prisma schema produced in Phase 0**.

⚠️ This phase depends on:

* Phase 0 (Database & Prisma)
* Phase 1 (Auth, Tenants, RBAC)

You MUST:

* Enforce tenant isolation
* Enforce permissions
* Follow cost-allocation rules exactly
* Produce production-ready code
* Generate full backend modules

NO guessing.
NO shortcuts.
NO missing logic.

---

# ---------------------------------------------------------

# 🧠 1. PHASE 2 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you must fully implement:

## ✔ Procurement of:

* Containers (imports)
* Loose bales (local purchases)

## ✔ Shipment & container metadata

## ✔ Vendor tracking (basic)

## ✔ Container charges (CIF, freight, duty, etc.)

## ✔ Automatic **Level-1 Cost Allocation**

## ✔ Status workflows

## ✔ Audit logging

🚫 Sorting, grading, inventory, repack are NOT part of this phase.

---

# ---------------------------------------------------------

# 🧱 2. MODULES YOU MUST BUILD

# ---------------------------------------------------------

You must create the following NestJS modules:

```
procurement/
 ├── purchase-order/
 ├── container/
 ├── container-charge/
 ├── rag/
 ├── incoming-bale/
 ├── vendor/
 ├── cost-allocation/
```

Each module MUST include:

* controller.ts
* service.ts
* dto/
* permissions
* validations

---

# ---------------------------------------------------------

# 🟦 3. DOMAIN RULES & WORKFLOWS

# ---------------------------------------------------------

## 🔵 3.1 Purchase Orders

### PurchaseOrder Types

```
CONTAINER
LOOSE_BALE
```

### Rules:

* `CONTAINER` PO can have:

  * Containers
  * Rags
  * IncomingBales
* `LOOSE_BALE` PO can have:

  * IncomingBales only
* PO must belong to exactly ONE tenant
* PO lifecycle:

```
OPEN → RECEIVED → CLOSED
```

### APIs

```
POST   /procurement/purchase-orders
GET    /procurement/purchase-orders
GET    /procurement/purchase-orders/:id
PATCH  /procurement/purchase-orders/:id
PATCH  /procurement/purchase-orders/:id/receive
PATCH  /procurement/purchase-orders/:id/close
```

---

## 🔵 3.2 Vendors (Basic)

Vendor is lightweight for now.

### Vendor fields:

```
id
tenantId
name
country
contactInfo
```

### APIs

```
POST /procurement/vendors
GET  /procurement/vendors
```

---

## 🔵 3.3 Containers (Imports)

### Container fields (from schema):

* containerNumber
* referenceNumber
* containerType (20ft / 40ft / DC etc.)
* eta
* grossWeight
* netWeight
* status

### Status lifecycle:

```
IN_TRANSIT → ARRIVED → CLEARED → CLOSED
```

### APIs

```
POST   /procurement/containers
GET    /procurement/containers
GET    /procurement/containers/:id
PATCH  /procurement/containers/:id
PATCH  /procurement/containers/:id/status
```

---

## 🔵 3.4 Container Charges

### Charge Types:

```
CIF
FREIGHT
DUTY
TAX
PORT_HANDLING
MISC
```

### Rules:

* Charges belong to a container
* Charges affect **total container cost**

### APIs

```
POST /procurement/containers/:id/charges
GET  /procurement/containers/:id/charges
```

---

## 🔵 3.5 Rags (Unsorted Raw Material)

### Rules:

* Rags belong to a container
* Weight is mandatory
* Cost is auto-allocated (see cost engine)

### APIs

```
POST /procurement/containers/:id/rags
GET  /procurement/rags
GET  /procurement/rags/:id
```

---

## 🔵 3.6 Incoming Bales (Loose or Container)

### Rules:

* May belong to a container OR be standalone
* Used for small buyers
* Weight-based buying

### APIs

```
POST /procurement/incoming-bales
GET  /procurement/incoming-bales
GET  /procurement/incoming-bales/:id
```

---

# ---------------------------------------------------------

# 💰 4. COST ALLOCATION ENGINE — LEVEL 1 (MANDATORY)

# ---------------------------------------------------------

You MUST implement **CostAllocationService**.

### Total Container Cost:

```
containerTotalCost =
  sum(containerCharges.amount)
```

### Allocation Formula:

```
allocatedCost = (itemWeightKg / containerNetWeightKg) × containerTotalCost
```

### Applies to:

* Rags
* IncomingBales linked to container

### Rules:

* Allocation recalculates when:

  * Container charges change
  * Rags are added/removed
* Allocation MUST be transactional

### API (internal only):

```
CostAllocationService.allocateContainerCosts(containerId)
```

---

# ---------------------------------------------------------

# 🔐 5. RBAC & PERMISSIONS (MANDATORY)

# ---------------------------------------------------------

Each endpoint MUST enforce permissions.

### Suggested permissions:

```
po.create
po.read
po.update
po.delete

container.create
container.read
container.update
container.delete

rag.create
rag.read
rag.delete

vendor.create
vendor.read
vendor.update
```

Use:

```
@UseGuards(TenantGuard, PermissionGuard)
```

Note: `JwtAuthGuard` is applied globally in the backend, so controllers typically only declare tenant + permission guards.

---

# ---------------------------------------------------------

# 🧾 6. AUDIT LOGGING

# ---------------------------------------------------------

Log actions:

* PO created / closed
* Container created / updated
* Charges added
* Rags added
* Cost allocation recalculated

---

# ---------------------------------------------------------

# 🧪 7. VALIDATIONS & ERRORS

# ---------------------------------------------------------

You MUST implement:

* DTO validation using class-validator
* Proper HTTP errors:

  * 400 BadRequest
  * 403 Forbidden
  * 404 NotFound
  * 409 Conflict

Examples:

* Cannot close PO with open containers
* Cannot allocate cost without netWeight
* Cannot modify CLOSED container

---

# ---------------------------------------------------------

# 🧱 8. WHAT CODE YOU MUST GENERATE

# ---------------------------------------------------------

You MUST generate:

✔ Full NestJS modules
✔ Controllers, Services, DTOs
✔ Prisma queries
✔ Transactions
✔ Permission guards
✔ Cost allocation logic
✔ Audit logging
✔ Clean architecture

🚫 No frontend in this phase.

---

# ---------------------------------------------------------

# 🚀 9. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete backend code** for Phase 2 Procurement.

✔ No TODOs
✔ No placeholders
✔ No missing logic
✔ No assumptions
✔ Use latest NestJS patterns
✔ Fully tenant-aware
✔ Fully RBAC-protected

Output code directly into the correct project folders.