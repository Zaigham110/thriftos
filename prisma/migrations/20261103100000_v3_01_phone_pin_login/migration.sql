-- v3_01: phone + PIN login for munshi users (task 3.7). Owners keep email + password.
-- No data changes: every existing user keeps their email and password.

-- A munshi may have no email or password, only a phone and a PIN.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "failedPinAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);

-- The phone is the login, so it is unique across tenants.
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Every user can sign in one way or the other.
ALTER TABLE "User" ADD CONSTRAINT "User_can_sign_in"
  CHECK (("email" IS NOT NULL AND "passwordHash" IS NOT NULL) OR ("phone" IS NOT NULL AND "pinHash" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_failed_pin_attempts_not_negative" CHECK ("failedPinAttempts" >= 0);
