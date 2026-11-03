-- v1: RepackItem (repack v1) is replaced by RepackInputAllocation. Bales that were built with
-- items and have no allocations get one allocation per item, costed pro rata by kg from the
-- source output. Bales that already have allocations (repack v2/v3) are left as they are.

INSERT INTO "RepackInputAllocation" (
  "id", "tenantId", "repackUnitId", "gradingOutputId", "categoryOutputId", "containerId", "ragBaleId",
  "amountUsed", "measurementType", "allocatedCost", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  u."tenantId",
  u.id,
  CASE WHEN i."sourceType" = 'GRADE_OUTPUT' THEN go.id END,
  CASE WHEN i."sourceType" = 'CATEGORY_OUTPUT' THEN co.id END,
  COALESCE(co."containerId", gco."containerId"),
  COALESCE(co."ragId", gco."ragId"),
  i."weightKg",
  'WEIGHT',
  ROUND(
    CASE
      WHEN i."sourceType" = 'GRADE_OUTPUT' AND go."weightKg" > 0 THEN go."allocatedCost" / go."weightKg" * i."weightKg"
      WHEN i."sourceType" = 'CATEGORY_OUTPUT' AND co."weightKg" > 0 THEN co."allocatedCost" / co."weightKg" * i."weightKg"
      ELSE 0
    END, 2),
  i."createdAt",
  now()
FROM "RepackItem" i
JOIN "RepackUnit" u ON u.id = i."repackUnitId"
LEFT JOIN "GradeOutput" go ON i."sourceType" = 'GRADE_OUTPUT' AND go.id = i."sourceId"
LEFT JOIN "GradeBucket" gb ON gb.id = go."gradeBucketId"
LEFT JOIN "GradeSession" gs ON gs.id = gb."gradeSessionId"
LEFT JOIN "CategoryOutput" gco ON gco.id = gs."categoryOutputId"
LEFT JOIN "CategoryOutput" co ON i."sourceType" = 'CATEGORY_OUTPUT' AND co.id = i."sourceId"
WHERE NOT EXISTS (SELECT 1 FROM "RepackInputAllocation" a WHERE a."repackUnitId" = u.id)
  AND (go.id IS NOT NULL OR co.id IS NOT NULL);

ALTER TABLE "RepackItem" DROP CONSTRAINT "RepackItem_repackUnitId_fkey";
DROP TABLE "RepackItem";
DROP TYPE "SourceType";
