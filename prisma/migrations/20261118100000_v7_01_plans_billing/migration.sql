-- Phase 7 (owner, 2026-11-12): plans with prices and modules, each business's plan, trial and paid period, and manual
-- payments with a screenshot. Existing businesses get no plan: they keep their modules and never expire.
CREATE TYPE "BillingPeriod" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(14,2) NOT NULL,
    "yearlyPrice" DECIMAL(14,2) NOT NULL,
    "modules" TEXT[],
    "maxUsers" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

ALTER TABLE "Tenant" ADD COLUMN "planId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "paidUntil" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "extraModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "screenshotKey" TEXT,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "invoiceNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "submittedBy" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPayment_invoiceNumber_key" ON "SubscriptionPayment"("invoiceNumber");
CREATE INDEX "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The four plans the owner chose (prices in PKR a month; a year costs 10 months). Editable in the console.
INSERT INTO "Plan" ("id", "code", "name", "monthlyPrice", "yearlyPrice", "modules", "maxUsers", "sortOrder", "updatedAt") VALUES
  ('plan_free', 'FREE', 'Free', 0, 0, ARRAY['READY_STOCK','KHATA'], 1, 1, CURRENT_TIMESTAMP),
  ('plan_workshop', 'WORKSHOP', 'Workshop', 4000, 40000, ARRAY['LOOSE_LOTS','READY_STOCK','SORT','STOCK_COUNTS','KHATA','EXPENSES','CASH_CLOSE','STAFF','IMPORT'], 5, 2, CURRENT_TIMESTAMP),
  ('plan_importer', 'IMPORTER', 'Importer', 8000, 80000, ARRAY['CONTAINERS','LOOSE_LOTS','READY_STOCK','PURCHASE_ORDERS','SORT','STOCK_COUNTS','PRICE_LISTS','KHATA','EXPENSES','CASH_CLOSE','PNL','REPORTS','STAFF','IMPORT'], 15, 3, CURRENT_TIMESTAMP),
  ('plan_export', 'EXPORT', 'Export', 15000, 150000, ARRAY['CONTAINERS','LOOSE_LOTS','READY_STOCK','PURCHASE_ORDERS','SORT','WAREHOUSES','STOCK_COUNTS','PRICE_LISTS','EXPORT','KHATA','EXPENSES','CASH_CLOSE','PNL','REPORTS','STAFF','IMPORT'], NULL, 4, CURRENT_TIMESTAMP);
