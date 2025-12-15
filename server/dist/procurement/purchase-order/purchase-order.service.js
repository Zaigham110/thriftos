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
exports.PurchaseOrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const client_1 = require("@prisma/client");
let PurchaseOrderService = class PurchaseOrderService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, userId) {
        const existing = await this.prisma.purchaseOrder.findFirst({
            where: { tenantId, poNumber: dto.poNumber },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Purchase order "${dto.poNumber}" already exists`);
        }
        if (dto.vendorId) {
            const vendor = await this.prisma.vendor.findFirst({
                where: { id: dto.vendorId, tenantId },
            });
            if (!vendor) {
                throw new common_1.BadRequestException('Vendor not found');
            }
        }
        const po = await this.prisma.purchaseOrder.create({
            data: {
                tenantId,
                poNumber: dto.poNumber,
                poType: dto.poType,
                vendorId: dto.vendorId,
                currency: dto.currency || 'USD',
                totalCost: dto.totalCost || 0,
                status: client_1.PurchaseOrderStatus.OPEN,
            },
            include: {
                vendor: true,
                containers: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'PURCHASE_ORDER_CREATED',
            entityType: 'PurchaseOrder',
            entityId: po.id,
            metadataJson: { poNumber: po.poNumber, poType: po.poType },
        });
        return po;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.status && { status: options.status }),
        };
        const [data, total] = await Promise.all([
            this.prisma.purchaseOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    vendor: true,
                    _count: {
                        select: {
                            containers: true,
                        },
                    },
                },
            }),
            this.prisma.purchaseOrder.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const po = await this.prisma.purchaseOrder.findFirst({
            where: { id, tenantId },
            include: {
                vendor: true,
                containers: {
                    include: {
                        containerCharges: true,
                        _count: {
                            select: {
                                rags: true,
                                incomingBales: true,
                            },
                        },
                    },
                },
            },
        });
        if (!po) {
            throw new common_1.NotFoundException('Purchase order not found');
        }
        return po;
    }
    async update(tenantId, id, dto, userId) {
        const po = await this.findOne(tenantId, id);
        if (po.status === client_1.PurchaseOrderStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot modify a closed purchase order');
        }
        if (dto.vendorId && dto.vendorId !== po.vendorId) {
            const vendor = await this.prisma.vendor.findFirst({
                where: { id: dto.vendorId, tenantId },
            });
            if (!vendor) {
                throw new common_1.BadRequestException('Vendor not found');
            }
        }
        const updated = await this.prisma.purchaseOrder.update({
            where: { id },
            data: dto,
            include: {
                vendor: true,
                containers: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'PURCHASE_ORDER_UPDATED',
            entityType: 'PurchaseOrder',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async receive(tenantId, id, userId) {
        const po = await this.findOne(tenantId, id);
        if (po.status !== client_1.PurchaseOrderStatus.OPEN) {
            throw new common_1.ConflictException(`Cannot receive PO with status ${po.status}`);
        }
        const updated = await this.prisma.purchaseOrder.update({
            where: { id },
            data: { status: client_1.PurchaseOrderStatus.RECEIVED },
            include: {
                vendor: true,
                containers: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'PURCHASE_ORDER_RECEIVED',
            entityType: 'PurchaseOrder',
            entityId: id,
            metadataJson: { poNumber: po.poNumber },
        });
        return updated;
    }
    async close(tenantId, id, userId) {
        const po = await this.findOne(tenantId, id);
        if (po.status === client_1.PurchaseOrderStatus.CLOSED) {
            throw new common_1.ConflictException('Purchase order is already closed');
        }
        const openContainers = po.containers.filter((c) => c.status !== client_1.ContainerStatus.CLOSED);
        if (openContainers.length > 0) {
            throw new common_1.ConflictException(`Cannot close PO: ${openContainers.length} container(s) are not closed`);
        }
        const updated = await this.prisma.purchaseOrder.update({
            where: { id },
            data: { status: client_1.PurchaseOrderStatus.CLOSED },
            include: {
                vendor: true,
                containers: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'PURCHASE_ORDER_CLOSED',
            entityType: 'PurchaseOrder',
            entityId: id,
            metadataJson: { poNumber: po.poNumber },
        });
        return updated;
    }
};
exports.PurchaseOrderService = PurchaseOrderService;
exports.PurchaseOrderService = PurchaseOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PurchaseOrderService);
//# sourceMappingURL=purchase-order.service.js.map