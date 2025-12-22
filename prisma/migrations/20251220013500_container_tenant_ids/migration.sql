-- Drop legacy uniqueness scoped to purchase orders
ALTER TABLE "Container" DROP CONSTRAINT IF EXISTS "Container_purchaseOrderId_containerNumber_key";

-- CreateEnum
CREATE TYPE "SequenceScope" AS ENUM ('PURCHASE_ORDER', 'CONTAINER', 'RAG', 'INCOMING_BALE');

-- AlterTable: expand container logistics metadata and introduce tenant ownership
ALTER TABLE "Container"
    ADD COLUMN "arrivedAt" TIMESTAMP(3),
    ADD COLUMN "billOfLadingNumber" TEXT,
    ADD COLUMN "clearedAt" TIMESTAMP(3),
    ADD COLUMN "etd" TIMESTAMP(3),
    ADD COLUMN "forwarder" TEXT,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "portOfDischarge" TEXT,
    ADD COLUMN "portOfLoading" TEXT,
    ADD COLUMN "releasedAt" TIMESTAMP(3),
    ADD COLUMN "shipmentReference" TEXT,
    ADD COLUMN "shippingLine" TEXT,
    ADD COLUMN "tenantId" TEXT,
    ADD COLUMN "vesselName" TEXT;

-- Backfill tenantId via purchase order relationship before enforcing NOT NULL
UPDATE "Container" c
SET "tenantId" = po."tenantId"
FROM "PurchaseOrder" po
WHERE c."purchaseOrderId" = po."id" AND c."tenantId" IS NULL;

ALTER TABLE "Container"
    ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IncomingBale" ADD COLUMN "categoryId" TEXT;

-- CreateTable
CREATE TABLE "TenantSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "SequenceScope" NOT NULL,
    "prefix" TEXT,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantSequence_tenantId_idx" ON "TenantSequence"("tenantId");
CREATE UNIQUE INDEX "TenantSequence_tenantId_scope_key" ON "TenantSequence"("tenantId", "scope");
CREATE INDEX "Container_tenantId_idx" ON "Container"("tenantId");
CREATE UNIQUE INDEX "Container_tenantId_containerNumber_key" ON "Container"("tenantId", "containerNumber");
CREATE INDEX "IncomingBale_categoryId_idx" ON "IncomingBale"("categoryId");

-- AddForeignKey
ALTER TABLE "TenantSequence" ADD CONSTRAINT "TenantSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Container" ADD CONSTRAINT "Container_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
