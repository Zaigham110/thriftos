/*
  Warnings:

  - Added the required column `remainingAmount` to the `GradeOutput` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `GradeOutput` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetAmount` to the `RepackUnit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('WEIGHT', 'QUANTITY');

-- CreateEnum
CREATE TYPE "AllocationMode" AS ENUM ('FIFO', 'MANUAL');

-- CreateEnum
CREATE TYPE "GradingOutputStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_USED', 'DEPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RepackStatus" ADD VALUE 'DRAFT';
ALTER TYPE "RepackStatus" ADD VALUE 'SEALED';

-- AlterTable
ALTER TABLE "GradeOutput" ADD COLUMN     "measurementType" "MeasurementType" NOT NULL DEFAULT 'WEIGHT',
ADD COLUMN     "remainingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "GradingOutputStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "usedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RepackUnit" ADD COLUMN     "allocationMode" "AllocationMode" NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "measurementType" "MeasurementType" NOT NULL DEFAULT 'WEIGHT',
ADD COLUMN     "targetAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RepackInputAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "repackUnitId" TEXT NOT NULL,
    "gradingOutputId" TEXT NOT NULL,
    "containerId" TEXT,
    "ragBaleId" TEXT,
    "amountUsed" DECIMAL(10,2) NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,
    "allocatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepackInputAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepackInputAllocation_tenantId_idx" ON "RepackInputAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "RepackInputAllocation_repackUnitId_idx" ON "RepackInputAllocation"("repackUnitId");

-- CreateIndex
CREATE INDEX "RepackInputAllocation_gradingOutputId_idx" ON "RepackInputAllocation"("gradingOutputId");

-- CreateIndex
CREATE INDEX "RepackInputAllocation_containerId_idx" ON "RepackInputAllocation"("containerId");

-- CreateIndex
CREATE INDEX "RepackInputAllocation_ragBaleId_idx" ON "RepackInputAllocation"("ragBaleId");

-- CreateIndex
CREATE INDEX "RepackInputAllocation_createdAt_idx" ON "RepackInputAllocation"("createdAt");

-- CreateIndex
CREATE INDEX "GradeOutput_status_idx" ON "GradeOutput"("status");

-- CreateIndex
CREATE INDEX "GradeOutput_measurementType_idx" ON "GradeOutput"("measurementType");

-- CreateIndex
CREATE INDEX "RepackUnit_allocationMode_idx" ON "RepackUnit"("allocationMode");

-- CreateIndex
CREATE INDEX "RepackUnit_measurementType_idx" ON "RepackUnit"("measurementType");

-- AddForeignKey
ALTER TABLE "RepackInputAllocation" ADD CONSTRAINT "RepackInputAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackInputAllocation" ADD CONSTRAINT "RepackInputAllocation_repackUnitId_fkey" FOREIGN KEY ("repackUnitId") REFERENCES "RepackUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepackInputAllocation" ADD CONSTRAINT "RepackInputAllocation_gradingOutputId_fkey" FOREIGN KEY ("gradingOutputId") REFERENCES "GradeOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
