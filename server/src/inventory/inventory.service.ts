import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * INVENTORY SERVICE - READ-ONLY
 * ==============================
 * Inventory is NOT a workflow.
 * Inventory is created ONLY when repack units are SEALED.
 * This service provides READ-ONLY access to finalized goods.
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
      categoryId?: string;
      gradeId?: string;
      warehouseId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.gradeId) where.gradeId = filters.gradeId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.status) where.status = filters.status;

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
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryId, tenantId },
      include: {
        repackUnit: {
          include: {
            inputAllocations: {
              include: {
                gradingOutput: {
                  include: {
                    grade: true,
                    gradeBucket: {
                      include: {
                        gradeSession: {
                          include: {
                            categoryOutput: {
                              include: {
                                category: true,
                                sortCategoryBucket: {
                                  include: {
                                    sortSession: {
                                      include: {
                                        rag: {
                                          include: {
                                            container: {
                                              include: {
                                                purchaseOrder: {
                                                  include: {
                                                    vendor: true,
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
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
      sourceAllocations: item.repackUnit.inputAllocations.map((alloc: any) => {
        const go = alloc.gradingOutput;
        const bucket = go?.gradeBucket;
        const session = bucket?.gradeSession;
        const catOutput = session?.categoryOutput;
        const sortBucket = catOutput?.sortCategoryBucket;
        const sortSess = sortBucket?.sortSession;
        const rag = sortSess?.rag;
        const container = rag?.container;
        const po = container?.purchaseOrder;

        return {
          allocationId: alloc.id,
          amountUsed: alloc.amountUsed,
          measurementType: alloc.measurementType,
          gradingOutput: {
            id: go?.id,
            weightKg: go?.weightKg,
            count: go?.count,
            grade: go?.grade,
            gradeSession: {
              id: session?.id,
              startTime: session?.startTime,
              endTime: session?.endTime,
            },
            categoryOutput: {
              id: catOutput?.id,
              weightKg: catOutput?.weightKg,
              category: catOutput?.category,
              sortSession: {
                id: sortSess?.id,
                sessionCode: sortSess?.sessionCode,
                startTime: sortSess?.startTime,
                endTime: sortSess?.endTime,
                rag: rag ? {
                  id: rag.id,
                  ragCode: rag.ragCode,
                  ragType: rag.ragType,
                  initialWeightKg: rag.initialWeightKg,
                  container: container ? {
                    id: container.id,
                    containerNumber: container.containerNumber,
                    purchaseOrder: po ? {
                      id: po.id,
                      poNumber: po.poNumber,
                      vendor: po.vendor,
                    } : null,
                  } : null,
                } : null,
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

      // Total weight
      this.prisma.inventoryItem.aggregate({
        where: { tenantId, status: 'AVAILABLE' },
        _sum: { weightKg: true },
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
      totalWeight: Number(totalWeight._sum.weightKg || 0),
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
