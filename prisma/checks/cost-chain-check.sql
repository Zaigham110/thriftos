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
)
SELECT 'container landed cost' AS stage, "tenantId", ref, expected, stored FROM landed WHERE stored <> expected
UNION ALL SELECT 'lots vs container', "tenantId", ref, expected, stored FROM lots WHERE stored <> expected
UNION ALL SELECT 'category outputs vs lot', "tenantId", ref, expected, stored FROM categories WHERE stored <> expected
UNION ALL SELECT 'grade outputs vs category output', "tenantId", ref, expected, stored FROM grades WHERE stored <> expected
UNION ALL SELECT 'bale vs its inputs', "tenantId", ref, expected, stored FROM bales WHERE stored <> expected
UNION ALL SELECT 'used-up output vs its bale inputs', "tenantId", ref, expected, stored FROM used_up WHERE stored <> expected
ORDER BY 1, 2, 3;
