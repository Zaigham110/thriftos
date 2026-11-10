import { DEFAULT_GRADES, KARACHI_CATEGORIES } from '../tenant/setup-template';
import { Injectable } from '@nestjs/common';
import { Prisma, Permission, GlobalCategoryTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

export interface BootstrapResult {
  roles: number;
  permissions: number;
  categories: number;
  grades: number;
  wasteCategories: number;
  warehouses: number;
  adminUser?: {
    id: string;
    email: string;
  };
}

@Injectable()
export class TenantBootstrapService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
  ) {}

  async bootstrapTenant(
    tenantId: string,
    adminEmail?: string,
    adminName?: string,
    adminPassword?: string,
    /**
     * New business (v2 modules): the lists its type needs, from the same template the owner's setup offers —
     * categories when it sorts, grades only when it grades, one waste type. Without it: the older full set.
     */
    plain?: { sortingStages: number },
  ): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      roles: 0,
      permissions: 0,
      categories: 0,
      grades: 0,
      wasteCategories: 0,
      warehouses: 0,
    };

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create default roles
      const defaultRoles = [
        { name: 'Admin', description: 'Full access to all tenant features' },
        { name: 'Manager', description: 'Manage operations and view reports' },
        { name: 'Worker', description: 'Perform daily operations' },
        { name: 'ReadOnly', description: 'View-only access' },
      ];

      const createdRoles = await Promise.all(
        defaultRoles.map((role) =>
          tx.role.create({
            data: {
              tenantId,
              name: role.name,
              description: role.description,
            },
          }),
        ),
      );
      result.roles = createdRoles.length;

      // 2. Get all permissions
      const allPermissions = await tx.permission.findMany();
      result.permissions = allPermissions.length;

      // 3. Assign all permissions to Admin role
      const adminRole = createdRoles.find((r) => r.name === 'Admin');
      if (adminRole) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((p: Permission) => ({
            roleId: adminRole.id,
            permissionId: p.id,
          })),
        });
      }

      // 4. Assign limited permissions to Manager role
      const managerRole = createdRoles.find((r) => r.name === 'Manager');
      if (managerRole) {
        const managerPermissions = allPermissions.filter(
          (p: Permission) =>
            p.code.endsWith('.read') ||
            p.group === 'Reports' ||
            [
              'sort.session.create',
              'SORTING_STAGE1_CREATE',
              'grade.session.create',
              'SORTING_STAGE2_CREATE',
              'repack.session.create',
              'REPACK_CREATE',
              'INVENTORY_INTAKE',
              'REPORTS_VIEW',
              'REPORTS_EXPORT',
            ].includes(p.code),
        );
        await tx.rolePermission.createMany({
          data: managerPermissions.map((p: Permission) => ({
            roleId: managerRole.id,
            permissionId: p.id,
          })),
        });
      }

      // 5. Assign read permissions to Worker and ReadOnly roles
      const readPermissions = allPermissions.filter((p: Permission) => p.code.endsWith('.read'));
      const workerRole = createdRoles.find((r) => r.name === 'Worker');
      const readOnlyRole = createdRoles.find((r) => r.name === 'ReadOnly');

      if (workerRole) {
        const workerPermissions = allPermissions.filter(
          (p: Permission) =>
            p.code.endsWith('.read') ||
            [
              'sort.session.create',
              'sort.session.update',
              'SORTING_STAGE1_CREATE',
              'SORTING_STAGE1_EDIT',
              'grade.session.create',
              'grade.session.update',
              'SORTING_STAGE2_CREATE',
              'SORTING_STAGE2_EDIT',
              'REPACK_CREATE',
              'REPACK_EDIT',
              'INVENTORY_VIEW',
              'INVENTORY_INTAKE',
              'INVENTORY_ADJUST',
              'INVENTORY_RESERVE',
            ].includes(p.code),
        );
        await tx.rolePermission.createMany({
          data: workerPermissions.map((p: Permission) => ({
            roleId: workerRole.id,
            permissionId: p.id,
          })),
        });
      }

      if (readOnlyRole) {
        await tx.rolePermission.createMany({
          data: readPermissions.map((p: Permission) => ({
            roleId: readOnlyRole.id,
            permissionId: p.id,
          })),
        });
      }

      if (plain) {
        if (plain.sortingStages >= 1) {
          await tx.category.createMany({ data: KARACHI_CATEGORIES.map((name, i) => ({ tenantId, name, sortOrder: i, isActive: true })) });
          result.categories = KARACHI_CATEGORIES.length;
        }
        if (plain.sortingStages === 2) {
          await tx.grade.createMany({ data: DEFAULT_GRADES.map((name, i) => ({ tenantId, name, rank: i + 1, isActive: true })) });
          result.grades = DEFAULT_GRADES.length;
        }
      } else {
        // 6. Copy categories from GlobalCategoryTemplate
        const templates = await tx.globalCategoryTemplate.findMany();
        if (templates.length > 0) {
          await tx.category.createMany({
            data: templates.map((t: GlobalCategoryTemplate) => ({
              tenantId,
              name: t.categoryName,
              sortOrder: t.defaultSortPriority,
              isActive: true,
            })),
          });
          result.categories = templates.length;

          // AUTO-CREATE linked waste categories for each seeded category
          const seededCategories = await tx.category.findMany({
            where: { tenantId },
            select: { id: true, name: true },
          });

          await tx.wasteCategory.createMany({
            data: seededCategories.map((c) => ({
              tenantId,
              name: `${c.name} Waste`,
              linkedCategoryId: c.id,
              unitType: 'KG',
              defaultResalePrice: 0,
              isSystemGenerated: true,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }

        // 7. Create default grades
        const defaultGrades = [
          { name: 'Grade A', description: 'Premium quality', rank: 1 },
          { name: 'Grade B', description: 'Good quality', rank: 2 },
          { name: 'Grade C', description: 'Fair quality', rank: 3 },
          { name: 'Waste', description: 'Unsuitable for resale', rank: 4 },
        ];

        await tx.grade.createMany({
          data: defaultGrades.map((g) => ({
            tenantId,
            name: g.name,
            description: g.description,
            rank: g.rank,
            isActive: true,
          })),
        });
        result.grades = defaultGrades.length;
      }

      // 7.5 Default waste type, so a lot with a remainder can always be closed
      await tx.wasteCategory.upsert({
        where: { tenantId_name: { tenantId, name: 'Waste/Katran' } },
        update: {},
        create: { tenantId, name: 'Waste/Katran', unitType: 'KG', defaultResalePrice: 0 },
      });
      result.wasteCategories = await tx.wasteCategory.count({ where: { tenantId } });

      // 8. Create default warehouse
      const defaultWarehouse = await tx.warehouse.create({
        data: {
          tenantId,
          name: 'Main Warehouse',
          code: 'WH-001',
          location: 'Default Location',
        },
      });
      result.warehouses = 1;

      // Persist default warehouse per tenant (used by admin + operations)
      await tx.globalConfig.upsert({
        where: { key: `tenant.${tenantId}.defaultWarehouseId` },
        update: { valueJson: { warehouseId: defaultWarehouse.id } },
        create: {
          key: `tenant.${tenantId}.defaultWarehouseId`,
          valueJson: { warehouseId: defaultWarehouse.id },
        },
      });

      // 9. Create admin user if email and password provided
      if (adminEmail && adminPassword && adminRole) {
        const passwordHash = await this.passwordService.hash(adminPassword);

        const adminUser = await tx.user.create({
          data: {
            tenantId,
            name: adminName || 'Tenant Admin',
            email: adminEmail.toLowerCase(),
            passwordHash,
            isActive: true,
          },
        });

        // Assign Admin role to user
        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: adminRole.id,
          },
        });

        result.adminUser = {
          id: adminUser.id,
          email: adminUser.email,
        };
      }
    });

    return result;
  }
}

