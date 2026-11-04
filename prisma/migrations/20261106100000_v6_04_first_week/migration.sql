-- v2 6.4: the owner can hide the first-week checklist on Home.
ALTER TABLE "Tenant" ADD COLUMN "firstWeekHiddenAt" TIMESTAMP(3);
