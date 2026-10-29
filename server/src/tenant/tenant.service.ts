import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';
import { getCurrencyMeta, isSupportedCurrencyCode } from '../common/currency/currency';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  private defaultWarehouseKey(tenantId: string): string {
    return `tenant.${tenantId}.defaultWarehouseId`;
  }

  private async getDefaultWarehouseId(tenantId: string): Promise<string | null> {
    const config = await this.prisma.globalConfig.findUnique({
      where: { key: this.defaultWarehouseKey(tenantId) },
    });

    const warehouseId = (config?.valueJson as any)?.warehouseId;
    return typeof warehouseId === 'string' && warehouseId.length > 0 ? warehouseId : null;
  }

  private async setDefaultWarehouseId(tenantId: string, warehouseId: string): Promise<void> {
    await this.prisma.globalConfig.upsert({
      where: { key: this.defaultWarehouseKey(tenantId) },
      update: { valueJson: { warehouseId } },
      create: { key: this.defaultWarehouseKey(tenantId), valueJson: { warehouseId } },
    });
  }

  private async ensureValidDefaultWarehouseId(tenantId: string): Promise<string | null> {
    const defaultId = await this.getDefaultWarehouseId(tenantId);
    if (defaultId) {
      const exists = await this.prisma.warehouse.findFirst({
        where: { id: defaultId, tenantId, isActive: true },
        select: { id: true },
      });
      if (exists) return defaultId;
    }

    const firstActive = await this.prisma.warehouse.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    });

    if (!firstActive) return null;

    await this.setDefaultWarehouseId(tenantId, firstActive.id);
    return firstActive.id;
  }

  async findOne(id: string) {
    const currencyLocked = await this.isCurrencyLocked(id);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            roles: true,
            categories: true,
            grades: true,
            warehouses: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    const currencyMeta = getCurrencyMeta(tenant.currency);

    return {
      ...tenant,
      currencyCode: tenant.currency,
      currency: currencyMeta,
      currencyLocked,
    };
  }

  async getWorkQueue(tenantId: string, userId: string) {
    const [readyRags, activeSorting, activeGrading, draftRepacks, availableInventory, blockedRepacks] = await Promise.all([
      this.prisma.rag.count({ where: { tenantId, status: 'NOT_STARTED' } }),
      this.prisma.sortSession.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.gradeSession.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.repackUnit.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.inventoryItem.count({ where: { tenantId, status: 'AVAILABLE' } }),
      this.prisma.repackUnit.count({
        where: { tenantId, status: 'DRAFT', inputAllocations: { none: {} } },
      }),
    ]);

    const [assignedSorting, assignedGrading, assignedRepack] = await Promise.all([
      this.prisma.sortSession.findMany({
        where: { tenantId, workerId: userId, status: 'OPEN' },
        take: 6,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, updatedAt: true, rag: { select: { ragCode: true } } },
      }),
      this.prisma.gradeSession.findMany({
        where: { tenantId, workerId: userId, status: 'OPEN' },
        take: 6,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, updatedAt: true, categoryOutput: { select: { category: { select: { name: true } } } } },
      }),
      this.prisma.repackSession.findMany({
        where: { tenantId, workerId: userId, status: 'OPEN' },
        take: 4,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, updatedAt: true },
      }),
    ]);

    return {
      summary: { readyRags, activeSorting, activeGrading, draftRepacks, availableInventory, blockedRepacks },
      blockers: blockedRepacks > 0
        ? [{
          type: 'REPACK_ALLOCATION_REQUIRED',
          count: blockedRepacks,
          title: `${blockedRepacks} repack ${blockedRepacks === 1 ? 'draft needs' : 'drafts need'} source allocation`,
          detail: 'A repack unit cannot be sealed or become sellable until its graded source is allocated.',
          route: '/app/lite/repack',
        }]
        : [],
      tasks: [
        ...assignedSorting.map((session) => ({
          id: session.id,
          type: 'SORTING_SESSION',
          title: `Resume sorting ${session.rag.ragCode}`,
          route: `/app/lite/sorting?resumeSort=${session.id}`,
          updatedAt: session.updatedAt,
        })),
        ...assignedGrading.map((session) => ({
          id: session.id,
          type: 'GRADING_SESSION',
          title: `Resume grading ${session.categoryOutput.category.name}`,
          route: `/app/lite/sorting?stage=2&resumeGrade=${session.id}`,
          updatedAt: session.updatedAt,
        })),
        ...assignedRepack.map((session) => ({
          id: session.id,
          type: 'REPACK_SESSION',
          title: 'Resume repack session',
          route: `/app/lite/repack?resume=${session.id}`,
          updatedAt: session.updatedAt,
        })),
      ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      nextAction: readyRags > 0
        ? { label: 'Start category sorting', route: '/app/lite/sorting' }
        : draftRepacks > 0
          ? { label: 'Complete repack drafts', route: '/app/lite/repack' }
          : { label: 'Review available stock', route: '/app/lite/lookup' },
    };
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const desiredCurrency = dto.currencyCode;
    if (desiredCurrency && !isSupportedCurrencyCode(desiredCurrency)) {
      throw new BadRequestException(`Unsupported currency code: ${desiredCurrency}`);
    }

    if (desiredCurrency && desiredCurrency !== tenant.currency) {
      const locked = await this.isCurrencyLocked(tenantId);
      if (locked) {
        throw new BadRequestException(
          'Currency cannot be changed after purchase orders, inventory, or reports exist.',
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(desiredCurrency ? { currency: desiredCurrency } : {}),
        ...(dto.locale ? { locale: dto.locale } : {}),
        ...(dto.operationMode ? { operationMode: dto.operationMode } : {}),
        ...(dto.connectivityPolicy ? { connectivityPolicy: dto.connectivityPolicy } : {}),
        ...(dto.capturePolicy ? { capturePolicy: dto.capturePolicy } : {}),
        ...(dto.guidancePolicy ? { guidancePolicy: dto.guidancePolicy } : {}),
        ...(dto.flowEnabled !== undefined ? { flowEnabled: dto.flowEnabled } : {}),
        ...(dto.operationalModules ? { operationalModules: dto.operationalModules } : {}),
      },
      include: {
        _count: {
          select: {
            users: true,
            roles: true,
            categories: true,
            grades: true,
            warehouses: true,
          },
        },
      },
    });

    const currencyMeta = getCurrencyMeta(updated.currency);
    const currencyLocked = await this.isCurrencyLocked(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TENANT_SETTINGS_UPDATED',
        entityType: 'Tenant',
        entityId: tenantId,
        metadataJson: {
          changes: {
            ...(desiredCurrency ? { currencyCode: desiredCurrency } : {}),
            ...(dto.locale ? { locale: dto.locale } : {}),
            ...(dto.operationMode ? { operationMode: dto.operationMode } : {}),
            ...(dto.connectivityPolicy ? { connectivityPolicy: dto.connectivityPolicy } : {}),
            ...(dto.capturePolicy ? { capturePolicy: dto.capturePolicy } : {}),
            ...(dto.guidancePolicy ? { guidancePolicy: dto.guidancePolicy } : {}),
            ...(dto.flowEnabled !== undefined ? { flowEnabled: dto.flowEnabled } : {}),
            ...(dto.operationalModules ? { operationalModules: dto.operationalModules } : {}),
          },
        },
      },
    });

    return {
      ...updated,
      currencyCode: updated.currency,
      currency: currencyMeta,
      currencyLocked,
    };
  }

  private async isCurrencyLocked(tenantId: string): Promise<boolean> {
    const [poCount, inventoryCount, reportAuditCount] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId } }),
      this.prisma.inventoryItem.count({ where: { tenantId } }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          action: { in: ['REPORT_ACCESSED', 'REPORT_EXPORTED'] },
        },
      }),
    ]);

    return poCount > 0 || inventoryCount > 0 || reportAuditCount > 0;
  }

  async getCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAllCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  /**
   * Create Category with automatic WasteCategory generation.
   * ATOMIC: Both Category and WasteCategory created in same transaction.
   */
  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          tenantId,
          name: dto.name,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      // AUTO-CREATE linked waste category
      await tx.wasteCategory.create({
        data: {
          tenantId,
          name: `${dto.name} Waste`,
          linkedCategoryId: category.id,
          unitType: 'KG', // Default to KG for categories
          defaultResalePrice: 0,
          isSystemGenerated: true,
          isActive: true,
        },
      });

      return category;
    });
  }

  /**
   * Update Category with cascading updates to linked WasteCategory.
   * ATOMIC: Both Category and WasteCategory updated in same transaction.
   */
  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id, tenantId },
        include: { linkedWasteCategory: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      // CASCADE: Update linked waste category if exists
      if (category.linkedWasteCategory) {
        await tx.wasteCategory.update({
          where: { id: category.linkedWasteCategory.id },
          data: {
            ...(dto.name && { name: `${dto.name} Waste` }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
        });
      }

      return updated;
    });
  }

  /**
   * Delete Category only if not referenced in sorting history.
   * ATOMIC: Check references, delete Category + linked WasteCategory.
   */
  async deleteCategory(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id, tenantId },
        include: {
          linkedWasteCategory: true,
          _count: {
            select: {
              sortCategoryBuckets: true,
              categoryOutputs: true,
            },
          },
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const hasHistory =
        category._count.sortCategoryBuckets > 0 ||
        category._count.categoryOutputs > 0;

      if (hasHistory) {
        throw new BadRequestException(
          'Cannot delete category: already used in sorting history. Deactivate instead.'
        );
      }

      // Delete linked waste category first (if exists)
      if (category.linkedWasteCategory) {
        await tx.wasteCategory.delete({
          where: { id: category.linkedWasteCategory.id },
        });
      }

      return tx.category.delete({ where: { id } });
    });
  }

  async getRawCategories(tenantId: string, type?: RagBaleType) {
    return this.prisma.rawCategory.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(type && { rawType: type }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createRawCategory(tenantId: string, dto: CreateRawCategoryDto) {
    return this.prisma.rawCategory.create({
      data: {
        tenantId,
        name: dto.name,
        rawType: dto.rawType,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateRawCategory(tenantId: string, id: string, dto: UpdateRawCategoryDto) {
    const category = await this.prisma.rawCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Raw category not found');
    }

    return this.prisma.rawCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteRawCategory(tenantId: string, id: string) {
    const category = await this.prisma.rawCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Raw category not found');
    }

    return this.prisma.rawCategory.delete({
      where: { id },
    });
  }

  async getGrades(tenantId: string) {
    return this.prisma.grade.findMany({
      where: { tenantId, isActive: true },
      orderBy: { rank: 'asc' },
    });
  }

  async getWarehouses(tenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAllWarehouses(tenantId: string) {
    const [warehouses, defaultWarehouseId] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      this.ensureValidDefaultWarehouseId(tenantId),
    ]);

    return warehouses.map((w) => ({
      ...w,
      isDefault: defaultWarehouseId ? w.id === defaultWarehouseId : false,
    }));
  }

  async getWarehouse(tenantId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { tenantId, code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Warehouse code "${dto.code}" already exists`);
    }

    const created = await this.prisma.warehouse.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        location: dto.location,
        isActive: true,
      },
    });

    const defaultId = await this.getDefaultWarehouseId(tenantId);
    if (!defaultId) {
      await this.setDefaultWarehouseId(tenantId, created.id);
    }

    return created;
  }

  async updateWarehouse(tenantId: string, id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    if (dto.code && dto.code !== warehouse.code) {
      const existing = await this.prisma.warehouse.findFirst({
        where: { tenantId, code: dto.code, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(`Warehouse code "${dto.code}" already exists`);
      }
    }

    if (dto.isActive === false) {
      const defaultId = await this.ensureValidDefaultWarehouseId(tenantId);
      if (defaultId && defaultId === id) {
        throw new BadRequestException(
          'Cannot deactivate default warehouse. Set another warehouse as default first.'
        );
      }

      const otherActiveCount = await this.prisma.warehouse.count({
        where: { tenantId, isActive: true, id: { not: id } },
      });
      if (otherActiveCount === 0) {
        throw new BadRequestException('Cannot deactivate the last active warehouse.');
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteWarehouse(tenantId: string, id: string) {
    const defaultId = await this.ensureValidDefaultWarehouseId(tenantId);
    if (defaultId && defaultId === id) {
      throw new BadRequestException(
        'Cannot delete default warehouse. Set another warehouse as default first.'
      );
    }

    const totalCount = await this.prisma.warehouse.count({
      where: { tenantId },
    });
    if (totalCount <= 1) {
      throw new BadRequestException('Cannot delete the last warehouse. At least one is required.');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { inventoryItems: true },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    if (warehouse._count.inventoryItems > 0) {
      throw new BadRequestException(
        'Cannot delete warehouse: it is referenced by inventory items. Deactivate instead.'
      );
    }

    return this.prisma.warehouse.delete({ where: { id } });
  }

  async setDefaultWarehouse(tenantId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId, isActive: true },
      select: { id: true },
    });

    if (!warehouse) {
      throw new BadRequestException('Invalid warehouse. Only active warehouses can be set as default.');
    }

    await this.setDefaultWarehouseId(tenantId, warehouseId);
    return { warehouseId };
  }

  async getStats(tenantId: string) {
    const [users, roles, categories, grades, warehouses] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.role.count({ where: { tenantId } }),
      this.prisma.category.count({ where: { tenantId, isActive: true } }),
      this.prisma.grade.count({ where: { tenantId, isActive: true } }),
      this.prisma.warehouse.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      users,
      roles,
      categories,
      grades,
      warehouses,
    };
  }
}
