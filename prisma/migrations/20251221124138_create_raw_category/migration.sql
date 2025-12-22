/*
  Warnings:

  - You are about to drop the column `categoryType` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Rag` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `IncomingBale` table. All the data in the column will be lost.

*/

-- AlterEnum: Add BOTH to RagBaleType
ALTER TYPE "RagBaleType" ADD VALUE IF NOT EXISTS 'BOTH';

-- CreateTable: RawCategory (must exist before foreign keys)
CREATE TABLE IF NOT EXISTS "RawCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawType" "RagBaleType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RawCategory_tenantId_idx" ON "RawCategory"("tenantId");
CREATE INDEX IF NOT EXISTS "RawCategory_rawType_idx" ON "RawCategory"("rawType");
CREATE UNIQUE INDEX IF NOT EXISTS "RawCategory_tenantId_name_rawType_key" ON "RawCategory"("tenantId", "name", "rawType");

-- AddForeignKey: RawCategory to Tenant
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'RawCategory_tenantId_fkey') THEN
        ALTER TABLE "RawCategory" ADD CONSTRAINT "RawCategory_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Handle Rag table: Drop old categoryId, add rawCategoryId
DROP INDEX IF EXISTS "Rag_categoryId_idx";

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'Rag_categoryId_fkey') THEN
        ALTER TABLE "Rag" DROP CONSTRAINT "Rag_categoryId_fkey";
    END IF;
END $$;

-- Add rawCategoryId column to Rag if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='Rag' AND column_name='rawCategoryId') THEN
        ALTER TABLE "Rag" ADD COLUMN "rawCategoryId" TEXT;
    END IF;
END $$;

-- Drop old categoryId from Rag
ALTER TABLE "Rag" DROP COLUMN IF EXISTS "categoryId";

-- Create index on Rag.rawCategoryId
CREATE INDEX IF NOT EXISTS "Rag_rawCategoryId_idx" ON "Rag"("rawCategoryId");

-- AddForeignKey: Rag.rawCategoryId to RawCategory
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'Rag_rawCategoryId_fkey') THEN
        ALTER TABLE "Rag" ADD CONSTRAINT "Rag_rawCategoryId_fkey" 
        FOREIGN KEY ("rawCategoryId") REFERENCES "RawCategory"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Handle IncomingBale table: Rename or add rawCategoryId
DROP INDEX IF EXISTS "IncomingBale_categoryId_idx";

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'IncomingBale_categoryId_fkey') THEN
        ALTER TABLE "IncomingBale" DROP CONSTRAINT "IncomingBale_categoryId_fkey";
    END IF;
END $$;

-- Rename or add rawCategoryId in IncomingBale
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='IncomingBale' AND column_name='categoryId') THEN
        ALTER TABLE "IncomingBale" RENAME COLUMN "categoryId" TO "rawCategoryId";
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='IncomingBale' AND column_name='rawCategoryId') THEN
        ALTER TABLE "IncomingBale" ADD COLUMN "rawCategoryId" TEXT;
    END IF;
END $$;

-- NULL out existing rawCategoryId values (they reference Category, not RawCategory)
UPDATE "IncomingBale" SET "rawCategoryId" = NULL WHERE "rawCategoryId" IS NOT NULL;
UPDATE "Rag" SET "rawCategoryId" = NULL WHERE "rawCategoryId" IS NOT NULL;

-- Create index on IncomingBale.rawCategoryId
CREATE INDEX IF NOT EXISTS "IncomingBale_rawCategoryId_idx" ON "IncomingBale"("rawCategoryId");

-- AddForeignKey: IncomingBale.rawCategoryId to RawCategory
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'IncomingBale_rawCategoryId_fkey') THEN
        ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_rawCategoryId_fkey" 
        FOREIGN KEY ("rawCategoryId") REFERENCES "RawCategory"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Handle Category table: Remove categoryType
DROP INDEX IF EXISTS "Category_categoryType_idx";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "categoryType";

-- DropEnum: CategoryType is no longer needed
DROP TYPE IF EXISTS "CategoryType";
