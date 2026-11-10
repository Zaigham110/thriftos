-- v2 staff: "Munshi" becomes staff with roles (Manager, Buyer, Sorter, Salesman, Cashier), each signing in with
-- phone + PIN. Making a sale and taking a payment get their own permissions so the roles can differ; every role a
-- business already has (except "can only look") gets both, so nobody loses what they could do.
INSERT INTO "Permission" ("id", "code", "name", "group", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.code, v.name, 'Sales', NOW(), NOW()
FROM (VALUES ('sale.create', 'Make sales'), ('payment.create', 'Take payments')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM "Permission" p WHERE p."code" = v.code);

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."id", p."id", NOW(), NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."code" IN ('sale.create', 'payment.create')
  AND r."name" <> 'ReadOnly'
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" rp WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id");

-- The old "Munshi" role is the floor role: it becomes "Sorter" and keeps everything it had.
UPDATE "Role" r SET "name" = 'Sorter', "updatedAt" = NOW()
WHERE r."name" = 'Munshi'
  AND NOT EXISTS (SELECT 1 FROM "Role" s WHERE s."tenantId" = r."tenantId" AND s."name" = 'Sorter');

-- The module: MUNSHI → STAFF.
UPDATE "Tenant" SET "enabledModules" = array_replace("enabledModules", 'MUNSHI', 'STAFF')
WHERE 'MUNSHI' = ANY("enabledModules");
ALTER TABLE "Tenant" ALTER COLUMN "enabledModules" SET DEFAULT ARRAY['RECEIVE', 'STOCK', 'SELL', 'SORT', 'CONTAINERS', 'LOOSE_LOTS', 'READY_STOCK', 'STOCK_COUNTS', 'PRICE_LISTS', 'KHATA', 'EXPENSES', 'CASH_CLOSE', 'PNL', 'STAFF', 'IMPORT']::TEXT[];

-- Owners sign in with email and a first password they must change.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
