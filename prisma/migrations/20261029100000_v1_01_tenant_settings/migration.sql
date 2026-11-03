-- v1 tenant settings: enabledModules replaces operationalModules; one simple settings set
-- replaces the operation-mode/policy fields.

ALTER TABLE "Tenant"
  ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'ur',
  ADD COLUMN "enabledModules" TEXT[] DEFAULT ARRAY['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA']::TEXT[],
  ADD COLUMN "sortingStages" INTEGER NOT NULL DEFAULT 2,
  ALTER COLUMN "currency" SET DEFAULT 'PKR',
  ALTER COLUMN "locale" SET DEFAULT 'ur-PK';

-- Carry each tenant's module choice over to the v1 names.
-- INTAKE→RECEIVE, SORTING→SORT, REPACK/STOCK→STOCK, SALES→SELL+KHATA, INSIGHTS→REPORTS.
-- WORK and ADMINISTRATION have no v1 module (Home and Settings are always available).
UPDATE "Tenant" t
SET "enabledModules" = mapped.modules
FROM (
  SELECT id, ARRAY(
    SELECT DISTINCT m FROM unnest(ARRAY[
      CASE WHEN 'INTAKE' = ANY("operationalModules") THEN 'RECEIVE' END,
      CASE WHEN 'SORTING' = ANY("operationalModules") THEN 'SORT' END,
      CASE WHEN 'REPACK' = ANY("operationalModules") OR 'STOCK' = ANY("operationalModules") THEN 'STOCK' END,
      CASE WHEN 'SALES' = ANY("operationalModules") THEN 'SELL' END,
      CASE WHEN 'SALES' = ANY("operationalModules") THEN 'KHATA' END,
      CASE WHEN 'INSIGHTS' = ANY("operationalModules") THEN 'REPORTS' END
    ]) AS m
    WHERE m IS NOT NULL
    ORDER BY m
  ) AS modules
  FROM "Tenant"
  WHERE "operationalModules" IS NOT NULL AND cardinality("operationalModules") > 0
) mapped
WHERE t.id = mapped.id;

ALTER TABLE "Tenant"
  DROP COLUMN "capturePolicy",
  DROP COLUMN "connectivityPolicy",
  DROP COLUMN "flowEnabled",
  DROP COLUMN "guidancePolicy",
  DROP COLUMN "operationMode",
  DROP COLUMN "operationalModules";

ALTER TABLE "User" DROP COLUMN "preferredOperationMode";

DROP TYPE "CapturePolicy";
DROP TYPE "ConnectivityPolicy";
DROP TYPE "GuidancePolicy";
DROP TYPE "OperationMode";
