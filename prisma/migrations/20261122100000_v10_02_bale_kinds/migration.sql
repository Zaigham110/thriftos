-- Shared bale codes (owner, 2026-11-16): bales of the same category, grade and weight/pieces carry one code
-- (JEANS-1-45) and are counted as a quantity. Each bale stays its own stock item; this only names its kind.
CREATE TABLE "BaleKind" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "gradeId" TEXT,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pcsCount" INTEGER NOT NULL DEFAULT 0,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaleKind_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryItem" ADD COLUMN "baleKindId" TEXT;

-- The bales there already are: one kind per combination, with the same code rule as the app
-- (server/src/stock/bale-kind.ts): CATEGORY-GRADE-KG, or -<pieces>P, Latin letters and digits only.
WITH kinds AS (
  SELECT DISTINCT i."tenantId", i."categoryId", i."gradeId", COALESCE(i."weightKg", 0)::DECIMAL(10,2) AS kg, i."pcsCount" AS pcs
  FROM "InventoryItem" i
  WHERE i."repackUnitId" IS NOT NULL AND i."unit" = 'BALE' AND i."categoryId" IS NOT NULL
), named AS (
  SELECT k.*,
    CONCAT_WS('-',
      COALESCE(NULLIF(LEFT(UPPER(REGEXP_REPLACE(c."name", '[^A-Za-z0-9]+', '', 'g')), 10), ''), 'K'),
      NULLIF(LEFT(UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(g."name", ''), '^\s*grade\s*', '', 'i'), '[^A-Za-z0-9]+', '', 'g')), 6), ''),
      CASE WHEN k.kg > 0 THEN TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM k.kg::TEXT)) END,
      CASE WHEN k.pcs > 0 THEN k.pcs::TEXT || 'P' END
    ) AS base
  FROM kinds k
  JOIN "Category" c ON c."id" = k."categoryId"
  LEFT JOIN "Grade" g ON g."id" = k."gradeId"
), numbered AS (
  SELECT n.*, ROW_NUMBER() OVER (PARTITION BY n."tenantId", n.base ORDER BY n."categoryId", n."gradeId" NULLS FIRST) AS rn
  FROM named n
)
INSERT INTO "BaleKind" ("id", "tenantId", "categoryId", "gradeId", "weightKg", "pcsCount", "key", "code")
SELECT 'bk_' || MD5("tenantId" || '|' || "categoryId" || '|' || COALESCE("gradeId", '') || '|' || kg::TEXT || '|' || pcs::TEXT),
  "tenantId", "categoryId", "gradeId", kg, pcs,
  "categoryId" || '|' || COALESCE("gradeId", '') || '|' || TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM kg::TEXT)) || '|' || pcs::TEXT,
  CASE WHEN rn = 1 THEN base ELSE base || '-' || rn::TEXT END
FROM numbered;

UPDATE "InventoryItem" i SET "baleKindId" = k."id"
FROM "BaleKind" k
WHERE i."repackUnitId" IS NOT NULL AND i."unit" = 'BALE' AND i."categoryId" IS NOT NULL
  AND k."tenantId" = i."tenantId" AND k."categoryId" = i."categoryId"
  AND k."gradeId" IS NOT DISTINCT FROM i."gradeId"
  AND k."weightKg" = COALESCE(i."weightKg", 0)::DECIMAL(10,2) AND k."pcsCount" = i."pcsCount";

CREATE UNIQUE INDEX "BaleKind_tenantId_key_key" ON "BaleKind"("tenantId", "key");
CREATE UNIQUE INDEX "BaleKind_tenantId_code_key" ON "BaleKind"("tenantId", "code");
CREATE INDEX "InventoryItem_tenantId_baleKindId_idx" ON "InventoryItem"("tenantId", "baleKindId");

ALTER TABLE "BaleKind" ADD CONSTRAINT "BaleKind_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BaleKind" ADD CONSTRAINT "BaleKind_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaleKind" ADD CONSTRAINT "BaleKind_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_baleKindId_fkey" FOREIGN KEY ("baleKindId") REFERENCES "BaleKind"("id") ON DELETE SET NULL ON UPDATE CASCADE;
