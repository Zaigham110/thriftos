import { Injectable, NotFoundException } from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StockMovementService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: { inventoryItemId?: string; movementType?: MovementType; page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      inventoryItem: { tenantId },
      ...(options?.inventoryItemId && { inventoryItemId: options.inventoryItemId }),
      ...(options?.movementType && { movementType: options.movementType }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inventoryItem: {
            select: {
              id: true,
              repackUnit: { select: { id: true, unitCode: true } },
              category: { select: { id: true, name: true } },
              grade: { select: { id: true, name: true } },
              warehouse: { select: { id: true, name: true, code: true } },
              status: true,
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, inventoryItem: { tenantId } },
      include: {
        inventoryItem: {
          include: {
            repackUnit: { select: { id: true, unitCode: true } },
            category: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }
}


