import { Prisma } from '@prisma/client';

/** What a munshi does on the floor: receive, sort, grade, bale, stock, and record expenses. Sales, payments and khata need no permission. */
export const MUNSHI_PERMISSIONS = [
  'po.read',
  'po.create',
  'container.read',
  'container.create',
  'container.update',
  'rag.read',
  'rag.create',
  'SORTING_STAGE1_VIEW',
  'SORTING_STAGE1_CREATE',
  'SORTING_STAGE1_EDIT',
  'SORTING_STAGE1_CLOSE',
  'SORTING_STAGE2_VIEW',
  'SORTING_STAGE2_CREATE',
  'SORTING_STAGE2_EDIT',
  'SORTING_STAGE2_CLOSE',
  'REPACK_VIEW',
  'REPACK_ALLOCATE',
  'INVENTORY_VIEW',
  'INVENTORY_INTAKE',
  'INVENTORY_ADJUST',
  // v2 review (Expenses): cash paid at the godown (chai, loading, rickshaw) is recorded on the phone.
  'expense.create',
];

/** The tenant's "Munshi" role with exactly the floor permissions (created on first use). */
export async function munshiRoleId(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const existing = await tx.role.findFirst({ where: { tenantId, name: 'Munshi' }, select: { id: true } });
  if (existing) return existing.id;
  const role = await tx.role.create({ data: { tenantId, name: 'Munshi', description: 'Floor work: receive, sort, bale, sell, khata' }, select: { id: true } });
  const permissions = await tx.permission.findMany({ where: { code: { in: MUNSHI_PERMISSIONS } }, select: { id: true } });
  await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  return role.id;
}
