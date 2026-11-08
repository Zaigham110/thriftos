-- v2 review (Cash close): cash taken out of the drawer or put into it (to/from the bank, by the owner, other).
-- Only adds a table and two types; nothing existing is changed or removed.
CREATE TYPE "CashMoveDirection" AS ENUM ('OUT', 'IN');
CREATE TYPE "CashMoveKind" AS ENUM ('BANK', 'OWNER', 'OTHER');

CREATE TABLE "CashMove" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "direction" "CashMoveDirection" NOT NULL,
    "kind" "CashMoveKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMove_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashMove_tenantId_day_idx" ON "CashMove"("tenantId", "day");
