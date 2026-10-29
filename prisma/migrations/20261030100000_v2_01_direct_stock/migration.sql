-- v2_01 Direct stock: a stock item can be bought ready to sell (no bale, category or grade),
-- is counted in KG, BALE or PIECE, and keeps its own cost so part of it can be sold.

CREATE TYPE "StockSource" AS ENUM ('PROCESSED', 'PURCHASED');
CREATE TYPE "StockUnit" AS ENUM ('KG', 'BALE', 'PIECE');

ALTER TABLE "InventoryItem"
  ADD COLUMN "source" "StockSource" NOT NULL DEFAULT 'PROCESSED',
  ADD COLUMN "vendorId" TEXT,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "unit" "StockUnit",
  ADD COLUMN "quantity" DECIMAL(14,2),
  ADD COLUMN "usedQuantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalCost" DECIMAL(14,2),
  ADD COLUMN "unitCost" DECIMAL(14,4),
  ADD COLUMN "salePrice" DECIMAL(14,2),
  ADD COLUMN "priceTier" TEXT,
  ADD COLUMN "parentItemId" TEXT,
  ALTER COLUMN "repackUnitId" DROP NOT NULL,
  ALTER COLUMN "categoryId" DROP NOT NULL,
  ALTER COLUMN "weightKg" DROP NOT NULL,
  ALTER COLUMN "weightKg" SET DATA TYPE DECIMAL(14,2),
  ALTER COLUMN "avgCost" DROP NOT NULL;

-- Every existing item is one bale made here: it costs what its bale costs, and it is used up once sold.
UPDATE "InventoryItem" i
SET "unit" = 'BALE',
    "quantity" = 1,
    "usedQuantity" = CASE WHEN i."status" = 'SOLD' THEN 1 ELSE 0 END,
    "totalCost" = u."totalCost",
    "unitCost" = u."totalCost"
FROM "RepackUnit" u
WHERE u."id" = i."repackUnitId";

ALTER TABLE "InventoryItem"
  ALTER COLUMN "unit" SET NOT NULL,
  ALTER COLUMN "quantity" SET NOT NULL,
  ALTER COLUMN "totalCost" SET NOT NULL,
  ALTER COLUMN "unitCost" SET NOT NULL;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_quantity_used_within" CHECK ("quantity" > 0 AND "usedQuantity" >= 0 AND "usedQuantity" <= "quantity"),
  ADD CONSTRAINT "InventoryItem_cost_not_negative" CHECK ("totalCost" >= 0 AND "unitCost" >= 0),
  -- Made here means made from a bale, or opened from an item that was.
  ADD CONSTRAINT "InventoryItem_processed_has_origin" CHECK ("source" = 'PURCHASED' OR "repackUnitId" IS NOT NULL OR "parentItemId" IS NOT NULL);

CREATE INDEX "InventoryItem_tenantId_source_status_idx" ON "InventoryItem"("tenantId", "source", "status");
CREATE INDEX "InventoryItem_vendorId_idx" ON "InventoryItem"("vendorId");
CREATE INDEX "InventoryItem_parentItemId_idx" ON "InventoryItem"("parentItemId");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
