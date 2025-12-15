import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

