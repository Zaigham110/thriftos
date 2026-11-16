-- Shared bale codes: bales of the same kind (category, grade, weight, pieces) share one code.
-- Bales that exist already get their kind and code when the server next starts (src/common/kinds.ts, the same
-- rule as a new import), so there is one place that builds codes.
CREATE TABLE "BaleKind" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "grade" TEXT,
    "weightKg" DECIMAL(14,2),
    "pieces" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaleKind_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BaleKind_tenantId_code_key" ON "BaleKind"("tenantId", "code");
CREATE UNIQUE INDEX "BaleKind_tenantId_key_key" ON "BaleKind"("tenantId", "key");
ALTER TABLE "BaleKind" ADD CONSTRAINT "BaleKind_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bale" ADD COLUMN "kindCode" TEXT;
CREATE INDEX "Bale_tenantId_kindCode_branchId_status_idx" ON "Bale"("tenantId", "kindCode", "branchId", "status");
