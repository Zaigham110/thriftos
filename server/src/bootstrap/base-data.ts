import { Prisma, PrismaClient, TenantStatus } from '@prisma/client';

/**
 * Base data every ThriftOS database needs: the SYSTEM business that super admins belong to, global
 * settings, category templates and the permission list. Idempotent (upserts, nothing overwritten), so
 * the API runs it on every start (`node dist/bootstrap/bootstrap.js --base`) and new permissions arrive
 * with a release. The dev/test seed (prisma/seed.ts) uses the same function.
 */

export const SYSTEM_COMPANY_CODE = 'SYSTEM';

export const CATEGORY_TEMPLATES = [
  { categoryName: 'T-Shirts', defaultWeightUnit: 'KG', defaultSortPriority: 1 },
  { categoryName: 'Jeans', defaultWeightUnit: 'KG', defaultSortPriority: 2 },
  { categoryName: 'Dresses', defaultWeightUnit: 'KG', defaultSortPriority: 3 },
  { categoryName: 'Jackets', defaultWeightUnit: 'KG', defaultSortPriority: 4 },
  { categoryName: 'Shoes', defaultWeightUnit: 'KG', defaultSortPriority: 5 },
  { categoryName: 'Accessories', defaultWeightUnit: 'PCS', defaultSortPriority: 6 },
  { categoryName: 'Bags', defaultWeightUnit: 'PCS', defaultSortPriority: 7 },
  { categoryName: 'Children Wear', defaultWeightUnit: 'KG', defaultSortPriority: 8 },
  { categoryName: 'Winter Wear', defaultWeightUnit: 'KG', defaultSortPriority: 9 },
  { categoryName: 'Sportswear', defaultWeightUnit: 'KG', defaultSortPriority: 10 },
];

