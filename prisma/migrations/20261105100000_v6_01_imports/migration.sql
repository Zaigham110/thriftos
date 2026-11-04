-- CreateTable
CREATE TABLE "ImportedRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRow_tenantId_kind_rowKey_key" ON "ImportedRow"("tenantId", "kind", "rowKey");

-- CreateIndex
CREATE INDEX "ImportedRow_tenantId_idx" ON "ImportedRow"("tenantId");
