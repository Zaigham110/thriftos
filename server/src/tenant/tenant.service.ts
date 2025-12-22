import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';

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

