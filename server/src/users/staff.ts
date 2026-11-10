import { Prisma } from '@prisma/client';

/**
 * Staff roles every business has (v2: "replace Munshi with staff like Manager, Sorter, Buyer"). Staff sign in with
 * phone + PIN. The owner (role "Admin") has everything; the owner can also make their own roles.
 */
export const STAFF_ROLE_NAMES = ['Manager', 'Buyer', 'Sorter', 'Salesman', 'Cashier'] as const;
export type StaffRoleName = (typeof STAFF_ROLE_NAMES)[number];

/** What the Manager may not do: the team, roles, the business itself, bringing data in or out. */
const NOT_FOR_MANAGER = new Set([
  'tenant.create', 'tenant.read', 'tenant.update', 'tenant.delete',
  'user.create', 'user.update', 'user.delete',
  'role.create', 'role.update', 'role.delete',
  'data.export', 'data.import',
]);

const FLOOR_STOCK = ['INVENTORY_VIEW', 'REPACK_VIEW'];

export const STAFF_PERMISSIONS: Record<Exclude<StaffRoleName, 'Manager'>, string[]> = {
  Buyer: [
    'vendor.create', 'vendor.read', 'vendor.update',
    'po.create', 'po.read', 'po.update',
    'container.create', 'container.read', 'container.update',
    'rag.create', 'rag.read',
    'INVENTORY_INTAKE', ...FLOOR_STOCK,
    'expense.create',
  ],
  Sorter: [
    'container.read', 'rag.read',
    'sort.session.create', 'sort.session.read', 'sort.session.update', 'sort.session.close',
    'SORTING_STAGE1_VIEW', 'SORTING_STAGE1_CREATE', 'SORTING_STAGE1_EDIT', 'SORTING_STAGE1_CLOSE',
    'grade.session.create', 'grade.session.read', 'grade.session.update', 'grade.session.close',
    'SORTING_STAGE2_VIEW', 'SORTING_STAGE2_CREATE', 'SORTING_STAGE2_EDIT', 'SORTING_STAGE2_CLOSE',
    'REPACK_CREATE', 'REPACK_EDIT', 'REPACK_CLOSE', 'REPACK_ALLOCATE', 'qr.generate',
    'INVENTORY_ADJUST', ...FLOOR_STOCK,
    'expense.create',
  ],
  Salesman: ['sale.create', 'payment.create', ...FLOOR_STOCK],
  Cashier: ['finance.view', 'expense.create', 'cash.close', 'payment.create', ...FLOOR_STOCK],
};

const DESCRIPTIONS: Record<StaffRoleName, string> = {
  Manager: 'Runs the business day to day: everything except the team and business settings',
  Buyer: 'Suppliers, containers, loose lots and ready bales',
  Sorter: 'Sorting, grading, making bales and stock',
  Salesman: 'Sales, customers and collecting payments',
  Cashier: 'Expenses, cash close and payments',
};

/** The permission codes of a staff role (Manager: all codes it may have). */
export function staffPermissionCodes(name: StaffRoleName, allCodes: string[]): string[] {
  return name === 'Manager' ? allCodes.filter((c) => !NOT_FOR_MANAGER.has(c)) : STAFF_PERMISSIONS[name];
}

/** Makes the staff roles a business is missing (an existing role of the same name is left as it is). */
export async function ensureStaffRoles(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  const have = new Set((await tx.role.findMany({ where: { tenantId, name: { in: [...STAFF_ROLE_NAMES] } }, select: { name: true } })).map((r) => r.name));
  const missing = STAFF_ROLE_NAMES.filter((n) => !have.has(n));
  if (!missing.length) return;
  const all = await tx.permission.findMany({ select: { id: true, code: true } });
  for (const name of missing) {
    const codes = new Set(staffPermissionCodes(name, all.map((p) => p.code)));
    const role = await tx.role.create({ data: { tenantId, name, description: DESCRIPTIONS[name] }, select: { id: true } });
    await tx.rolePermission.createMany({ data: all.filter((p) => codes.has(p.code)).map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
}
