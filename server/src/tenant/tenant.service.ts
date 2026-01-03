import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
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

    return tenant;
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
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getStats(tenantId: string) {
    const [users, roles, categories, grades, warehouses] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.role.count({ where: { tenantId } }),
      this.prisma.category.count({ where: { tenantId, isActive: true } }),
      this.prisma.grade.count({ where: { tenantId, isActive: true } }),
      this.prisma.warehouse.count({ where: { tenantId } }),
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

