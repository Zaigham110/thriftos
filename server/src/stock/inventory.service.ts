import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only views of sellable stock. Items are created when a bale is made (BaleService) or when
 * stock is bought ready to sell or opened into pieces (DirectStockService).
 */

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all inventory items with filters
   */
  async findAll(
    tenantId: string,
    filters?: {
      source?: string;
      categoryId?: string;
      gradeId?: string;
      warehouseId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
      query?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters?.source) where.source = filters.source;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.gradeId) where.gradeId = filters.gradeId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.status) where.status = filters.status;

    if (filters?.query?.trim()) {
      const query = filters.query.trim();
      where.OR = [
        { id: query },
        { name: { contains: query, mode: 'insensitive' } },
        { repackUnit: { is: { unitCode: { contains: query, mode: 'insensitive' } } } },
        { repackUnit: { is: { qrLabel: { is: { qrCode: { contains: query, mode: 'insensitive' } } } } } },
      ];
    }

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          repackUnit: {
            select: {
              id: true,
              unitCode: true,
              status: true,
              measurementType: true,
              qrLabel: { select: { qrCode: true } },
            },
          },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    // Compatibility fields: clients expect these at the top level.
    const itemsWithCodes = items.map((item: any) => ({
      ...item,
      remainingQuantity: item.quantity.sub(item.usedQuantity),
      unitCode: item?.repackUnit?.unitCode ?? null,
      measurementType: item?.repackUnit?.measurementType ?? null,
      qrCode: item?.repackUnit?.qrLabel?.qrCode ?? null,
    }));

    // Calculate totals
    const totalWeight = items
      .filter((i) => i.weightKg)
      .reduce((sum, i) => sum + Number(i.weightKg), 0);

    const totalPcs = items.reduce((sum, i) => sum + i.pcsCount, 0);

    return {
      items: itemsWithCodes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregates: {
        totalWeight,
        totalPcs,
      },
    };
  }

  /**
   * Get single inventory item by ID
   */
  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        parentItem: { select: { id: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        repackUnit: {
          select: {
            id: true,
            unitCode: true,
            status: true,
            measurementType: true,
            targetAmount: true,
            createdAt: true,
            qrLabel: { select: { qrCode: true } },
          },
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            movementType: true,
            quantityKg: true,
            quantityPcs: true,
            createdAt: true,
            metadataJson: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return {
      ...item,
      remainingQuantity: item.quantity.sub(item.usedQuantity),
      unitCode: (item as any)?.repackUnit?.unitCode ?? null,
      measurementType: (item as any)?.repackUnit?.measurementType ?? null,
      qrCode: (item as any)?.repackUnit?.qrLabel?.qrCode ?? null,
    };
  }

  /**
   * Get full traceability chain for an inventory item
   * This traces back through:
   * InventoryItem → RepackUnit → RepackInputAllocations → GradingOutputs
   *   → GradeBuckets → GradeSessions → CategoryOutputs → SortSessions
   *   → Rags/Bales → Containers/POs
   */
  async getTraceability(tenantId: string, inventoryId: string) {
    const lineage = {
      include: {
        category: true,
        sortCategoryBucket: {
          include: {
            sortSession: {
              include: {
                rag: {
                  include: {
                    vendor: { select: { id: true, name: true } },
                    container: {
                      include: {
                        vendor: { select: { id: true, name: true } },
                        purchaseOrder: { select: { id: true, poNumber: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryId, tenantId },
      include: {
        repackUnit: {
          include: {
            inputAllocations: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              include: {
                categoryOutput: lineage,
                gradingOutput: {
                  include: {
                    grade: true,
                    gradeBucket: { include: { gradeSession: { include: { categoryOutput: lineage } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    if (!item.repackUnit) {
      return { inventoryItem: { id: item.id, createdAt: item.createdAt }, repackUnit: null, sourceAllocations: [] };
    }

    return {
      inventoryItem: {
        id: item.id,
        createdAt: item.createdAt,
      },
      repackUnit: {
        id: item.repackUnit.id,
        unitCode: item.repackUnit.unitCode,
        status: item.repackUnit.status,
        createdAt: item.repackUnit.createdAt,
      },
      sourceAllocations: item.repackUnit.inputAllocations.map((alloc) => {
        const go = alloc.gradingOutput;
        const session = go?.gradeBucket.gradeSession;
        const catOutput = session?.categoryOutput ?? alloc.categoryOutput;
        const sortSess = catOutput?.sortCategoryBucket.sortSession;
        const rag = sortSess?.rag;
        const container = rag?.container;
        return {
          allocationId: alloc.id,
          amountUsed: alloc.amountUsed,
          allocatedCost: alloc.allocatedCost,
          measurementType: alloc.measurementType,
          source: go ? 'GRADE' : 'CATEGORY',
          gradingOutput: {
            id: go?.id,
            weightKg: go?.weightKg,
            count: go?.count,
            grade: go?.grade ?? null,
            gradeSession: session ? { id: session.id, startTime: session.startTime, endTime: session.endTime } : null,
            categoryOutput: {
              id: catOutput?.id,
              weightKg: catOutput?.weightKg,
              category: catOutput?.category,
              sortSession: {
                id: sortSess?.id,
                startTime: sortSess?.startTime,
                endTime: sortSess?.endTime,
                rag: rag
                  ? {
                      id: rag.id,
                      ragCode: rag.ragCode,
                      weightKg: rag.weightKg,
                      originCountry: rag.originCountry,
                      vendor: rag.vendor ?? container?.vendor ?? null,
                      container: container
                        ? {
                            id: container.id,
                            containerNumber: container.containerNumber,
                            vendor: container.vendor,
                            purchaseOrder: container.purchaseOrder,
                          }
                        : null,
                    }
                  : null,
              },
            },
          },
        };
      }),
    };
  }

  /**
   * Get inventory summary/KPIs
   */
  async getSummary(tenantId: string) {
    const [totalItems, totalWeight, totalPcs, warehouses, byCategory, byGrade] = await Promise.all([
      // Total items
      this.prisma.inventoryItem.count({
        where: { tenantId, status: 'AVAILABLE' },
      }),

      // Weight still in stock (part of a KG item or of a multi-bale item may be sold)
      this.prisma.inventoryItem.findMany({
        where: { tenantId, status: 'AVAILABLE', weightKg: { not: null } },
        select: { weightKg: true, quantity: true, usedQuantity: true },
      }),

      // Total pieces
      this.prisma.inventoryItem.aggregate({
        where: { tenantId, status: 'AVAILABLE' },
        _sum: { pcsCount: true },
      }),

      // Unique warehouses
      this.prisma.inventoryItem.findMany({
        where: { tenantId, status: 'AVAILABLE' },
        distinct: ['warehouseId'],
        select: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),

      // By category
      this.prisma.inventoryItem.groupBy({
        by: ['categoryId'],
        where: { tenantId, status: 'AVAILABLE' },
        _count: true,
        _sum: { weightKg: true, pcsCount: true },
      }),

      // By grade
      this.prisma.inventoryItem.groupBy({
        by: ['gradeId'],
        where: { tenantId, status: 'AVAILABLE' },
        _count: true,
        _sum: { weightKg: true, pcsCount: true },
      }),
    ]);

    return {
      totalItems,
      totalWeight: totalWeight.reduce((kg, i) => kg + Number(i.weightKg.mul(i.quantity.sub(i.usedQuantity)).div(i.quantity)), 0),
      totalPcs: totalPcs._sum.pcsCount || 0,
      warehouseCount: warehouses.length,
      warehouses: warehouses.map((w) => w.warehouse),
      byCategory,
      byGrade,
    };
  }

  /**
   * Get available filter options
   */
  async getFilterOptions(tenantId: string) {
    const [categories, grades, warehouses] = await Promise.all([
      this.prisma.category.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.grade.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      categories,
      grades,
      warehouses,
    };
  }
}
