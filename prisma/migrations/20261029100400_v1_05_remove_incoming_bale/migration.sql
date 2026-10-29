-- v1: IncomingBale duplicated Rag (sourceType LOOSE_BALE). Every bale becomes a lot, then the
-- table goes. Bales that already have a lot are skipped:
--   * sorting created one (Rag.notes = 'auto_migrated_bale:<baleId>'), or
--   * a loose lot with the same code exists (the old sort start linked those by code).
-- New lots reuse the bale id so nothing that pointed at the bale loses its link.

INSERT INTO "Rag" (
  "id", "tenantId", "containerId", "ragCode", "ragBaleType", "rawCategoryId", "vendorId", "originCountry",
  "weightKg", "purchaseCost", "allocatedCost", "sourceType", "status", "notes", "createdAt", "updatedAt"
)
SELECT
  b.id,
  b."tenantId",
  b."containerId",
  CASE
    WHEN EXISTS (SELECT 1 FROM "Rag" r WHERE r."tenantId" = b."tenantId" AND r."ragCode" = b."baleCode")
      THEN 'BALE-' || b."baleCode"
    ELSE b."baleCode"
  END,
  'BALE',
  b."rawCategoryId",
  b."vendorId",
  v."originCountry",
  b."weightKg",
  CASE WHEN b."containerId" IS NULL THEN b.cost END,
  b.cost,
  CASE WHEN b."containerId" IS NULL THEN 'LOOSE_BALE'::"RagSourceType" ELSE 'CONTAINER'::"RagSourceType" END,
  'NOT_STARTED',
  'migrated_from_incoming_bale',
  b."createdAt",
  now()
FROM "IncomingBale" b
LEFT JOIN "Vendor" v ON v.id = b."vendorId"
WHERE NOT EXISTS (SELECT 1 FROM "Rag" r WHERE r."tenantId" = b."tenantId" AND r.notes = 'auto_migrated_bale:' || b.id)
  AND NOT EXISTS (
    SELECT 1 FROM "Rag" r
    WHERE r."tenantId" = b."tenantId" AND r."ragCode" = b."baleCode" AND r."containerId" IS NULL
  );

-- Every SortSession already points at its lot (ragId is required), so the bale link can go.
ALTER TABLE "SortSession" DROP CONSTRAINT "SortSession_incomingBaleId_fkey";
DROP INDEX "SortSession_incomingBaleId_idx";
ALTER TABLE "SortSession" DROP COLUMN "incomingBaleId";

ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_containerId_fkey";
ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_purchaseOrderId_fkey";
ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_rawCategoryId_fkey";
ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_tenantId_fkey";
ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_vendorId_fkey";
DROP TABLE "IncomingBale";

-- Bale codes no longer need their own sequence.
DELETE FROM "TenantSequence" WHERE "scope" = 'INCOMING_BALE';
CREATE TYPE "SequenceScope_new" AS ENUM ('PURCHASE_ORDER', 'CONTAINER', 'RAG', 'SALE');
ALTER TABLE "TenantSequence" ALTER COLUMN "scope" TYPE "SequenceScope_new" USING ("scope"::text::"SequenceScope_new");
ALTER TYPE "SequenceScope" RENAME TO "SequenceScope_old";
ALTER TYPE "SequenceScope_new" RENAME TO "SequenceScope";
DROP TYPE "SequenceScope_old";
