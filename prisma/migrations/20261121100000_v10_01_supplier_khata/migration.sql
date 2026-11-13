-- Supplier khata (owner, 2026-11-13: "money owed to suppliers is not tracked"): what the business owes each
-- supplier = an opening balance + the price of what was bought on the khata − payments made.
-- Everything bought before this counts as paid (onKhata defaults to false), by the owner's choice.
ALTER TABLE "Vendor" ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Rag" ADD COLUMN "onKhata" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Container" ADD COLUMN "onKhata" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierPayment_tenantId_vendorId_idx" ON "SupplierPayment"("tenantId", "vendorId");
CREATE INDEX "SupplierPayment_tenantId_day_idx" ON "SupplierPayment"("tenantId", "day");

ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
