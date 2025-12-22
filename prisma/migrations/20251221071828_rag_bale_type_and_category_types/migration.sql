/*
  Warnings:

  - You are about to drop the column `categoryGuess` on the `IncomingBale` table. All the data in the column will be lost.
  - You are about to drop the column `categoryGuess` on the `Rag` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RagBaleType" AS ENUM ('RAG', 'BALE');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('RAG', 'BALE', 'GENERAL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "categoryType" "CategoryType" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "IncomingBale" DROP COLUMN "categoryGuess";

-- AlterTable
ALTER TABLE "Rag" DROP COLUMN "categoryGuess",
ADD COLUMN     "ragBaleType" "RagBaleType" NOT NULL DEFAULT 'RAG';

-- CreateIndex
CREATE INDEX "Category_categoryType_idx" ON "Category"("categoryType");

-- CreateIndex
CREATE INDEX "Rag_ragBaleType_idx" ON "Rag"("ragBaleType");
