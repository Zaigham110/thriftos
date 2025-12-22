-- AlterTable
ALTER TABLE "Rag" ADD COLUMN     "categoryGuess" TEXT,
ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Rag_categoryId_idx" ON "Rag"("categoryId");

-- AddForeignKey
ALTER TABLE "Rag" ADD CONSTRAINT "Rag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
