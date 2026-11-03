-- v1: SortingWaste duplicated stage-1 WasteLineItem. Sessions whose waste was only recorded in
-- SortingWaste get a STAGE_1 waste line (tenant's oldest waste type; v1_04 guarantees one).
-- Sessions that already have STAGE_1 waste lines are left as they are.

INSERT INTO "WasteLineItem" (
  "id", "tenantId", "stage", "wasteCategoryId", "amount", "unitType", "estimatedValue",
  "sortSessionId", "containerId", "ragId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  sw."tenantId",
  'STAGE_1',
  wc.id,
  sw."weightKg",
  wc."unitType",
  sw."weightKg" * wc."defaultResalePrice",
  sw."sortSessionId",
  sw."containerId",
  sw."ragId",
  sw."createdAt",
  now()
FROM "SortingWaste" sw
JOIN LATERAL (
  SELECT w.id, w."unitType", w."defaultResalePrice"
  FROM "WasteCategory" w
  WHERE w."tenantId" = sw."tenantId"
  ORDER BY w."isActive" DESC, (w.name = 'Waste/Katran') DESC, w."createdAt"
  LIMIT 1
) wc ON true
WHERE sw."weightKg" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "WasteLineItem" li WHERE li."sortSessionId" = sw."sortSessionId" AND li.stage = 'STAGE_1'
  );

-- DropForeignKey
ALTER TABLE "SortingWaste" DROP CONSTRAINT "SortingWaste_containerId_fkey";

-- DropForeignKey
ALTER TABLE "SortingWaste" DROP CONSTRAINT "SortingWaste_ragId_fkey";

-- DropForeignKey
ALTER TABLE "SortingWaste" DROP CONSTRAINT "SortingWaste_sortSessionId_fkey";

-- DropTable
DROP TABLE "SortingWaste";

