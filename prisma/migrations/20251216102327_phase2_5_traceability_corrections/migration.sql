-- CreateEnum
CREATE TYPE "PurchaseOrderType" AS ENUM ('CONTAINER', 'LOOSE_BALE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('OPEN', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('IN_TRANSIT', 'ARRIVED', 'CLEARED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('CIF', 'FREIGHT', 'DUTY', 'TAX', 'PORT_HANDLING', 'MISC');

-- CreateEnum
CREATE TYPE "SortStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('KG_BALE', 'PCS_PACK', 'MIXED_BALE');

-- CreateEnum
CREATE TYPE "RepackStatus" AS ENUM ('READY', 'SOLD', 'RESERVED');

-- CreateEnum
CREATE TYPE "RepackSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INTAKE', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'SALE', 'EXPORT');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('CATEGORY_OUTPUT', 'GRADE_OUTPUT');

-- CreateEnum
CREATE TYPE "RagStatus" AS ENUM ('NOT_STARTED', 'IN_SORTING', 'SORTED');

-- CreateEnum
CREATE TYPE "RagSourceType" AS ENUM ('CONTAINER', 'LOOSE_BALE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalCategoryTemplate" (
    "id" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "defaultWeightUnit" TEXT NOT NULL DEFAULT 'KG',
    "defaultSortPriority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalCategoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contactInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT,
    "poNumber" TEXT NOT NULL,
    "poType" "PurchaseOrderType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalCost" DECIMAL(12,2) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "containerType" TEXT,
    "eta" TIMESTAMP(3),
    "grossWeight" DECIMAL(10,2) NOT NULL,
    "netWeight" DECIMAL(10,2) NOT NULL,
    "status" "ContainerStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerCharge" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "chargeType" "ChargeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContainerCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "containerId" TEXT,
    "ragCode" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "allocatedCost" DECIMAL(12,2) NOT NULL,
    "sourceType" "RagSourceType" NOT NULL DEFAULT 'CONTAINER',
    "status" "RagStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingBale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "containerId" TEXT,
    "vendorId" TEXT,
    "baleCode" TEXT NOT NULL,
    "categoryGuess" TEXT,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingBale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ragId" TEXT NOT NULL,
    "incomingBaleId" TEXT,
    "workerId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "totalInputWeight" DECIMAL(10,2) NOT NULL,
    "totalOutputWeight" DECIMAL(10,2) NOT NULL,
    "wasteWeight" DECIMAL(10,2) NOT NULL,
    "status" "SortStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SortSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortCategoryBucket" (
    "id" TEXT NOT NULL,
    "sortSessionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "outputWeightKg" DECIMAL(10,2) NOT NULL,
    "outputCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SortCategoryBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryOutput" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sortCategoryBucketId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "allocatedCost" DECIMAL(12,2) NOT NULL,
    "containerId" TEXT,
    "ragId" TEXT NOT NULL,
    "sortSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortingWaste" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sortSessionId" TEXT NOT NULL,
    "containerId" TEXT,
    "ragId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SortingWaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryOutputId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "GradeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBucket" (
    "id" TEXT NOT NULL,
    "gradeSessionId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "outputWeightKg" DECIMAL(10,2) NOT NULL,
    "outputCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeOutput" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gradeBucketId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "allocatedCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepackSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "RepackSessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepackUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "repackSessionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "gradeId" TEXT,
    "unitCode" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pcsCount" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "status" "RepackStatus" NOT NULL DEFAULT 'READY',
    "containerId" TEXT,
    "ragId" TEXT,
    "sortSessionId" TEXT,
    "gradeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepackUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepackItem" (
    "id" TEXT NOT NULL,
    "repackUnitId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pcsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRLabel" (
    "id" TEXT NOT NULL,
    "repackUnitId" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "repackUnitId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pcsCount" INTEGER NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(12,2) NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "containerId" TEXT,
    "ragId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantityKg" DECIMAL(10,2) NOT NULL,
    "quantityPcs" INTEGER NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_companyCode_key" ON "Tenant"("companyCode");

-- CreateIndex
CREATE INDEX "Tenant_companyCode_idx" ON "Tenant"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalConfig_key_key" ON "GlobalConfig"("key");

-- CreateIndex
CREATE INDEX "GlobalConfig_key_idx" ON "GlobalConfig"("key");

-- CreateIndex
CREATE INDEX "GlobalCategoryTemplate_categoryName_idx" ON "GlobalCategoryTemplate"("categoryName");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_code_idx" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_group_idx" ON "Permission"("group");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Grade_tenantId_idx" ON "Grade"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_tenantId_name_key" ON "Grade"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_tenantId_name_key" ON "Vendor"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");

-- CreateIndex
CREATE INDEX "Container_purchaseOrderId_idx" ON "Container"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Container_containerNumber_idx" ON "Container"("containerNumber");

-- CreateIndex
CREATE INDEX "Container_status_idx" ON "Container"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Container_purchaseOrderId_containerNumber_key" ON "Container"("purchaseOrderId", "containerNumber");

-- CreateIndex
CREATE INDEX "ContainerCharge_containerId_idx" ON "ContainerCharge"("containerId");

-- CreateIndex
CREATE INDEX "ContainerCharge_chargeType_idx" ON "ContainerCharge"("chargeType");

-- CreateIndex
CREATE INDEX "Rag_tenantId_idx" ON "Rag"("tenantId");

-- CreateIndex
CREATE INDEX "Rag_containerId_idx" ON "Rag"("containerId");

-- CreateIndex
CREATE INDEX "Rag_ragCode_idx" ON "Rag"("ragCode");

-- CreateIndex
CREATE INDEX "Rag_status_idx" ON "Rag"("status");

-- CreateIndex
CREATE INDEX "Rag_sourceType_idx" ON "Rag"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Rag_tenantId_ragCode_key" ON "Rag"("tenantId", "ragCode");

-- CreateIndex
CREATE INDEX "IncomingBale_tenantId_idx" ON "IncomingBale"("tenantId");

-- CreateIndex
CREATE INDEX "IncomingBale_containerId_idx" ON "IncomingBale"("containerId");

-- CreateIndex
CREATE INDEX "IncomingBale_vendorId_idx" ON "IncomingBale"("vendorId");

-- CreateIndex
CREATE INDEX "IncomingBale_baleCode_idx" ON "IncomingBale"("baleCode");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingBale_tenantId_baleCode_key" ON "IncomingBale"("tenantId", "baleCode");

-- CreateIndex
CREATE UNIQUE INDEX "SortSession_ragId_key" ON "SortSession"("ragId");

-- CreateIndex
CREATE INDEX "SortSession_tenantId_idx" ON "SortSession"("tenantId");

-- CreateIndex
CREATE INDEX "SortSession_ragId_idx" ON "SortSession"("ragId");

-- CreateIndex
CREATE INDEX "SortSession_incomingBaleId_idx" ON "SortSession"("incomingBaleId");

-- CreateIndex
CREATE INDEX "SortSession_workerId_idx" ON "SortSession"("workerId");

-- CreateIndex
CREATE INDEX "SortSession_supervisorId_idx" ON "SortSession"("supervisorId");

-- CreateIndex
CREATE INDEX "SortSession_status_idx" ON "SortSession"("status");

-- CreateIndex
CREATE INDEX "SortCategoryBucket_sortSessionId_idx" ON "SortCategoryBucket"("sortSessionId");

-- CreateIndex
CREATE INDEX "SortCategoryBucket_categoryId_idx" ON "SortCategoryBucket"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SortCategoryBucket_sortSessionId_categoryId_key" ON "SortCategoryBucket"("sortSessionId", "categoryId");

-- CreateIndex
CREATE INDEX "CategoryOutput_tenantId_idx" ON "CategoryOutput"("tenantId");

-- CreateIndex
CREATE INDEX "CategoryOutput_sortCategoryBucketId_idx" ON "CategoryOutput"("sortCategoryBucketId");

-- CreateIndex
CREATE INDEX "CategoryOutput_categoryId_idx" ON "CategoryOutput"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryOutput_ragId_idx" ON "CategoryOutput"("ragId");

-- CreateIndex
CREATE INDEX "CategoryOutput_containerId_idx" ON "CategoryOutput"("containerId");

-- CreateIndex
CREATE INDEX "CategoryOutput_sortSessionId_idx" ON "CategoryOutput"("sortSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SortingWaste_sortSessionId_key" ON "SortingWaste"("sortSessionId");

-- CreateIndex
CREATE INDEX "SortingWaste_tenantId_idx" ON "SortingWaste"("tenantId");

-- CreateIndex
CREATE INDEX "SortingWaste_sortSessionId_idx" ON "SortingWaste"("sortSessionId");

-- CreateIndex
CREATE INDEX "SortingWaste_ragId_idx" ON "SortingWaste"("ragId");

-- CreateIndex
CREATE INDEX "SortingWaste_containerId_idx" ON "SortingWaste"("containerId");

-- CreateIndex
CREATE INDEX "GradeSession_tenantId_idx" ON "GradeSession"("tenantId");

-- CreateIndex
CREATE INDEX "GradeSession_categoryOutputId_idx" ON "GradeSession"("categoryOutputId");

-- CreateIndex
CREATE INDEX "GradeSession_workerId_idx" ON "GradeSession"("workerId");

-- CreateIndex
CREATE INDEX "GradeSession_supervisorId_idx" ON "GradeSession"("supervisorId");

-- CreateIndex
CREATE INDEX "GradeSession_status_idx" ON "GradeSession"("status");

-- CreateIndex
CREATE INDEX "GradeBucket_gradeSessionId_idx" ON "GradeBucket"("gradeSessionId");

-- CreateIndex
CREATE INDEX "GradeBucket_gradeId_idx" ON "GradeBucket"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBucket_gradeSessionId_gradeId_key" ON "GradeBucket"("gradeSessionId", "gradeId");

-- CreateIndex
CREATE INDEX "GradeOutput_tenantId_idx" ON "GradeOutput"("tenantId");

-- CreateIndex
CREATE INDEX "GradeOutput_gradeBucketId_idx" ON "GradeOutput"("gradeBucketId");

-- CreateIndex
CREATE INDEX "GradeOutput_gradeId_idx" ON "GradeOutput"("gradeId");

-- CreateIndex
CREATE INDEX "RepackSession_tenantId_idx" ON "RepackSession"("tenantId");

-- CreateIndex
CREATE INDEX "RepackSession_workerId_idx" ON "RepackSession"("workerId");

-- CreateIndex
CREATE INDEX "RepackSession_supervisorId_idx" ON "RepackSession"("supervisorId");

-- CreateIndex
CREATE INDEX "RepackSession_status_idx" ON "RepackSession"("status");

-- CreateIndex
CREATE INDEX "RepackUnit_tenantId_idx" ON "RepackUnit"("tenantId");

-- CreateIndex
CREATE INDEX "RepackUnit_repackSessionId_idx" ON "RepackUnit"("repackSessionId");

-- CreateIndex
CREATE INDEX "RepackUnit_categoryId_idx" ON "RepackUnit"("categoryId");

-- CreateIndex
CREATE INDEX "RepackUnit_gradeId_idx" ON "RepackUnit"("gradeId");

-- CreateIndex
CREATE INDEX "RepackUnit_unitCode_idx" ON "RepackUnit"("unitCode");

-- CreateIndex
CREATE INDEX "RepackUnit_status_idx" ON "RepackUnit"("status");

-- CreateIndex
CREATE INDEX "RepackUnit_ragId_idx" ON "RepackUnit"("ragId");

-- CreateIndex
CREATE INDEX "RepackUnit_containerId_idx" ON "RepackUnit"("containerId");

-- CreateIndex
CREATE INDEX "RepackUnit_sortSessionId_idx" ON "RepackUnit"("sortSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RepackUnit_tenantId_unitCode_key" ON "RepackUnit"("tenantId", "unitCode");

-- CreateIndex
CREATE INDEX "RepackItem_repackUnitId_idx" ON "RepackItem"("repackUnitId");

-- CreateIndex
CREATE INDEX "RepackItem_sourceType_idx" ON "RepackItem"("sourceType");

-- CreateIndex
CREATE INDEX "RepackItem_sourceId_idx" ON "RepackItem"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "QRLabel_repackUnitId_key" ON "QRLabel"("repackUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "QRLabel_qrCode_key" ON "QRLabel"("qrCode");

-- CreateIndex
CREATE INDEX "QRLabel_qrCode_idx" ON "QRLabel"("qrCode");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryItem_repackUnitId_idx" ON "InventoryItem"("repackUnitId");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryItem_gradeId_idx" ON "InventoryItem"("gradeId");

-- CreateIndex
CREATE INDEX "InventoryItem_warehouseId_idx" ON "InventoryItem"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryItem_ragId_idx" ON "InventoryItem"("ragId");

-- CreateIndex
CREATE INDEX "InventoryItem_containerId_idx" ON "InventoryItem"("containerId");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_idx" ON "StockMovement"("inventoryItemId");

-- CreateIndex
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerCharge" ADD CONSTRAINT "ContainerCharge_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rag" ADD CONSTRAINT "Rag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rag" ADD CONSTRAINT "Rag_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortSession" ADD CONSTRAINT "SortSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortSession" ADD CONSTRAINT "SortSession_ragId_fkey" FOREIGN KEY ("ragId") REFERENCES "Rag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortSession" ADD CONSTRAINT "SortSession_incomingBaleId_fkey" FOREIGN KEY ("incomingBaleId") REFERENCES "IncomingBale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortSession" ADD CONSTRAINT "SortSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortSession" ADD CONSTRAINT "SortSession_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortCategoryBucket" ADD CONSTRAINT "SortCategoryBucket_sortSessionId_fkey" FOREIGN KEY ("sortSessionId") REFERENCES "SortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortCategoryBucket" ADD CONSTRAINT "SortCategoryBucket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_sortCategoryBucketId_fkey" FOREIGN KEY ("sortCategoryBucketId") REFERENCES "SortCategoryBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_ragId_fkey" FOREIGN KEY ("ragId") REFERENCES "Rag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingWaste" ADD CONSTRAINT "SortingWaste_sortSessionId_fkey" FOREIGN KEY ("sortSessionId") REFERENCES "SortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingWaste" ADD CONSTRAINT "SortingWaste_ragId_fkey" FOREIGN KEY ("ragId") REFERENCES "Rag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortingWaste" ADD CONSTRAINT "SortingWaste_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSession" ADD CONSTRAINT "GradeSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSession" ADD CONSTRAINT "GradeSession_categoryOutputId_fkey" FOREIGN KEY ("categoryOutputId") REFERENCES "CategoryOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSession" ADD CONSTRAINT "GradeSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSession" ADD CONSTRAINT "GradeSession_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBucket" ADD CONSTRAINT "GradeBucket_gradeSessionId_fkey" FOREIGN KEY ("gradeSessionId") REFERENCES "GradeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBucket" ADD CONSTRAINT "GradeBucket_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeOutput" ADD CONSTRAINT "GradeOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeOutput" ADD CONSTRAINT "GradeOutput_gradeBucketId_fkey" FOREIGN KEY ("gradeBucketId") REFERENCES "GradeBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeOutput" ADD CONSTRAINT "GradeOutput_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackSession" ADD CONSTRAINT "RepackSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackSession" ADD CONSTRAINT "RepackSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackSession" ADD CONSTRAINT "RepackSession_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackUnit" ADD CONSTRAINT "RepackUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackUnit" ADD CONSTRAINT "RepackUnit_repackSessionId_fkey" FOREIGN KEY ("repackSessionId") REFERENCES "RepackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackUnit" ADD CONSTRAINT "RepackUnit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackUnit" ADD CONSTRAINT "RepackUnit_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackItem" ADD CONSTRAINT "RepackItem_repackUnitId_fkey" FOREIGN KEY ("repackUnitId") REFERENCES "RepackUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRLabel" ADD CONSTRAINT "QRLabel_repackUnitId_fkey" FOREIGN KEY ("repackUnitId") REFERENCES "RepackUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_repackUnitId_fkey" FOREIGN KEY ("repackUnitId") REFERENCES "RepackUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
