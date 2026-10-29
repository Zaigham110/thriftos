-- v1: tenants that sort in one stage make bales straight from category outputs.
-- A bale input comes from exactly one source: a grade output or a category output.

-- AlterTable
ALTER TABLE "CategoryOutput" ADD COLUMN     "usedKg" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "gradeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RepackInputAllocation" ADD COLUMN     "categoryOutputId" TEXT,
ALTER COLUMN "gradingOutputId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "RepackInputAllocation_categoryOutputId_idx" ON "RepackInputAllocation"("categoryOutputId");

-- AddForeignKey
ALTER TABLE "RepackInputAllocation" ADD CONSTRAINT "RepackInputAllocation_categoryOutputId_fkey" FOREIGN KEY ("categoryOutputId") REFERENCES "CategoryOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Exactly one source per bale input. Prisma cannot express this, so it lives in SQL only;
-- BaleService enforces the same rule before writing.
ALTER TABLE "RepackInputAllocation"
  ADD CONSTRAINT "RepackInputAllocation_exactly_one_source"
  CHECK (num_nonnulls("gradingOutputId", "categoryOutputId") = 1);

-- A category output can never give more kg to bales than it weighs.
ALTER TABLE "CategoryOutput"
  ADD CONSTRAINT "CategoryOutput_usedKg_within_weight"
  CHECK ("usedKg" >= 0 AND "usedKg" <= "weightKg");
