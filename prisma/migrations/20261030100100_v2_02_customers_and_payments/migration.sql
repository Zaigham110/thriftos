-- v2_02 Customers need only a name (phone = WhatsApp in E.164, city, opening balance optional).
-- Payments belong to a customer (sale optional = payment on account) and use a fixed list of methods.

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'RAAST', 'JAZZCASH', 'EASYPAISA', 'OTHER');

ALTER TABLE "Customer"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ALTER COLUMN "companyName" DROP NOT NULL,
  ALTER COLUMN "billingAddress" DROP NOT NULL,
  ALTER COLUMN "shippingAddress" DROP NOT NULL,
  ALTER COLUMN "contactEmail" DROP NOT NULL,
  ALTER COLUMN "contactPhone" DROP NOT NULL,
  ALTER COLUMN "currencyCode" SET DEFAULT 'PKR';

-- WhatsApp number from the old contact phone, with the same rules as the app (common/phone.ts):
-- 00.. → +..; 03001234567 → +923001234567; 923001234567 → +923001234567; 3001234567 → +923001234567.
-- Numbers that do not make a valid E.164 number stay only in contactPhone.
WITH cleaned AS (
  SELECT id, regexp_replace("contactPhone", '[^0-9+]', '', 'g') AS p FROM "Customer" WHERE "contactPhone" IS NOT NULL
), prefixed AS (
  SELECT id, CASE
    WHEN p LIKE '00%' THEN '+' || substr(p, 3)
    WHEN p ~ '^0[0-9]{10}$' THEN '+92' || substr(p, 2)
    WHEN p ~ '^92[0-9]{10}$' THEN '+' || p
    WHEN p ~ '^3[0-9]{9}$' THEN '+92' || p
    ELSE p
  END AS p FROM cleaned
)
UPDATE "Customer" c SET "phone" = x.p
FROM prefixed x
WHERE x.id = c.id AND x.p ~ '^\+[1-9][0-9]{7,14}$' AND (x.p !~ '^\+92' OR x.p ~ '^\+92[0-9]{10}$');

CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");

-- Payments: tenant and customer come from the sale they were recorded against.
ALTER TABLE "Payment"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "receivedBy" TEXT,
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  ALTER COLUMN "saleId" DROP NOT NULL;

UPDATE "Payment" p
SET "tenantId" = s."tenantId",
    "customerId" = s."customerId",
    "paymentMethod" = CASE upper(trim(p."method"))
      WHEN 'CASH' THEN 'CASH'
      WHEN 'BANK' THEN 'BANK'
      WHEN 'BANK_TRANSFER' THEN 'BANK'
      WHEN 'TRANSFER' THEN 'BANK'
      WHEN 'RAAST' THEN 'RAAST'
      WHEN 'JAZZCASH' THEN 'JAZZCASH'
      WHEN 'EASYPAISA' THEN 'EASYPAISA'
      ELSE 'OTHER'
    END::"PaymentMethod",
    "reference" = CASE WHEN upper(trim(p."method")) IN ('CASH', 'BANK', 'BANK_TRANSFER', 'TRANSFER', 'RAAST', 'JAZZCASH', 'EASYPAISA', 'OTHER') THEN NULL ELSE p."method" END
FROM "Sale" s
WHERE s.id = p."saleId";

ALTER TABLE "Payment" DROP COLUMN "method";
ALTER TABLE "Payment" RENAME COLUMN "paymentMethod" TO "method";
ALTER TABLE "Payment"
  ALTER COLUMN "tenantId" SET NOT NULL,
  ALTER COLUMN "customerId" SET NOT NULL,
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- A payment must not disappear with its sale; sales are never deleted, only cancelled.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_saleId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
