-- Rights for managers (owner, 2026-11-18). "employee.manage": employee records, attendance and leave; the owner
-- (Admin) and every Manager role get it. "payroll.run": pay sheets, advances and loans; the owner's, and any role
-- the owner ticks it for. Until now all of it was the owner's alone.
INSERT INTO "Permission" ("id", "code", "name", "group", "createdAt", "updatedAt") VALUES
  ('perm_employee_manage', 'employee.manage', 'Employees - Records, attendance and leave', 'Employees', NOW(), NOW()),
  ('perm_payroll_run', 'payroll.run', 'Employees - Pay sheets, advances and loans', 'Employees', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT 'rp_emp_' || r."id" || '_' || p."code", r."id", p."id", NOW(), NOW()
FROM "Role" r
JOIN "Permission" p ON (p."code" = 'employee.manage' AND r."name" IN ('Admin', 'Manager')) OR (p."code" = 'payroll.run' AND r."name" = 'Admin')
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."roleId" = r."id" AND x."permissionId" = p."id");
