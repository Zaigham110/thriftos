-- v3_02: setup wizard (task 3.8). A new tenant gets the wizard after the owner's first sign-in.
ALTER TABLE "Tenant" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Businesses already running are set up: they never see the wizard.
UPDATE "Tenant" SET "setupCompletedAt" = CURRENT_TIMESTAMP WHERE "setupCompletedAt" IS NULL;
