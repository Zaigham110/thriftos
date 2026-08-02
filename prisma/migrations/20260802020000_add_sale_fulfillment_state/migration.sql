CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'FULFILLED');

ALTER TABLE "Sale"
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfilledAt" TIMESTAMP(3),
  ADD COLUMN "fulfillmentReference" TEXT;
