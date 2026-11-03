// =============================================================
// 🌱 ThriftOS V3 - Database Seed Script
// =============================================================
// Run with: npx prisma db seed
// =============================================================

import { PrismaClient, TenantStatus, RagStatus, RagSourceType } from '../server/node_modules/.prisma/client';
import * as bcrypt from 'bcrypt';

// Refuse to seed anything but a *_test database unless ALLOW_DEV_MIGRATE=1 (see scripts/db-guard.js).
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../scripts/db-guard.js').assertSafeToMigrate('seed');

const prisma = new PrismaClient();

/** Every tenant gets a "Waste/Katran" waste type (same rule as migration v1_04 and tenant creation). */
async function ensureDefaultWasteCategory(tenantId: string) {
  await prisma.wasteCategory.upsert({
    where: { tenantId_name: { tenantId, name: 'Waste/Katran' } },
    update: {},
    create: { tenantId, name: 'Waste/Katran', unitType: 'KG', defaultResalePrice: 0 },
  });
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Starting ThriftOS V3 database seeding...\n');

  // =========================================================
  // 0. CREATE SUPER ADMIN USER (Global user without tenantId)
  // =========================================================
  console.log('👑 Creating Super Admin user...');
  
  // First we need a "system" tenant for the super admin
  // Super Admin is identified by having tenantId = null, but Prisma requires a valid tenant
  // So we'll create a special system tenant for super admins
  const systemTenant = await prisma.tenant.upsert({
    where: { companyCode: 'SYSTEM' },
    update: {},
    create: {
      name: 'System Administration',
      companyCode: 'SYSTEM',
      setupCompletedAt: new Date(),
      currency: 'USD',
      locale: 'en-US',
      status: TenantStatus.ACTIVE,
    },
  });

  const superAdminPassword = await hashPassword('SuperAdmin@123');
  
  // Note: For true Super Admin without tenant, we'll use a workaround
  // The system will check if user belongs to SYSTEM tenant to grant super admin rights
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email: 'superadmin@thriftos.com' } },
    update: {},
    create: {
      tenantId: systemTenant.id,
      name: 'Super Admin',
      email: 'superadmin@thriftos.com',
      passwordHash: superAdminPassword,
      isActive: true,
    },
  });

  console.log('   ✅ Super Admin created: superadmin@thriftos.com / SuperAdmin@123');

  // =========================================================
  // 1. SEED GLOBAL CONFIGURATIONS
  // =========================================================
  console.log('📦 Seeding GlobalConfig...');
  
  // Add system tenant ID to config for super admin detection
  await prisma.globalConfig.upsert({
    where: { key: 'system.superAdminTenantId' },
    update: { valueJson: { tenantId: systemTenant.id } },
    create: {
      key: 'system.superAdminTenantId',
      valueJson: { tenantId: systemTenant.id },
    },
  });
  
  await prisma.globalConfig.upsert({
    where: { key: 'system.version' },
    update: {},
    create: {
      key: 'system.version',
      valueJson: { version: '3.0.0', releaseDate: '2025-01-01' },
    },
  });

  await prisma.globalConfig.upsert({
    where: { key: 'defaults.currency' },
    update: {},
    create: {
      key: 'defaults.currency',
      valueJson: { currency: 'USD', symbol: '$' },
    },
  });

  // =========================================================
  // 2. SEED GLOBAL CATEGORY TEMPLATES
  // =========================================================
  console.log('📦 Seeding GlobalCategoryTemplate...');

  const categoryTemplates = [
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

  for (const template of categoryTemplates) {
    const id = template.categoryName.toLowerCase().replace(/\s+/g, '-');
    await prisma.globalCategoryTemplate.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...template,
      },
    });
  }

  // =========================================================
  // 3. SEED PERMISSIONS
  // =========================================================
  console.log('📦 Seeding Permissions...');

  const permissions = [
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
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
  }

  // The demo database (npm run demo:reset) gets only the base data here; its businesses are made by
  // server/src/demo/seed-demo.ts through the app's own services.
  if (process.env.SEED_BASE_ONLY === '1') {
    console.log('✅ Base data only (SEED_BASE_ONLY=1).');
    return;
  }

  // =========================================================
  // 4. SEED DEMO TENANT
  // =========================================================
  console.log('📦 Seeding Demo Tenant...');

  const demoTenant = await prisma.tenant.upsert({
    where: { companyCode: 'DEMO' },
    update: {},
    create: {
      name: 'Demo Thrift Company',
      companyCode: 'DEMO',
      status: TenantStatus.ACTIVE,
      // Seeded businesses are ready to use: no setup wizard (only new tenants get it).
      setupCompletedAt: new Date(),
    },
  });

  // =========================================================
  // 5. SEED DEMO CATEGORIES
  // =========================================================
  console.log('📦 Seeding Demo Categories...');

  const demoCategories = [
    { name: 'T-Shirts', sortOrder: 1 },
    { name: 'Jeans', sortOrder: 2 },
    { name: 'Dresses', sortOrder: 3 },
    { name: 'Jackets', sortOrder: 4 },
    { name: 'Shoes', sortOrder: 5 },
  ];

  for (const category of demoCategories) {
    await prisma.category.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: category.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        ...category,
        isActive: true,
      },
    });
  }

  // =========================================================
  // 5.5. SEED DEMO RAW CATEGORIES
  // =========================================================
  console.log('📦 Seeding Demo Raw Categories...');

  const demoRawCategories = [
    { name: 'Mixed Clothing - RAG', rawType: 'RAG', sortOrder: 1 },
    { name: 'Mixed Clothing - BALE', rawType: 'BALE', sortOrder: 2 },
    { name: 'Mixed Shoes', rawType: 'BOTH', sortOrder: 3 },
    { name: 'Mixed Accessories', rawType: 'BOTH', sortOrder: 4 },
    { name: 'Unsorted Textiles', rawType: 'RAG', sortOrder: 5 },
  ];

  for (const rawCategory of demoRawCategories) {
    await prisma.rawCategory.upsert({
      where: { 
        tenantId_name_rawType: { 
          tenantId: demoTenant.id, 
          name: rawCategory.name,
          rawType: rawCategory.rawType as any
        } 
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: rawCategory.name,
        rawType: rawCategory.rawType as any,
        sortOrder: rawCategory.sortOrder,
        isActive: true,
      },
    });
  }

  // =========================================================
  // 6. SEED DEMO GRADES
  // =========================================================
  console.log('📦 Seeding Demo Grades...');

  const demoGrades = [
    { name: 'Grade A', description: 'Premium quality - like new', rank: 1 },
    { name: 'Grade B', description: 'Good quality - minor wear', rank: 2 },
    { name: 'Grade C', description: 'Fair quality - visible wear', rank: 3 },
    { name: 'Grade D', description: 'Low quality - significant wear', rank: 4 },
    { name: 'Waste', description: 'Unsuitable for resale', rank: 5 },
  ];

  for (const grade of demoGrades) {
    await prisma.grade.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: grade.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        ...grade,
        isActive: true,
      },
    });
  }

  // =========================================================
  // 6.5. DEFAULT WASTE TYPE (every tenant needs one to close a lot with a remainder)
  // =========================================================
  console.log('📦 Seeding default waste type...');

  for (const tenantId of [systemTenant.id, demoTenant.id]) {
    await ensureDefaultWasteCategory(tenantId);
  }

  // =========================================================
  // 7. SEED DEMO WAREHOUSE
  // =========================================================
  console.log('📦 Seeding Demo Warehouse...');

  await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: demoTenant.id, code: 'WH-001' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Main Warehouse',
      code: 'WH-001',
      location: 'Building A, Industrial Zone',
    },
  });

  // =========================================================
  // 8. SEED DEMO ROLES
  // =========================================================
  console.log('📦 Seeding Demo Roles...');

  const demoRoles = [
    { name: 'Admin', description: 'Full access to all features' },
    { name: 'Manager', description: 'Manage operations and view reports' },
    { name: 'Supervisor', description: 'Oversee sorting and grading operations' },
    { name: 'Sorting Staff', description: 'Perform sorting operations' },
    { name: 'Grading Staff', description: 'Perform grading operations' },
    { name: 'Warehouse Staff', description: 'Manage inventory and stock movements' },
    { name: 'Procurement', description: 'Manage purchase orders and containers' },
    { name: 'Accountant', description: 'View cost and financial reports' },
    { name: 'Read Only', description: 'View-only access' },
  ];

  for (const role of demoRoles) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: role.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        ...role,
      },
    });
  }

  // =========================================================
  // 9. SEED DEMO ADMIN USER
  // =========================================================
  console.log('📦 Seeding Demo Admin User...');

  // Hash the demo admin password
  const demoAdminPassword = 'admin123';
  const demoAdminPasswordHash = await bcrypt.hash(demoAdminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'admin@demo.thriftos.com' } },
    update: { passwordHash: demoAdminPasswordHash },
    create: {
      tenantId: demoTenant.id,
      name: 'Demo Admin',
      email: 'admin@demo.thriftos.com',
      passwordHash: demoAdminPasswordHash,
      isActive: true,
    },
  });
  console.log('   ✅ Demo Admin created: admin@demo.thriftos.com / admin123');

  // Assign Admin role to admin user
  const adminRole = await prisma.role.findFirst({
    where: { tenantId: demoTenant.id, name: 'Admin' },
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    // Assign all permissions to Admin role
    const allPermissions = await prisma.permission.findMany();
    for (const permission of allPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // =========================================================
  // 10. SEED DEMO VENDOR (Phase 2.5)
  // =========================================================
  console.log('📦 Seeding Demo Vendor...');

  const demoVendor = await prisma.vendor.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: 'Global Thrift Suppliers' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Global Thrift Suppliers',
      country: 'USA',
      originCountry: 'USA',
      contactInfo: 'contact@globalthrift.com',
      isActive: true,
    },
  });

  // =========================================================
  // 11. SEED DEMO PURCHASE ORDER (Phase 2.5)
  // =========================================================
  console.log('📦 Seeding Demo Purchase Order...');

  const demoPO = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: demoTenant.id, poNumber: 'PO-2025-001' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      vendorId: demoVendor.id,
      poNumber: 'PO-2025-001',
      poType: 'CONTAINER',
      currency: 'PKR',
      totalCost: 1650.0,
      status: 'RECEIVED',
    },
  });

  // =========================================================
  // 12. SEED DEMO CONTAINER (Phase 2.5)
  // =========================================================
  console.log('📦 Seeding Demo Container...');

  const demoContainer = await prisma.container.upsert({
    where: { tenantId_containerNumber: { tenantId: demoTenant.id, containerNumber: 'CONT-2025-001' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      purchaseOrderId: demoPO.id,
      vendorId: demoVendor.id,
      originCountry: 'USA',
      containerNumber: 'CONT-2025-001',
      referenceNumber: 'REF-001',
      containerType: '40ft',
      eta: new Date('2025-01-10T00:00:00.000Z'),
      etd: new Date('2024-12-28T00:00:00.000Z'),
      arrivedAt: new Date('2025-01-14T00:00:00.000Z'),
      grossWeight: 5500.0,
      tareWeight: 500.0,
      netWeight: 5000.0,
      // Landed cost 1,650 split by lot weight: 250 kg → 750, 300 kg → 900 (costing rules, docs/v1/03).
      purchaseCost: 1650.0,
      purchaseCurrency: 'PKR',
      landedCostPKR: 1650.0,
      landedCostPerKg: 3.0,
      billOfLadingNumber: 'BL-0001',
      shipmentReference: 'SHIP-0001',
      shippingLine: 'Maersk',
      vesselName: 'Ocean Spirit',
      portOfLoading: 'Hamburg',
      portOfDischarge: 'New York',
      forwarder: 'Global Forwarders',
      notes: 'Demo container for procurement tests',
      status: 'ARRIVED',
    },
  });

  // =========================================================
  // 13. SEED DEMO RAGS (Phase 2.5 - Rag/Bale Breakdown)
  // =========================================================
  // Phase 2.5 LOCKED RULES:
  // - Sorting MUST operate on a single Rag/Bale
  // - Each Rag can only be sorted ONCE (status lifecycle)
  // - Seed with NOT_STARTED status for sorting selection
  // =========================================================
  console.log('📦 Seeding Demo Rags (Phase 2.5)...');

  // Rag 1: From Container (NOT_STARTED - ready for sorting)
  await prisma.rag.upsert({
    where: { tenantId_ragCode: { tenantId: demoTenant.id, ragCode: 'RAG-2025-001' } },
    update: { status: RagStatus.NOT_STARTED },
    create: {
      tenantId: demoTenant.id,
      containerId: demoContainer.id,
      ragCode: 'RAG-2025-001',
      vendorId: demoVendor.id,
      originCountry: 'USA',
      weightKg: 250.00,
      allocatedCost: 750.00,
      sourceType: RagSourceType.CONTAINER,
      status: RagStatus.NOT_STARTED,  // Available for sorting
      notes: 'First rag from demo container',
    },
  });

  // Rag 2: From Container (NOT_STARTED - ready for sorting)
  await prisma.rag.upsert({
    where: { tenantId_ragCode: { tenantId: demoTenant.id, ragCode: 'RAG-2025-002' } },
    update: { status: RagStatus.NOT_STARTED },
    create: {
      tenantId: demoTenant.id,
      containerId: demoContainer.id,
      ragCode: 'RAG-2025-002',
      vendorId: demoVendor.id,
      originCountry: 'USA',
      weightKg: 300.00,
      allocatedCost: 900.00,
      sourceType: RagSourceType.CONTAINER,
      status: RagStatus.NOT_STARTED,  // Available for sorting
      notes: 'Second rag from demo container',
    },
  });

  // Rag 3: Loose Bale (NOT_STARTED - no container)
  // Phase 2.5: Loose bale = Rag with containerId = null
  await prisma.rag.upsert({
    where: { tenantId_ragCode: { tenantId: demoTenant.id, ragCode: 'LOOSE-2025-001' } },
    update: { status: RagStatus.NOT_STARTED },
    create: {
      tenantId: demoTenant.id,
      containerId: null,              // Loose bale - no container
      ragCode: 'LOOSE-2025-001',
      vendorId: demoVendor.id,
      originCountry: 'USA',
      weightKg: 150.00,
      purchaseCost: 400.00,
      allocatedCost: 400.00,
      sourceType: RagSourceType.LOOSE_BALE,
      status: RagStatus.NOT_STARTED,  // Available for sorting
      notes: 'Standalone loose bale (not from container)',
    },
  });

  // =========================================================
  // 14. SEED DEMO CUSTOMERS (Sales Module)
  // =========================================================
  console.log('📦 Seeding Demo Customers...');

  const demoCustomer1 = await prisma.customer.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: 'Apex Wholesale Outlets' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Apex Wholesale Outlets',
      companyName: 'Apex Outlets Inc',
      billingAddress: '100 Industrial Blvd, Suite 400, Chicago, IL 60601',
      shippingAddress: '100 Industrial Blvd, Port Dock 4, Chicago, IL 60601',
      contactEmail: 'orders@apexoutlets.com',
      contactPhone: '+1 (555) 234-5678',
      taxId: 'US-8874129',
      creditLimit: 50000.00,
      paymentTerms: 'NET_30',
      creditStatus: 'GOOD_STANDING',
      currencyCode: 'USD',
      isActive: true,
    },
  });

  const demoCustomer2 = await prisma.customer.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: 'Global Thrift Exports LLC' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Global Thrift Exports LLC',
      companyName: 'Global Thrift Exports',
      billingAddress: '450 Harbor Way, Miami, FL 33132',
      shippingAddress: '450 Harbor Way, Terminal 2, Miami, FL 33132',
      contactEmail: 'logistics@globalshippers.com',
      contactPhone: '+1 (555) 987-6543',
      taxId: 'US-9982341',
      creditLimit: 100000.00,
      paymentTerms: 'NET_60',
      creditStatus: 'GOOD_STANDING',
      currencyCode: 'USD',
      isActive: true,
    },
  });

  const demoCustomer3 = await prisma.customer.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: 'Vintage Apparel Buyers' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Vintage Apparel Buyers',
      companyName: 'Vintage Apparel Co',
      billingAddress: '782 Fashion District, New York, NY 10018',
      shippingAddress: '782 Fashion District, New York, NY 10018',
      contactEmail: 'buyers@vintageapparel.com',
      contactPhone: '+1 (555) 345-6789',
      taxId: 'US-1122334',
      creditLimit: 25000.00,
      paymentTerms: 'PREPAID',
      creditStatus: 'GOOD_STANDING',
      currencyCode: 'USD',
      isActive: true,
    },
  });

  console.log('   ✅ 3 Demo Customers created: Apex Wholesale, Global Thrift Exports, Vintage Apparel');

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log('   - GlobalConfig entries created');
  console.log('   - GlobalCategoryTemplate entries created');
  console.log('   - Permissions seeded');
  console.log('   - Demo Tenant: "Demo Thrift Company" (DEMO)');
  console.log('   - Demo Categories: T-Shirts, Jeans, Dresses, Jackets, Shoes');
  console.log('   - Demo Grades: A, B, C, D, Waste');
  console.log('   - Demo Warehouse: Main Warehouse (WH-001)');
  console.log('   - Demo Roles: Admin, Manager, Supervisor, etc.');
  console.log('   - Demo Admin User: admin@demo.thriftos.com');
  console.log('   - Demo Vendor: Global Thrift Suppliers');
  console.log('   - Demo PO: PO-2025-001');
  console.log('   - Demo Container: CONT-2025-001');
  console.log('   - Demo Rags: RAG-2025-001, RAG-2025-002 (container), LOOSE-2025-001 (loose)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

