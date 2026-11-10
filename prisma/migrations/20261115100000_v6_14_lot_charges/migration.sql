-- Loose lot (owner, 2026-11-11): the rate per kg typed, and extra charges (transport, labour, loading…) that are
-- part of the lot's cost. Existing lots have no charges, so their cost is unchanged.
ALTER TABLE "Rag" ADD COLUMN "ratePerKg" DECIMAL(14,2);

CREATE TABLE "LotCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ragId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LotCharge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LotCharge_tenantId_idx" ON "LotCharge"("tenantId");
CREATE INDEX "LotCharge_ragId_idx" ON "LotCharge"("ragId");
ALTER TABLE "LotCharge" ADD CONSTRAINT "LotCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotCharge" ADD CONSTRAINT "LotCharge_ragId_fkey" FOREIGN KEY ("ragId") REFERENCES "Rag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
