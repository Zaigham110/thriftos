CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "responseJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_tenantId_scope_key_key" ON "IdempotencyKey"("tenantId", "scope", "key");
CREATE INDEX "IdempotencyKey_tenantId_createdAt_idx" ON "IdempotencyKey"("tenantId", "createdAt");
