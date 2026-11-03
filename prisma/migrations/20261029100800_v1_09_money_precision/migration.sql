-- v1: PKR totals can pass 10 digits. Amounts Decimal(12,2) → (14,2); per-kg rates (12,4) → (14,4).
-- Widening only: no value changes.

-- AlterTable
ALTER TABLE "CategoryOutput" ALTER COLUMN "allocatedCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Container" ALTER COLUMN "landedCostPerKg" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "ContainerCharge" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "creditLimit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "GradeOutput" ALTER COLUMN "allocatedCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "InventoryItem" ALTER COLUMN "avgCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "budgetCap" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Rag" ALTER COLUMN "allocatedCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "RepackInputAllocation" ALTER COLUMN "allocatedCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "RepackUnit" ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalCost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalProfit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "SaleLine" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "lineCost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "profit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "WasteCategory" ALTER COLUMN "defaultResalePrice" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "WasteLineItem" ALTER COLUMN "estimatedValue" SET DATA TYPE DECIMAL(14,4);

