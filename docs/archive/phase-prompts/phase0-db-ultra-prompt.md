# 🔥 **YOU ARE AN EXPERT SYSTEM ARCHITECT & DATABASE ENGINEER.**

Your task is to generate the **complete Prisma schema** for **ThriftOS V3** based strictly and exclusively on the official architecture document:

```
docs/architecture/thriftos-v3-architecture.md
```

Use that document **as the only source of truth**.

Do NOT guess.
Do NOT simplify.
Do NOT rename fields.
Do NOT add new fields unless explicitly required by schema consistency.

---

# ----------------------------------------------------------

# 🧠 **GLOBAL RULES**

# ----------------------------------------------------------

1. **Multi-tenancy**
   Every table belonging to a tenant must include:

   ```
   tenantId   String
   ```

2. **Super Admin tables DO NOT have tenantId**
   Examples:

   * Tenant
   * GlobalConfig
   * GlobalCategoryTemplate
   * Permission
   * Role (global roles only if defined)

   Notes:

   * `User` always has `tenantId` (required). Super Admin users are stored under the SYSTEM tenant in the DB.
   * Super Admins are treated as tenant-less in API responses/JWT (`tenantId: null`) unless explicitly impersonating.

3. **Use Prisma naming conventions:**

   * camelCase fields
   * PascalCase model names
   * Singular model names

4. **Relations MUST follow ERD:**
   Use 1:1, 1:n, n:m exactly as described.

5. **Use enums where appropriate:**

   * purchaseOrderType
   * containerStatus
   * unitType
   * movementType
   * repackUnitStatus
   * sortingStatus
   * gradeSessionStatus

6. **Generate ALL models listed in the architecture.**
   This includes:

   * Procurement
   * Sorting Stage 1
   * Sorting Stage 2
   * Repack
   * Inventory
   * RBAC
   * Warehouse
   * Waste tracking
   * QR codes
   * Reports (view tables optional)

7. **Every model must include timestamps:**

   ```
   createdAt DateTime @default(now())
   updatedAt DateTime @updatedAt
   ```

8. **Use Decimal for weights and costs:**

   ```
   weightKg Decimal @db.Decimal(10, 2)
   totalCost Decimal @db.Decimal(12, 2)
   ```

9. **Every ID must be String @id @default(cuid()).**

---

# ----------------------------------------------------------

# 🟦 **GENERATE THE FOLLOWING MODELS EXACTLY**

# ----------------------------------------------------------

You MUST generate the models shown in this list with exact fields defined below.

---

# 1. 🌍 SUPER ADMIN DOMAIN

## **Tenant**

* id
* name
* companyCode
* currency
* locale
* status
* createdAt
* updatedAt
  (Relations: users, configs, categories, grades, warehouses)

---

## **GlobalConfig**

* id
* key
* valueJson

---

## **GlobalCategoryTemplate**

* id
* categoryName
* defaultWeightUnit
* defaultSortPriority

---

# 2. 👥 RBAC DOMAIN

## **User**

* id
* tenantId
* name
* email
* passwordHash
* isActive
* createdAt
* updatedAt

Relations:

* userRoles

---

## **Role**

* id
* tenantId
* name
* description
* createdAt
* updatedAt
  (Relations: rolePermissions)

---

## **Permission**

* id
* code
* name
* group

---

## **RolePermission**

(N:M junction)

```
roleId
permissionId
```

## **UserRole**

(N:M junction)

```
userId
roleId
```

---

# 3. ⚙️ CONFIG DOMAIN

## **Category**

* id
* tenantId
* name
* sortOrder
* isActive

---

## **Grade**

* id
* tenantId
* name
* description
* rank
* isActive

---

## **Warehouse**

* id
* tenantId
* name
* code
* location

---

# 4. 📦 PROCUREMENT DOMAIN

## **PurchaseOrder**

* id
* tenantId
* vendorId?
* poNumber
* poType (enum: CONTAINER, LOOSE_BALE)
* currency
* totalCost
* status (OPEN, RECEIVED, CLOSED)

---

## **Container**

* id
* purchaseOrderId
* containerNumber
* referenceNumber
* containerType
* eta
* grossWeight
* netWeight
* status

