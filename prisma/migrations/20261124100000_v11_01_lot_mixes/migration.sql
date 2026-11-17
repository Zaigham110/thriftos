-- Mixing lots for sorting (owner, 2026-11-17): two or more lots or containers' lots are put together and sorted
-- as one. The mix is a lot of its own (sourceType MIXED); each lot that went in is closed for sorting (status
-- MIXED) and keeps its own cost. What the mix gives is shared back by weight.
ALTER TYPE "RagStatus" ADD VALUE 'MIXED';
ALTER TYPE "RagSourceType" ADD VALUE 'MIXED';

CREATE TABLE "LotMixSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mixRagId" TEXT NOT NULL,
    "sourceRagId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotMixSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LotMixSource_sourceRagId_key" ON "LotMixSource"("sourceRagId");
CREATE INDEX "LotMixSource_tenantId_mixRagId_idx" ON "LotMixSource"("tenantId", "mixRagId");

ALTER TABLE "LotMixSource" ADD CONSTRAINT "LotMixSource_mixRagId_fkey" FOREIGN KEY ("mixRagId") REFERENCES "Rag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotMixSource" ADD CONSTRAINT "LotMixSource_sourceRagId_fkey" FOREIGN KEY ("sourceRagId") REFERENCES "Rag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
