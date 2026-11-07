-- v2 review (Expenses): more categories, a reason when an expense is cancelled, and the munshi may record
-- expenses (cash paid at the godown). Only adds; nothing existing is changed or removed.
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'TEA_FOOD';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'FUEL';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'LOADING';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PACKING';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'SALARY';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'REPAIRS';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'CUSTOMS';

ALTER TABLE "Expense" ADD COLUMN "cancelReason" TEXT;

-- Every existing "Munshi" role may record expenses (new Munshi roles get it from MUNSHI_PERMISSIONS).
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT 'rp_exp_' || r."id", r."id", p."id", NOW(), NOW()
FROM "Role" r
JOIN "Permission" p ON p."code" = 'expense.create'
WHERE r."name" = 'Munshi'
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."roleId" = r."id" AND x."permissionId" = p."id");
