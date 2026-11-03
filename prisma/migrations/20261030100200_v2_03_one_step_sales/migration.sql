-- v2_03 One-step sales: a sale is saved complete (lines, payment mode, payment) in one request.
-- Local sales are the default. Lines are priced per kg, bale or piece. Every sale gets an
-- unguessable bill token for the public bill link. Draft sales and stock reservations go away.

-- SaleType gains LOCAL (recreated rather than ALTER TYPE ... ADD VALUE, so it can be used as the
-- default in this same migration).
ALTER TYPE "SaleType" RENAME TO "SaleType_old";
CREATE TYPE "SaleType" AS ENUM ('LOCAL', 'WHOLESALE', 'EXPORT');
ALTER TABLE "Sale" ALTER COLUMN "type" TYPE "SaleType" USING ("type"::text::"SaleType");
ALTER TABLE "Sale" ALTER COLUMN "type" SET DEFAULT 'LOCAL';
DROP TYPE "SaleType_old";

CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CREDIT', 'PARTIAL');

-- Old sales were all issued first and paid later.
ALTER TABLE "Sale"
  ADD COLUMN "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CREDIT',
  ADD COLUMN "billToken" TEXT;
ALTER TABLE "Sale" ALTER COLUMN "paymentMode" DROP DEFAULT;
-- 2 × 122 random bits from PostgreSQL's strong random source.
UPDATE "Sale" SET "billToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
ALTER TABLE "Sale" ALTER COLUMN "billToken" SET NOT NULL;
CREATE UNIQUE INDEX "Sale_billToken_key" ON "Sale"("billToken");

-- Drafts were never issued: release their stock, drop their lines and cancel them.
UPDATE "InventoryItem" i SET "status" = 'AVAILABLE'
FROM "InventoryReservation" r JOIN "Sale" s ON s.id = r."saleId"
WHERE r."inventoryItemId" = i.id AND s.status = 'DRAFT' AND i."usedQuantity" < i.quantity;
INSERT INTO "StockMovement" ("id", "inventoryItemId", "movementType", "quantityKg", "quantityPcs", "referenceId", "metadataJson", "createdAt", "updatedAt")
SELECT 'mig_rel_' || r.id, r."inventoryItemId", 'RELEASE', 0, 0, r."saleId", jsonb_build_object('reason', 'draft_sale_cancelled_by_v2_03'), now(), now()
FROM "InventoryReservation" r JOIN "Sale" s ON s.id = r."saleId"
WHERE s.status = 'DRAFT';
DELETE FROM "SaleLine" l USING "Sale" s WHERE s.id = l."saleId" AND s.status = 'DRAFT';
UPDATE "Sale" SET "status" = 'CANCELLED', "totalAmount" = 0, "totalCost" = 0, "totalProfit" = 0 WHERE "status" = 'DRAFT';
-- Anything else still marked reserved has nothing holding it.
UPDATE "InventoryItem" SET "status" = 'AVAILABLE' WHERE "status" = 'RESERVED' AND "usedQuantity" < quantity;

DROP TABLE "InventoryReservation";

-- Sale lines: the unit the price is per. Old lines sold whole bales by weight (kg) or by pieces.
ALTER TABLE "SaleLine" ADD COLUMN "unit" "StockUnit";
UPDATE "SaleLine" SET "unit" = CASE WHEN "measurementType" = 'QUANTITY' THEN 'PIECE'::"StockUnit" ELSE 'KG'::"StockUnit" END;
ALTER TABLE "SaleLine" ALTER COLUMN "unit" SET NOT NULL;
ALTER TABLE "SaleLine" DROP COLUMN "measurementType";
ALTER TABLE "SaleLine" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,2);
