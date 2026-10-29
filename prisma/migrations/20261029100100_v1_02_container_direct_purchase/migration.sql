-- v1: containers can be bought directly from a supplier (purchase order optional), with the
-- purchase price as a field instead of a CIF charge. Landed cost is stored on the container.


ALTER TYPE "ChargeType" ADD VALUE 'CLEARING';
ALTER TYPE "ChargeType" ADD VALUE 'TRANSPORT';
ALTER TYPE "ChargeType" ADD VALUE 'LABOUR';

-- DropForeignKey
ALTER TABLE "Container" DROP CONSTRAINT "Container_purchaseOrderId_fkey";

-- AlterTable
ALTER TABLE "Container" ADD COLUMN     "landedCostPKR" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "purchaseCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseCurrency" TEXT NOT NULL DEFAULT 'PKR',
ADD COLUMN     "vendorId" TEXT,
ALTER COLUMN "purchaseOrderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "originCountry" TEXT,
ALTER COLUMN "defaultCurrency" SET DEFAULT 'PKR';

-- CreateIndex
CREATE INDEX "Container_vendorId_idx" ON "Container"("vendorId");

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: supplier and origin from the purchase order / supplier.
UPDATE "Container" c
SET "vendorId" = po."vendorId"
FROM "PurchaseOrder" po
WHERE c."purchaseOrderId" = po.id AND c."vendorId" IS NULL;

UPDATE "Vendor" SET "originCountry" = "country" WHERE "originCountry" IS NULL AND "country" IS NOT NULL;

UPDATE "Container" c
SET "originCountry" = v."originCountry"
FROM "Vendor" v
WHERE c."vendorId" = v.id AND c."originCountry" IS NULL;

-- Data: CIF charges become the purchase cost. Existing containers stay in PKR terms
-- (purchaseCurrency default 'PKR'), so fxRate is not applied and every total is unchanged.
UPDATE "Container" c
SET "purchaseCost" = cif.total
FROM (
  SELECT "containerId", SUM(amount) AS total
  FROM "ContainerCharge"
  WHERE "chargeType" = 'CIF'
  GROUP BY "containerId"
) cif
WHERE c.id = cif."containerId";

DELETE FROM "ContainerCharge" WHERE "chargeType" = 'CIF';

UPDATE "Container" c
SET "landedCostPKR" = c."purchaseCost" + COALESCE(
  (SELECT SUM(cc.amount) FROM "ContainerCharge" cc WHERE cc."containerId" = c.id), 0);
