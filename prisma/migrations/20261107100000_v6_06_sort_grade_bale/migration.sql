-- v2 6.6: sort, grade and bale in one step; kat goes to stock to sell.
ALTER TABLE "Category" ADD COLUMN "baleWeightKg" DECIMAL(10,2);

ALTER TABLE "CategoryOutput" ADD COLUMN "gradeId" TEXT;
ALTER TABLE "CategoryOutput" ADD COLUMN "entryBales" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "CategoryOutput_gradeId_idx" ON "CategoryOutput"("gradeId");
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "StockSource" ADD VALUE 'KAT';

-- Kat in stock has no bale of its own; it comes from its lot. (Compared as text: the new enum value cannot be used
-- in the transaction that adds it.)
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_processed_has_origin";
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_processed_has_origin" CHECK (
    "source"::text = 'PURCHASED' OR "repackUnitId" IS NOT NULL OR "parentItemId" IS NOT NULL OR ("source"::text = 'KAT' AND "ragId" IS NOT NULL)
  );
