-- ThriftOS cost-chain check. Returns one row per place where costs do NOT add up to the paisa.
-- No rows = every stage reconciles. Run after applying migrations + `costing:recompute`:
--   psql "$DATABASE_URL" -f prisma/checks/cost-chain-check.sql
WITH
landed AS (
  SELECT c.id, c."tenantId", c."containerNumber" AS ref, c."landedCostPKR" AS stored,
         CASE WHEN c."purchaseCurrency" = 'PKR' THEN c."purchaseCost" ELSE ROUND(c."purchaseCost" * c."fxRate", 2) END
           + COALESCE((SELECT SUM(amount) FROM "ContainerCharge" ch WHERE ch."containerId" = c.id), 0) AS expected
  FROM "Container" c
),
lots AS (
  SELECT c.id, c."tenantId", c."containerNumber" AS ref, c."landedCostPKR" AS expected, SUM(r."allocatedCost") AS stored
  FROM "Container" c JOIN "Rag" r ON r."containerId" = c.id
  GROUP BY c.id
),
categories AS (
  SELECT r.id, r."tenantId", r."ragCode" AS ref, r."allocatedCost" AS expected, SUM(co."allocatedCost") AS stored
  FROM "Rag" r JOIN "CategoryOutput" co ON co."ragId" = r.id
  GROUP BY r.id
),
grades AS (
  SELECT co.id, co."tenantId", co.id AS ref, co."allocatedCost" AS expected, SUM(go."allocatedCost") AS stored
  FROM "CategoryOutput" co
  JOIN "GradeSession" gs ON gs."categoryOutputId" = co.id AND gs.status = 'CLOSED'
  JOIN "GradeBucket" gb ON gb."gradeSessionId" = gs.id
  JOIN "GradeOutput" go ON go."gradeBucketId" = gb.id
  GROUP BY co.id
),
bales AS (
  SELECT u.id, u."tenantId", u."unitCode" AS ref, u."totalCost" AS stored, SUM(a."allocatedCost") AS expected
  FROM "RepackUnit" u JOIN "RepackInputAllocation" a ON a."repackUnitId" = u.id
  GROUP BY u.id
),
used_up AS (
  SELECT go.id, go."tenantId", go.id AS ref, go."allocatedCost" AS expected, SUM(a."allocatedCost") AS stored
  FROM "GradeOutput" go JOIN "RepackInputAllocation" a ON a."gradingOutputId" = go.id
  WHERE go."usedAmount" = go."totalAmount"
  GROUP BY go.id
  UNION ALL
  SELECT co.id, co."tenantId", co.id, co."allocatedCost", SUM(a."allocatedCost")
  FROM "CategoryOutput" co JOIN "RepackInputAllocation" a ON a."categoryOutputId" = co.id
  WHERE co."usedKg" = co."weightKg"
  GROUP BY co.id
),
stock_items AS (
  SELECT i.id, i."tenantId", u."unitCode" AS ref, u."totalCost" AS expected, i."totalCost" AS stored
  FROM "InventoryItem" i JOIN "RepackUnit" u ON u.id = i."repackUnitId"
),
opened AS (
  -- A fully opened bale's cost is in its pieces.
  SELECT b.id, b."tenantId", COALESCE(b.name, b.id) AS ref, b."totalCost" AS expected, SUM(p."totalCost") AS stored
  FROM "InventoryItem" b JOIN "InventoryItem" p ON p."parentItemId" = b.id
  WHERE b."usedQuantity" = b.quantity AND NOT EXISTS (SELECT 1 FROM "SaleLine" l WHERE l."inventoryItemId" = b.id)
  GROUP BY b.id
),
bought_used_up AS (
  -- Bought stock is never re-costed, so once used up its sales and opened pieces carry its cost exactly.
  SELECT i.id, i."tenantId", COALESCE(i.name, i.id) AS ref, i."totalCost" AS expected,
         COALESCE((SELECT SUM(l."lineCost") FROM "SaleLine" l JOIN "Sale" s ON s.id = l."saleId"
                   WHERE l."inventoryItemId" = i.id AND s.status <> 'CANCELLED'), 0)
       + COALESCE((SELECT SUM(p."totalCost") FROM "InventoryItem" p WHERE p."parentItemId" = i.id), 0) AS stored
  FROM "InventoryItem" i
  WHERE i.source = 'PURCHASED' AND i."usedQuantity" = i.quantity
)
SELECT 'container landed cost' AS stage, "tenantId", ref, expected, stored FROM landed WHERE stored <> expected
UNION ALL SELECT 'lots vs container', "tenantId", ref, expected, stored FROM lots WHERE stored <> expected
UNION ALL SELECT 'category outputs vs lot', "tenantId", ref, expected, stored FROM categories WHERE stored <> expected
UNION ALL SELECT 'grade outputs vs category output', "tenantId", ref, expected, stored FROM grades WHERE stored <> expected
UNION ALL SELECT 'bale vs its inputs', "tenantId", ref, expected, stored FROM bales WHERE stored <> expected
UNION ALL SELECT 'used-up output vs its bale inputs', "tenantId", ref, expected, stored FROM used_up WHERE stored <> expected
UNION ALL SELECT 'stock item vs its bale', "tenantId", ref, expected, stored FROM stock_items WHERE stored <> expected
UNION ALL SELECT 'opened bale vs its pieces', "tenantId", ref, expected, stored FROM opened WHERE stored <> expected
UNION ALL SELECT 'used-up bought stock vs its sales and pieces', "tenantId", ref, expected, stored FROM bought_used_up WHERE stored <> expected
ORDER BY 1, 2, 3;
