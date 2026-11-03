-- v1: a lot (Rag) can be bought loose, with its own supplier, origin and purchase price.

-- AlterTable
ALTER TABLE "Rag" ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "purchaseCost" DECIMAL(14,2),
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "Rag_vendorId_idx" ON "Rag"("vendorId");

-- AddForeignKey
ALTER TABLE "Rag" ADD CONSTRAINT "Rag_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: loose lots carry their own purchase price; container lots inherit supplier and origin.
UPDATE "Rag" SET "purchaseCost" = "allocatedCost" WHERE "containerId" IS NULL;

UPDATE "Rag" r
SET "vendorId" = c."vendorId", "originCountry" = c."originCountry"
FROM "Container" c
WHERE r."containerId" = c.id;