export const PERMISSIONS = [
  // Super Admin
  { code: 'tenant.create', name: 'Create Tenant', group: 'Super Admin' },
  { code: 'tenant.read', name: 'View Tenants', group: 'Super Admin' },
  { code: 'tenant.update', name: 'Update Tenant', group: 'Super Admin' },
  { code: 'tenant.delete', name: 'Delete Tenant', group: 'Super Admin' },
  
  // User Management
  { code: 'user.create', name: 'Create User', group: 'User Management' },
  { code: 'user.read', name: 'View Users', group: 'User Management' },
  { code: 'user.update', name: 'Update User', group: 'User Management' },
  { code: 'user.delete', name: 'Delete User', group: 'User Management' },
  
  // Role Management
  { code: 'role.create', name: 'Create Role', group: 'Role Management' },
  { code: 'role.read', name: 'View Roles', group: 'Role Management' },
  { code: 'role.update', name: 'Update Role', group: 'Role Management' },
  { code: 'role.delete', name: 'Delete Role', group: 'Role Management' },
  
  // Category Management
  { code: 'category.create', name: 'Create Category', group: 'Configuration' },
  { code: 'category.read', name: 'View Categories', group: 'Configuration' },
  { code: 'category.update', name: 'Update Category', group: 'Configuration' },
  { code: 'category.delete', name: 'Delete Category', group: 'Configuration' },
  
  // Grade Management
  { code: 'grade.create', name: 'Create Grade', group: 'Configuration' },
  { code: 'grade.read', name: 'View Grades', group: 'Configuration' },
  { code: 'grade.update', name: 'Update Grade', group: 'Configuration' },
  { code: 'grade.delete', name: 'Delete Grade', group: 'Configuration' },
  
  // Warehouse Management
  { code: 'warehouse.create', name: 'Create Warehouse', group: 'Configuration' },
  { code: 'warehouse.read', name: 'View Warehouses', group: 'Configuration' },
  { code: 'warehouse.update', name: 'Update Warehouse', group: 'Configuration' },
  { code: 'warehouse.delete', name: 'Delete Warehouse', group: 'Configuration' },
  
  // Procurement - Purchase Orders
  { code: 'po.create', name: 'Create Purchase Order', group: 'Procurement' },
  { code: 'po.read', name: 'View Purchase Orders', group: 'Procurement' },
  { code: 'po.update', name: 'Update Purchase Order', group: 'Procurement' },
  { code: 'po.delete', name: 'Delete Purchase Order', group: 'Procurement' },
  
  // Procurement - Containers
  { code: 'container.create', name: 'Create Container', group: 'Procurement' },
  { code: 'container.read', name: 'View Containers', group: 'Procurement' },
  { code: 'container.update', name: 'Update Container', group: 'Procurement' },
  { code: 'container.delete', name: 'Delete Container', group: 'Procurement' },
  
  // Procurement - Rags
  { code: 'rag.create', name: 'Create Rag', group: 'Procurement' },
  { code: 'rag.read', name: 'View Rags', group: 'Procurement' },
  { code: 'rag.delete', name: 'Delete Rag', group: 'Procurement' },
  
  // Procurement - Vendors
  { code: 'vendor.create', name: 'Create Vendor', group: 'Procurement' },
  { code: 'vendor.read', name: 'View Vendors', group: 'Procurement' },
  { code: 'vendor.update', name: 'Update Vendor', group: 'Procurement' },
  
  // Sorting Stage 1
  { code: 'sort.session.create', name: 'Create Sort Session', group: 'Sorting' },
  { code: 'sort.session.read', name: 'View Sort Sessions', group: 'Sorting' },
  { code: 'sort.session.update', name: 'Update Sort Session', group: 'Sorting' },
  { code: 'sort.session.close', name: 'Close Sort Session', group: 'Sorting' },

  // Sorting Stage 1 (Phase 3 prompt recommended permission codes)
  { code: 'SORTING_STAGE1_VIEW', name: 'Sorting Stage 1 - View', group: 'Sorting' },
  { code: 'SORTING_STAGE1_CREATE', name: 'Sorting Stage 1 - Create', group: 'Sorting' },
  { code: 'SORTING_STAGE1_EDIT', name: 'Sorting Stage 1 - Edit', group: 'Sorting' },
  { code: 'SORTING_STAGE1_CLOSE', name: 'Sorting Stage 1 - Close', group: 'Sorting' },
  
  // Sorting Stage 2 (Grading)
  { code: 'grade.session.create', name: 'Create Grade Session', group: 'Grading' },
  { code: 'grade.session.read', name: 'View Grade Sessions', group: 'Grading' },
  { code: 'grade.session.update', name: 'Update Grade Session', group: 'Grading' },
  { code: 'grade.session.close', name: 'Close Grade Session', group: 'Grading' },

  // Sorting Stage 2 (Phase 4 prompt recommended permission codes)
  { code: 'SORTING_STAGE2_VIEW', name: 'Sorting Stage 2 - View', group: 'Grading' },
  { code: 'SORTING_STAGE2_CREATE', name: 'Sorting Stage 2 - Create', group: 'Grading' },
  { code: 'SORTING_STAGE2_EDIT', name: 'Sorting Stage 2 - Edit', group: 'Grading' },
  { code: 'SORTING_STAGE2_CLOSE', name: 'Sorting Stage 2 - Close', group: 'Grading' },
  
  // Repack
  { code: 'repack.session.create', name: 'Create Repack Session', group: 'Repack' },
  { code: 'repack.session.read', name: 'View Repack Sessions', group: 'Repack' },
  { code: 'repack.session.update', name: 'Update Repack Session', group: 'Repack' },
  { code: 'repack.unit.create', name: 'Create Repack Unit', group: 'Repack' },
  { code: 'repack.unit.read', name: 'View Repack Units', group: 'Repack' },
  { code: 'qr.generate', name: 'Generate QR Labels', group: 'Repack' },

  // Repack (Phase 5 prompt recommended permission codes)
  { code: 'REPACK_VIEW', name: 'Repack - View', group: 'Repack' },
  { code: 'REPACK_CREATE', name: 'Repack - Create', group: 'Repack' },
  { code: 'REPACK_EDIT', name: 'Repack - Edit', group: 'Repack' },
  { code: 'REPACK_CLOSE', name: 'Repack - Close', group: 'Repack' },
  { code: 'REPACK_ALLOCATE', name: 'Repack - Allocate', group: 'Repack' },
  
  // Inventory
  { code: 'inventory.read', name: 'View Inventory', group: 'Inventory' },
  { code: 'inventory.adjust', name: 'Adjust Inventory', group: 'Inventory' },
  { code: 'inventory.transfer', name: 'Transfer Inventory', group: 'Inventory' },
  { code: 'stockmovement.read', name: 'View Stock Movements', group: 'Inventory' },

  // Inventory (Phase 6 prompt recommended permission codes)
  { code: 'INVENTORY_VIEW', name: 'Inventory - View', group: 'Inventory' },
  { code: 'INVENTORY_INTAKE', name: 'Inventory - Intake', group: 'Inventory' },
  { code: 'INVENTORY_ADJUST', name: 'Inventory - Adjust', group: 'Inventory' },
  { code: 'INVENTORY_APPROVE', name: 'Inventory - Approve stock counts', group: 'Inventory' },

  // Finance (enterprise E3.6): management accounts
  { code: 'finance.view', name: 'Finance - View books, cash close and profit', group: 'Finance' },
  { code: 'expense.create', name: 'Finance - Record and cancel expenses', group: 'Finance' },
  { code: 'cash.close', name: 'Finance - Close the day\'s cash', group: 'Finance' },

  // Sales (enterprise E3.4)
  { code: 'price.manage', name: 'Sales - Manage price lists', group: 'Sales' },
  // v2 staff roles: making a sale and taking a payment are their own permissions (Salesman, Cashier).
  { code: 'sale.create', name: 'Make sales', group: 'Sales' },
  { code: 'payment.create', name: 'Take payments', group: 'Sales' },
  { code: 'INVENTORY_RESERVE', name: 'Inventory - Reserve/Release', group: 'Inventory' },
  
  // Reports
  { code: 'report.procurement', name: 'View Procurement Reports', group: 'Reports' },
  { code: 'report.sorting', name: 'View Sorting Reports', group: 'Reports' },
  { code: 'report.grading', name: 'View Grading Reports', group: 'Reports' },
  { code: 'report.inventory', name: 'View Inventory Reports', group: 'Reports' },
  { code: 'report.cost', name: 'View Cost Reports', group: 'Reports' },
  { code: 'report.worker', name: 'View Worker Reports', group: 'Reports' },
  { code: 'REPORTS_VIEW', name: 'Reports - View', group: 'Reports' },
  { code: 'REPORTS_EXPORT', name: 'Reports - Export', group: 'Reports' },

  // Data ownership (v2 5.6)
  { code: 'data.export', name: 'Export all business data', group: 'Data' },
  { code: 'data.import', name: 'Import customers, suppliers and stock from Excel', group: 'Data' },
  { code: 'cost.view', name: 'See costs and profit', group: 'Data' },
];

