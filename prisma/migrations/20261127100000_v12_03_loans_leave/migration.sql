-- Loans and leave (owner, 2026-11-17: Employee Management). A loan is cash lent to an employee, not an expense,
-- paid back from pay (an instalment on each pay sheet) or in cash. Leave: a yearly number of paid leave days.
ALTER TABLE "Worker" ADD COLUMN "leaveAllowance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaySheetLine" ADD COLUMN "loan" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "instalment" DECIMAL(14,2) NOT NULL,
    "repaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "cashMoveId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "paySheetLineId" TEXT,
    "day" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "cashMoveId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeLoan_tenantId_workerId_idx" ON "EmployeeLoan"("tenantId", "workerId");
CREATE INDEX "LoanRepayment_tenantId_loanId_idx" ON "LoanRepayment"("tenantId", "loanId");
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "EmployeeLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_paySheetLineId_fkey" FOREIGN KEY ("paySheetLineId") REFERENCES "PaySheetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
