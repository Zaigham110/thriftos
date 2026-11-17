-- Supplier lists in another currency, stock typed by hand, exchanges and returns to a supplier.
ALTER TYPE "BaleStatus" ADD VALUE 'RETURNED_TO_SUPPLIER';
ALTER TYPE "RefundTo" ADD VALUE 'EXCHANGE';

ALTER TABLE "Shop" ADD COLUMN "supplierCurrency" TEXT,
ADD COLUMN "rateMode" TEXT NOT NULL DEFAULT 'LIVE',
ADD COLUMN "supplierReturnSeq" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Shipment" ADD COLUMN "currency" TEXT,
ADD COLUMN "exchangeRate" DECIMAL(18,6),
ADD COLUMN "goodsCostForeign" DECIMAL(14,2),
ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Bale" ADD COLUMN "costForeign" DECIMAL(14,2);

ALTER TABLE "Sale" ADD COLUMN "exchangeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "exchangeReturnId" TEXT;

ALTER TABLE "SaleReturn" ADD COLUMN "exchangeSaleId" TEXT;

CREATE TABLE "SupplierReturn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledNote" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierReturnLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "baleId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SupplierReturnLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierReturn_tenantId_code_key" ON "SupplierReturn"("tenantId", "code");
CREATE INDEX "SupplierReturn_tenantId_supplierId_idx" ON "SupplierReturn"("tenantId", "supplierId");
CREATE INDEX "SupplierReturnLine_tenantId_idx" ON "SupplierReturnLine"("tenantId");
CREATE INDEX "SupplierReturnLine_returnId_idx" ON "SupplierReturnLine"("returnId");

ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SupplierReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