/** Creates or completes the base data; returns the SYSTEM business id. */
export async function ensureBaseData(prisma: PrismaClient): Promise<string> {
  const systemTenant = await prisma.tenant.upsert({
    where: { companyCode: SYSTEM_COMPANY_CODE },
    update: {},
    create: {
      name: 'System Administration',
      companyCode: SYSTEM_COMPANY_CODE,
      setupCompletedAt: new Date(),
      currency: 'USD',
      locale: 'en-US',
      status: TenantStatus.ACTIVE,
    },
  });

  const configs: Array<[string, Prisma.InputJsonValue, boolean]> = [
    // [key, value, overwrite]: the super admin business id must always point at this database's SYSTEM row.
    ['system.superAdminTenantId', { tenantId: systemTenant.id }, true],
    ['system.version', { version: '3.0.0', releaseDate: '2025-01-01' }, false],
    ['defaults.currency', { currency: 'USD', symbol: '$' }, false],
  ];
  for (const [key, valueJson, overwrite] of configs) {
    await prisma.globalConfig.upsert({ where: { key }, update: overwrite ? { valueJson } : {}, create: { key, valueJson } });
  }

  for (const template of CATEGORY_TEMPLATES) {
    const id = template.categoryName.toLowerCase().replace(/\s+/g, '-');
    await prisma.globalCategoryTemplate.upsert({ where: { id }, update: {}, create: { id, ...template } });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: permission.code }, update: {}, create: permission });
  }

  // "Admin" (the owner's role) holds every permission, including ones added by a later release.
  const all = await prisma.permission.findMany({ select: { id: true } });
  const admins = await prisma.role.findMany({ where: { name: 'Admin' }, select: { id: true } });
  if (admins.length) {
    await prisma.rolePermission.createMany({
      data: admins.flatMap((r) => all.map((p) => ({ roleId: r.id, permissionId: p.id }))),
      skipDuplicates: true,
    });
  }

  // Every business has the default waste type (same rule as migration v1_04 and tenant creation).
  await prisma.wasteCategory.upsert({
    where: { tenantId_name: { tenantId: systemTenant.id, name: 'Waste/Katran' } },
    update: {},
    create: { tenantId: systemTenant.id, name: 'Waste/Katran', unitType: 'KG', defaultResalePrice: 0 },
  });

  return systemTenant.id;
}

/**
 * Creates the first super admin if the SYSTEM business has no user yet. Never changes an existing
 * account. Returns false when a super admin already exists.
 */
export async function ensureFirstSuperAdmin(
  prisma: PrismaClient,
  systemTenantId: string,
  email: string,
  passwordHash: string,
): Promise<boolean> {
  const existing = await prisma.user.count({ where: { tenantId: systemTenantId } });
  if (existing > 0) return false;
  await prisma.user.create({
    data: { tenantId: systemTenantId, name: 'Super Admin', email: email.trim().toLowerCase(), passwordHash, isActive: true },
  });
  return true;
}
