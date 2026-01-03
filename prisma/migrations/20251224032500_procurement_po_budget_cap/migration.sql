-- Add budget cap to purchase orders (nullable for backward compatibility)
ALTER TABLE "PurchaseOrder" ADD COLUMN "budgetCap" DECIMAL(12,2);
