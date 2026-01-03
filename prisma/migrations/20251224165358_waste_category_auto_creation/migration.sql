/*
  Warnings:

  - A unique constraint covering the columns `[linkedCategoryId]` on the table `WasteCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WasteCategory" ADD COLUMN     "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedCategoryId" TEXT,
ALTER COLUMN "defaultResalePrice" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "WasteCategory_linkedCategoryId_key" ON "WasteCategory"("linkedCategoryId");

-- AddForeignKey
ALTER TABLE "WasteCategory" ADD CONSTRAINT "WasteCategory_linkedCategoryId_fkey" FOREIGN KEY ("linkedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
