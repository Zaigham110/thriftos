-- Catch-up for columns that reached schema.prisma via `prisma db push` without a migration.
-- Every statement is guarded so it is a no-op on databases that already have them.

DO $$ BEGIN
  CREATE TYPE "VendorType" AS ENUM ('SUPPLIER', 'FREIGHT_CARRIER', 'PACKAGING_SUPPLIER', 'EQUIPMENT_VENDOR', 'SERVICE_PROVIDER', 'CUSTOMER', 'SHIPPER', 'CONSIGNEE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Container"
  ADD COLUMN IF NOT EXISTS "fxRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS "landedCostPerKg" DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS "varianceAlertStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "weighbridgeGrossWeight" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "weighbridgeNetWeight" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "weighbridgeTareWeight" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "weightVarianceKg" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "weightVariancePct" DECIMAL(5,2);

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditStatus" TEXT DEFAULT 'GOOD_STANDING',
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT DEFAULT 'PREPAID',
  ADD COLUMN IF NOT EXISTS "swiftBic" TEXT;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "billOfLadingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "containerSealNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "freightForwarder" TEXT,
  ADD COLUMN IF NOT EXISTS "portOfDischarge" TEXT,
  ADD COLUMN IF NOT EXISTS "portOfLoading" TEXT,
  ADD COLUMN IF NOT EXISTS "vesselName" TEXT;

ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultCurrency" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT DEFAULT 'NET_30',
  ADD COLUMN IF NOT EXISTS "physicalAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "remittanceAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "taxId" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorType" "VendorType" NOT NULL DEFAULT 'SUPPLIER';

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_name_key" ON "Customer"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Vendor_vendorType_idx" ON "Vendor"("vendorType");
