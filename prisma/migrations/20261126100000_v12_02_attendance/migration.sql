-- Attendance (owner, 2026-11-17: Employee Management): each employee's day is present, absent, half day, leave or
-- a holiday. A pay sheet line now holds half days too, and how many days the person was absent.
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY');

CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "markedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attendance_workerId_day_key" ON "Attendance"("workerId", "day");
CREATE INDEX "Attendance_tenantId_day_idx" ON "Attendance"("tenantId", "day");
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaySheetLine" ALTER COLUMN "days" SET DATA TYPE DECIMAL(5,1);
ALTER TABLE "PaySheetLine" ADD COLUMN "absentDays" DECIMAL(5,1) NOT NULL DEFAULT 0;