---

## **ContainerCharge**

* id
* containerId
* description
* amount
* chargeType (CIF, FREIGHT, DUTY, TAX, PORT_HANDLING, MISC)

---

## **Rag**

* id
* tenantId
* containerId
* ragCode
* weightKg
* allocatedCost

---

## **IncomingBale** (local purchase)

* id
* tenantId
* containerId?
* vendorId?
* baleCode
* categoryGuess
* weightKg
* cost

---

# 5. 🟩 SORTING STAGE 1 — CATEGORY SORTING

## **SortSession**

* id
* tenantId
* ragId?
* incomingBaleId?
* workerId
* supervisorId
* startTime
* endTime?
* totalInputWeight
* totalOutputWeight
* wasteWeight
* status (OPEN, CLOSED)

---

## **SortCategoryBucket**

* id
* sortSessionId
* categoryId
* outputWeightKg
* outputCount

---

## **CategoryOutput**

A result of SortCategoryBucket

```
id
tenantId
sortCategoryBucketId
categoryId
weightKg
count
allocatedCost
```

---

# 6. 🟨 SORTING STAGE 2 — GRADING

## **GradeSession**

* id
* tenantId
* categoryOutputId
* workerId
* supervisorId
* startTime
* endTime?
* status

---

## **GradeBucket**

* id
* gradeSessionId
* gradeId
* outputWeightKg
* outputCount

---

## **GradeOutput**

```
id
tenantId
gradeBucketId
gradeId
weightKg
count
allocatedCost
```

---

# 7. 📦 REPACK / BUNDLING

## **RepackSession**

* id
* tenantId
* workerId
* supervisorId
* startTime
* endTime?
* status

---

## **RepackUnit**

* id
* repackSessionId
* tenantId
* categoryId?
* gradeId?
* unitCode
* unitType (KG_BALE, PCS_PACK, MIXED_BALE)
* weightKg
* pcsCount
* totalCost
* status (READY, SOLD, RESERVED)

---

## **RepackItem**

* id
* repackUnitId
* sourceType (CATEGORY_OUTPUT, GRADE_OUTPUT)
* sourceId
* weightKg
* pcsCount

---

## **QRLabel**

* id
* repackUnitId
* qrCode
* generatedAt

---

# 8. 📦 INVENTORY DOMAIN

## **InventoryItem**

* id
* tenantId
* repackUnitId
* categoryId
* gradeId
* weightKg
* pcsCount
* avgCost
* warehouseId
* status (AVAILABLE, RESERVED, SOLD)

---

## **StockMovement**

* id
* inventoryItemId
* movementType (INTAKE, ADJUSTMENT, SALE, EXPORT)
* quantityKg
* quantityPcs
* referenceId
* metadataJson

---

# ----------------------------------------------------------

# 🧩 ENUM LIST (REQUIRED)

# ----------------------------------------------------------

Generate these enums:

```
enum PurchaseOrderType { CONTAINER LOOSE_BALE }
enum Status { OPEN RECEIVED CLOSED }
enum ContainerStatus { IN_TRANSIT ARRIVED CLEARED CLOSED }
enum ChargeType { CIF FREIGHT DUTY TAX PORT_HANDLING MISC }
enum SortStatus { OPEN CLOSED }
enum GradeStatus { OPEN CLOSED }
enum UnitType { KG_BALE PCS_PACK MIXED_BALE }
enum RepackStatus { READY SOLD RESERVED }
enum MovementType { INTAKE ADJUSTMENT SALE EXPORT }
```

---

# ----------------------------------------------------------

# 🔥 **FINAL INSTRUCTIONS**

# ----------------------------------------------------------

➡️ Generate the **entire Prisma schema**, including:

* All models
* All relations
* All enums
* Referential actions (`onDelete`, `onUpdate`)
* Indexes (create where necessary: `tenantId`, foreign keys, unitCode uniqueness)

➡️ After generating the schema, also generate:

* The initial migration command
* Optional: seed script skeleton

➡️ DO NOT output anything unrelated.
➡️ Output **only**: `schema.prisma` + migration instructions.