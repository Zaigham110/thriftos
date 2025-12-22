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
exports.IncomingBaleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_allocation_service_1 = require("../cost-allocation/cost-allocation.service");
const client_1 = require("@prisma/client");
const tenant_sequence_service_1 = require("../shared/tenant-sequence.service");
let IncomingBaleService = class IncomingBaleService {
    constructor(prisma, auditService, costAllocationService, tenantSequenceService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costAllocationService = costAllocationService;
        this.tenantSequenceService = tenantSequenceService;
    }
    async create(tenantId, dto, userId) {
        let purchaseOrderId = dto.purchaseOrderId || null;
        if (dto.containerId) {
            const container = await this.prisma.container.findFirst({
                where: {
                    id: dto.containerId,
                    purchaseOrder: { tenantId },
                },
            });
            if (!container) {
                throw new common_1.BadRequestException('Container not found');
            }
            if (container.status === client_1.ContainerStatus.CLOSED) {
                throw new common_1.ConflictException('Cannot add bales to a closed container');
            }
            purchaseOrderId = container.purchaseOrderId;
        }
        else if (purchaseOrderId) {
            const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: purchaseOrderId,
                    tenantId,
                },
            });
            if (!purchaseOrder) {
                throw new common_1.BadRequestException('Purchase order not found');
            }
            if (purchaseOrder.poType !== client_1.PurchaseOrderType.LOOSE_BALE && purchaseOrder.poType !== client_1.PurchaseOrderType.HYBRID) {
                throw new common_1.BadRequestException('Purchase order type must allow loose bales');
            }
        }
        if (dto.vendorId) {
            const vendor = await this.prisma.vendor.findFirst({
                where: { id: dto.vendorId, tenantId },
            });
            if (!vendor) {
                throw new common_1.BadRequestException('Vendor not found');
            }
        }
        if (!dto.containerId && (dto.cost === undefined || dto.cost === null)) {
            throw new common_1.BadRequestException('Cost is required for standalone bales not linked to a container');
        }
        const rawCategory = await this.prisma.rawCategory.findFirst({
            where: { id: dto.rawCategoryId, tenantId, isActive: true },
        });
        if (!rawCategory) {
            throw new common_1.BadRequestException('Raw category not found');
        }
        const { code: baleCode } = await this.tenantSequenceService.generateCode(tenantId, client_1.SequenceScope.INCOMING_BALE, { prefix: dto.containerId ? 'CB' : 'BALE', padSize: 3 }, async (code) => {
            const collision = await this.prisma.incomingBale.findFirst({
                where: { tenantId, baleCode: code },
                select: { id: true },
            });
            return !collision;
        });
        const bale = await this.prisma.incomingBale.create({
            data: {
                tenantId,
                containerId: dto.containerId,
                purchaseOrderId,
                vendorId: dto.vendorId,
                baleCode,
                rawCategoryId: dto.rawCategoryId,
                weightKg: dto.weightKg,
                cost: dto.containerId ? 0 : dto.cost || 0,
            },
            include: {
                container: {
                    select: { containerNumber: true },
                },
                vendor: {
                    select: { name: true },
                },
                purchaseOrder: {
                    select: { id: true, poNumber: true },
                },
                rawCategory: {
                    select: { id: true, name: true, rawType: true },
                },
            },
        });
        if (dto.containerId) {
            await this.costAllocationService.allocateContainerCosts(dto.containerId, userId);
            const updatedBale = await this.prisma.incomingBale.findUnique({
                where: { id: bale.id },
                include: {
                    container: {
                        select: { containerNumber: true },
                    },
                    vendor: {
                        select: { name: true },
                    },
                    purchaseOrder: {
                        select: { id: true, poNumber: true },
                    },
                    rawCategory: {
                        select: { id: true, name: true, rawType: true },
                    },
                },
            });
            await this.auditService.log({
                userId,
                tenantId,
                action: 'INCOMING_BALE_CREATED',
                entityType: 'IncomingBale',
                entityId: bale.id,
                metadataJson: {
                    baleCode: bale.baleCode,
                    containerNumber: bale.container?.containerNumber,
                    weightKg: dto.weightKg,
                    rawCategory: rawCategory.name,
                },
            });
            return updatedBale;
        }
        await this.auditService.log({
            userId,
            tenantId,
            action: 'INCOMING_BALE_CREATED',
            entityType: 'IncomingBale',
            entityId: bale.id,
            metadataJson: {
                baleCode: bale.baleCode,
                vendorName: bale.vendor?.name,
                weightKg: dto.weightKg,
                cost: dto.cost,
                rawCategory: rawCategory.name,
            },
        });
        if (!dto.containerId && purchaseOrderId) {
            await this.costAllocationService.syncPurchaseOrderTotals(purchaseOrderId);
        }
        return bale;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.containerId && { containerId: options.containerId }),
            ...(options?.vendorId && { vendorId: options.vendorId }),
            ...(options?.purchaseOrderId && { purchaseOrderId: options.purchaseOrderId }),
        };
        if (options?.standalone === true) {
            where.containerId = null;
        }
        const [data, total] = await Promise.all([
            this.prisma.incomingBale.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    container: {
                        select: {
                            id: true,
                            containerNumber: true,
                            purchaseOrder: {
                                select: { id: true, poNumber: true },
                            },
                        },
                    },
                    vendor: {
                        select: { id: true, name: true },
                    },
                    purchaseOrder: {
                        select: { id: true, poNumber: true },
                    },
                    rawCategory: {
                        select: { id: true, name: true, rawType: true },
                    },
                },
            }),
            this.prisma.incomingBale.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const bale = await this.prisma.incomingBale.findFirst({
            where: { id, tenantId },
            include: {
                container: {
                    select: {
                        id: true,
                        containerNumber: true,
                        purchaseOrder: {
                            select: { id: true, poNumber: true, vendor: true },
                        },
                    },
                },
                vendor: true,
                sortSessions: {
                    select: { id: true, status: true },
                },
                purchaseOrder: {
                    select: {
                        id: true,
                        poNumber: true,
                        vendor: true,
                    },
                },
                rawCategory: {
                    select: { id: true, name: true, rawType: true },
                },
            },
        });
        if (!bale) {
            throw new common_1.NotFoundException('Incoming bale not found');
        }
        return bale;
    }
    async update(tenantId, id, dto, userId) {
        const bale = await this.findOne(tenantId, id);
        let targetPurchaseOrderId = bale.purchaseOrderId;
        if (bale.sortSessions.length > 0) {
            throw new common_1.ConflictException('Cannot modify bale that has been used in sorting');
        }
        if (dto.containerId !== undefined && dto.containerId !== bale.containerId) {
            if (dto.containerId) {
                const container = await this.prisma.container.findFirst({
                    where: {
                        id: dto.containerId,
                        purchaseOrder: { tenantId },
                    },
                });
                if (!container) {
                    throw new common_1.BadRequestException('Container not found');
                }
                if (container.status === client_1.ContainerStatus.CLOSED) {
                    throw new common_1.ConflictException('Cannot link to a closed container');
                }
                targetPurchaseOrderId = container.purchaseOrderId;
            }
        }
        if (dto.purchaseOrderId !== undefined && dto.containerId === undefined) {
            if (dto.purchaseOrderId) {
                const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
                    where: {
                        id: dto.purchaseOrderId,
                        tenantId,
                    },
                });
                if (!purchaseOrder) {
                    throw new common_1.BadRequestException('Purchase order not found');
                }
                if (purchaseOrder.poType !== client_1.PurchaseOrderType.LOOSE_BALE && purchaseOrder.poType !== client_1.PurchaseOrderType.HYBRID) {
                    throw new common_1.BadRequestException('Purchase order type must allow loose bales');
                }
                targetPurchaseOrderId = dto.purchaseOrderId;
            }
            else {
                targetPurchaseOrderId = null;
            }
        }
        if (dto.containerId === null) {
            targetPurchaseOrderId = dto.purchaseOrderId ?? targetPurchaseOrderId;
        }
        if (dto.vendorId !== undefined && dto.vendorId !== bale.vendorId) {
            if (dto.vendorId) {
                const vendor = await this.prisma.vendor.findFirst({
                    where: { id: dto.vendorId, tenantId },
                });
                if (!vendor) {
                    throw new common_1.BadRequestException('Vendor not found');
                }
            }
        }
        const oldContainerId = bale.containerId;
        const previousStandalonePoId = bale.containerId ? null : bale.purchaseOrder?.id ?? bale.purchaseOrderId;
        let rawCategoryNameToPersist;
        if (dto.rawCategoryId !== undefined && dto.rawCategoryId !== bale.rawCategoryId) {
            const rawCategory = await this.prisma.rawCategory.findFirst({
                where: { id: dto.rawCategoryId, tenantId, isActive: true },
            });
            if (!rawCategory) {
                throw new common_1.BadRequestException('Raw category not found');
            }
            rawCategoryNameToPersist = rawCategory.name;
        }
        const updated = await this.prisma.incomingBale.update({
            where: { id },
            data: {
                ...(dto.containerId !== undefined && { containerId: dto.containerId }),
                ...(targetPurchaseOrderId !== undefined && { purchaseOrderId: targetPurchaseOrderId }),
                ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
                ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
                ...(rawCategoryNameToPersist && {
                    rawCategoryId: dto.rawCategoryId,
                }),
                ...(dto.containerId !== undefined &&
                    (dto.containerId
                        ? { cost: undefined }
                        : { cost: dto.cost ?? bale.cost ?? 0 })),
            },
            include: {
                container: {
                    select: { containerNumber: true },
                },
                vendor: {
                    select: { name: true },
                },
                purchaseOrder: {
                    select: { id: true, poNumber: true },
                },
                rawCategory: {
                    select: { id: true, name: true, rawType: true },
                },
            },
        });
        const containerChanged = dto.containerId !== undefined && dto.containerId !== oldContainerId;
        const finalContainerId = dto.containerId !== undefined ? dto.containerId : oldContainerId;
        if (oldContainerId && containerChanged) {
            await this.costAllocationService.allocateContainerCosts(oldContainerId, userId);
        }
        if (finalContainerId && (containerChanged || dto.weightKg !== undefined)) {
            await this.costAllocationService.allocateContainerCosts(finalContainerId, userId);
        }
        await this.auditService.log({
            userId,
            tenantId,
            action: 'INCOMING_BALE_UPDATED',
            entityType: 'IncomingBale',
            entityId: id,
            metadataJson: { changes: dto },
        });
        const newStandalonePoId = finalContainerId ? null : updated.purchaseOrder?.id ?? updated.purchaseOrderId ?? targetPurchaseOrderId ?? null;
        if (previousStandalonePoId) {
            await this.costAllocationService.syncPurchaseOrderTotals(previousStandalonePoId);
        }
        if (newStandalonePoId && newStandalonePoId !== previousStandalonePoId) {
            await this.costAllocationService.syncPurchaseOrderTotals(newStandalonePoId);
        }
        return updated;
    }
    async delete(tenantId, id, userId) {
        const bale = await this.findOne(tenantId, id);
        if (bale.sortSessions.length > 0) {
            throw new common_1.ConflictException('Cannot delete bale that has been used in sorting');
        }
        const containerId = bale.containerId;
        const standalonePoId = containerId ? null : bale.purchaseOrder?.id ?? bale.purchaseOrderId ?? null;
        await this.prisma.incomingBale.delete({
            where: { id },
        });
        if (containerId) {
            await this.costAllocationService.allocateContainerCosts(containerId, userId);
        }
        await this.auditService.log({
            userId,
            tenantId,
            action: 'INCOMING_BALE_DELETED',
            entityType: 'IncomingBale',
            entityId: id,
            metadataJson: {
                baleCode: bale.baleCode,
                containerNumber: bale.container?.containerNumber,
            },
        });
        if (standalonePoId) {
            await this.costAllocationService.syncPurchaseOrderTotals(standalonePoId);
        }
        return { success: true };
    }
};
exports.IncomingBaleService = IncomingBaleService;
exports.IncomingBaleService = IncomingBaleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        cost_allocation_service_1.CostAllocationService,
        tenant_sequence_service_1.TenantSequenceService])
], IncomingBaleService);
//# sourceMappingURL=incoming-bale.service.js.map