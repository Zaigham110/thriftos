import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WasteUnitType } from '@prisma/client';

@Injectable()
export class WasteService {
  constructor(private prisma: PrismaService) {}

  async listCategories(tenantId: string) {
    return this.prisma.wasteCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listAllCategories(tenantId: string) {
    return this.prisma.wasteCategory.findMany({
      where: { tenantId },
      include: { linkedCategory: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getCategory(tenantId: string, id: string) {
    const category = await this.prisma.wasteCategory.findFirst({
      where: { id, tenantId },
      include: { linkedCategory: { select: { id: true, name: true } } },
    });

    if (!category) throw new NotFoundException('Waste category not found');
    return category;
  }

  async createCategory(tenantId: string, dto: { name: string; unitType: WasteUnitType; defaultResalePrice: number }) {
    // Prevent duplicate names (unique constraint will also catch this)
    const existing = await this.prisma.wasteCategory.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException('Waste category with this name already exists');
    }

    return this.prisma.wasteCategory.create({
      data: {
        tenantId,
        name: dto.name,
        unitType: dto.unitType,
        defaultResalePrice: new Decimal(dto.defaultResalePrice),
        isSystemGenerated: false, // Manual waste categories
      },
    });
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: { name?: string; unitType?: WasteUnitType; defaultResalePrice?: number; isActive?: boolean },
  ) {
    const existing = await this.prisma.wasteCategory.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Waste category not found');

    // Prevent changing unit type on system-generated waste categories
    if (existing.isSystemGenerated && dto.unitType && dto.unitType !== existing.unitType) {
      throw new BadRequestException('Cannot change unit type on system-generated waste categories');
    }

    // Prevent renaming system-generated waste categories
    if (existing.isSystemGenerated && dto.name) {
      throw new BadRequestException('Cannot rename system-generated waste categories. Edit the linked category instead.');
    }

    return this.prisma.wasteCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && !existing.isSystemGenerated ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.unitType !== undefined && !existing.isSystemGenerated ? { unitType: dto.unitType } : {}),
        ...(dto.defaultResalePrice !== undefined ? { defaultResalePrice: new Decimal(dto.defaultResalePrice) } : {}),
      },
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.prisma.wasteCategory.findFirst({
      where: { id, tenantId },
    });
    if (!category) throw new NotFoundException('Waste category not found');

    if (category.isSystemGenerated) {
      throw new BadRequestException('Cannot delete system-generated waste categories');
    }

    const usageCount = await this.prisma.wasteLineItem.count({
      where: { tenantId, wasteCategoryId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete waste category: it has been used in waste records. Deactivate instead.'
      );
    }

    return this.prisma.wasteCategory.delete({ where: { id } });
  }
}
