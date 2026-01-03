"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(tenantId, filters) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 50;
        const skip = (page - 1) * limit;
        const where = { tenantId };
        if (filters?.categoryId)
            where.categoryId = filters.categoryId;
        if (filters?.gradeId)
            where.gradeId = filters.gradeId;
        if (filters?.warehouseId)
            where.warehouseId = filters.warehouseId;
        if (filters?.status)
            where.status = filters.status;
        if (filters?.fromDate || filters?.toDate) {
            where.createdAt = {};
            if (filters.fromDate)
                where.createdAt.gte = new Date(filters.fromDate);
            if (filters.toDate)
                where.createdAt.lte = new Date(filters.toDate);
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
                            qrLabel: { select: { qrCode: true } },
                        },
                    },
                },
            }),
            this.prisma.inventoryItem.count({ where }),
        ]);
        const totalWeight = items
            .filter((i) => i.weightKg)
            .reduce((sum, i) => sum + Number(i.weightKg), 0);
        const totalPcs = items.reduce((sum, i) => sum + i.pcsCount, 0);
        return {
            items,
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
    async findOne(tenantId, id) {
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
            throw new common_1.NotFoundException('Inventory item not found');
        }
        return item;
    }
    async getTraceability(tenantId, inventoryId) {
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
            throw new common_1.NotFoundException('Inventory item not found');
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
    async getSummary(tenantId) {
        const [totalItems, totalWeight, totalPcs, warehouses, byCategory, byGrade] = await Promise.all([
            this.prisma.inventoryItem.count({
                where: { tenantId, status: 'AVAILABLE' },
            }),
            this.prisma.inventoryItem.aggregate({
                where: { tenantId, status: 'AVAILABLE' },
                _sum: { weightKg: true },
            }),
            this.prisma.inventoryItem.aggregate({
                where: { tenantId, status: 'AVAILABLE' },
                _sum: { pcsCount: true },
            }),
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
            this.prisma.inventoryItem.groupBy({
                by: ['categoryId'],
                where: { tenantId, status: 'AVAILABLE' },
                _count: true,
                _sum: { weightKg: true, pcsCount: true },
            }),
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
    async getFilterOptions(tenantId) {
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
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map