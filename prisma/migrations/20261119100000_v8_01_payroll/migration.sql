-- Phase 8 (owner, 2026-11-12): workers without a login paid per kg, piece, day or month; sorting entries name their
-- worker; pay sheets with advances and deductions, paid in cash as a Labour expense; labour cost on the lots sorted.
-- Payroll comes with the Workshop, Importer and Export plans. Nothing existing changes.
CREATE TYPE "WorkerPayType" AS ENUM ('KG', 'PIECE', 'DAY', 'MONTH');
CREATE TYPE "PaySheetStatus" AS ENUM ('DRAFT', 'PAID');

CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "payType" "WorkerPayType" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Worker_tenantId_idx" ON "Worker"("tenantId");

ALTER TABLE "CategoryOutput" ADD COLUMN "workerId" TEXT;
ALTER TABLE "CategoryOutput" ADD CONSTRAINT "CategoryOutput_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PaySheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PaySheetStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expenseId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaySheet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaySheet_tenantId_periodStart_idx" ON "PaySheet"("tenantId", "periodStart");

CREATE TABLE "PaySheetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paySheetId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "payType" "WorkerPayType" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "days" INTEGER NOT NULL DEFAULT 0,
    "gross" DECIMAL(14,2) NOT NULL,
    "advances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    CONSTRAINT "PaySheetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaySheetLine_tenantId_idx" ON "PaySheetLine"("tenantId");
CREATE INDEX "PaySheetLine_paySheetId_idx" ON "PaySheetLine"("paySheetId");
ALTER TABLE "PaySheetLine" ADD CONSTRAINT "PaySheetLine_paySheetId_fkey" FOREIGN KEY ("paySheetId") REFERENCES "PaySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaySheetLine" ADD CONSTRAINT "PaySheetLine_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WorkerAdvance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "expenseId" TEXT,
    "paySheetLineId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerAdvance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkerAdvance_tenantId_workerId_idx" ON "WorkerAdvance"("tenantId", "workerId");
ALTER TABLE "WorkerAdvance" ADD CONSTRAINT "WorkerAdvance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerAdvance" ADD CONSTRAINT "WorkerAdvance_paySheetLineId_fkey" FOREIGN KEY ("paySheetLineId") REFERENCES "PaySheetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LabourCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paySheetLineId" TEXT NOT NULL,
    "ragId" TEXT NOT NULL,
    "containerId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabourCost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LabourCost_tenantId_ragId_idx" ON "LabourCost"("tenantId", "ragId");
CREATE INDEX "LabourCost_tenantId_containerId_idx" ON "LabourCost"("tenantId", "containerId");
ALTER TABLE "LabourCost" ADD CONSTRAINT "LabourCost_paySheetLineId_fkey" FOREIGN KEY ("paySheetLineId") REFERENCES "PaySheetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payroll comes with Workshop and up (the owner's choice); businesses on those plans get it at their next refresh.
UPDATE "Plan" SET "modules" = array_append("modules", 'PAYROLL') WHERE "code" IN ('WORKSHOP', 'IMPORTER', 'EXPORT') AND NOT ('PAYROLL' = ANY("modules"));
