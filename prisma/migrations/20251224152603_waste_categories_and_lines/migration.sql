-- CreateEnum
CREATE TYPE "WasteUnitType" AS ENUM ('KG', 'PCS');

-- CreateEnum
CREATE TYPE "WasteStage" AS ENUM ('STAGE_1', 'STAGE_2');

-- AlterTable
ALTER TABLE "GradeOutput" ALTER COLUMN "remainingAmount" DROP DEFAULT,
ALTER COLUMN "totalAmount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RepackUnit" ALTER COLUMN "targetAmount" DROP DEFAULT;

-- CreateTable
CREATE TABLE "WasteCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" "WasteUnitType" NOT NULL,
    "defaultResalePrice" DECIMAL(12,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteLineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stage" "WasteStage" NOT NULL,
    "wasteCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "unitType" "WasteUnitType" NOT NULL,
    "estimatedValue" DECIMAL(12,4) NOT NULL,
    "sortSessionId" TEXT,
    "gradeSessionId" TEXT,
    "containerId" TEXT,
    "ragId" TEXT,
    "categoryOutputId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WasteCategory_tenantId_idx" ON "WasteCategory"("tenantId");

-- CreateIndex
CREATE INDEX "WasteCategory_tenantId_isActive_idx" ON "WasteCategory"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "WasteCategory_unitType_idx" ON "WasteCategory"("unitType");

-- CreateIndex
CREATE UNIQUE INDEX "WasteCategory_tenantId_name_key" ON "WasteCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "WasteLineItem_tenantId_idx" ON "WasteLineItem"("tenantId");

-- CreateIndex
CREATE INDEX "WasteLineItem_tenantId_stage_idx" ON "WasteLineItem"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "WasteLineItem_wasteCategoryId_idx" ON "WasteLineItem"("wasteCategoryId");

-- CreateIndex
CREATE INDEX "WasteLineItem_sortSessionId_idx" ON "WasteLineItem"("sortSessionId");

-- CreateIndex
CREATE INDEX "WasteLineItem_gradeSessionId_idx" ON "WasteLineItem"("gradeSessionId");

-- CreateIndex
CREATE INDEX "WasteLineItem_ragId_idx" ON "WasteLineItem"("ragId");

-- CreateIndex
CREATE INDEX "WasteLineItem_containerId_idx" ON "WasteLineItem"("containerId");

-- CreateIndex
CREATE INDEX "WasteLineItem_categoryOutputId_idx" ON "WasteLineItem"("categoryOutputId");

-- AddForeignKey
ALTER TABLE "WasteCategory" ADD CONSTRAINT "WasteCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_wasteCategoryId_fkey" FOREIGN KEY ("wasteCategoryId") REFERENCES "WasteCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_sortSessionId_fkey" FOREIGN KEY ("sortSessionId") REFERENCES "SortSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_gradeSessionId_fkey" FOREIGN KEY ("gradeSessionId") REFERENCES "GradeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_ragId_fkey" FOREIGN KEY ("ragId") REFERENCES "Rag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLineItem" ADD CONSTRAINT "WasteLineItem_categoryOutputId_fkey" FOREIGN KEY ("categoryOutputId") REFERENCES "CategoryOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;
