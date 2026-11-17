-- Employee Management replaces Sorter pay (owner, 2026-11-17). The people already entered as workers stay, with
-- their pay sheets and advances; they gain the fields of an employee record. Counting what each sorter sorts
-- becomes a choice: on for a business that already has workers, off for everyone else.
ALTER TABLE "Worker" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "Worker" ADD COLUMN "cnic" TEXT;
ALTER TABLE "Worker" ADD COLUMN "joinedOn" DATE;
ALTER TABLE "Worker" ADD COLUMN "leftOn" DATE;
ALTER TABLE "Worker" ADD COLUMN "address" TEXT;
ALTER TABLE "Worker" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "Worker" ADD COLUMN "note" TEXT;

ALTER TABLE "Tenant" ADD COLUMN "trackSorterWork" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Tenant" t SET "trackSorterWork" = true WHERE EXISTS (SELECT 1 FROM "Worker" w WHERE w."tenantId" = t."id");
