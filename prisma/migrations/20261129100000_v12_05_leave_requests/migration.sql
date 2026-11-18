-- Leave requests and carry-over (owner, 2026-11-18). Leave is asked for over a span of days and approved or
-- refused; an approved request marks those days as leave in Attendance. Unused paid leave can be carried into the
-- next year, up to a number of days the business chooses (0 = none, the way it was).
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fromDay" DATE NOT NULL,
    "toDay" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest"("tenantId", "status");
CREATE INDEX "LeaveRequest_tenantId_workerId_idx" ON "LeaveRequest"("tenantId", "workerId");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance" ADD COLUMN "leaveRequestId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "leaveCarryMax" INTEGER NOT NULL DEFAULT 0;
