-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "priceGroup" TEXT;

-- CreateTable
CREATE TABLE "PriceListEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "gradeId" TEXT,
    "unit" "StockUnit" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListEntry_tenantId_group_idx" ON "PriceListEntry"("tenantId", "group");

