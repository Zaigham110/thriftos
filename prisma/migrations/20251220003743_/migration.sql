-- AlterTable
ALTER TABLE "IncomingBale" ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX "IncomingBale_purchaseOrderId_idx" ON "IncomingBale"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "IncomingBale" ADD CONSTRAINT "IncomingBale_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
