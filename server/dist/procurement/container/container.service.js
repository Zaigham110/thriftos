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
exports.ContainerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_allocation_service_1 = require("../cost-allocation/cost-allocation.service");
const client_1 = require("@prisma/client");
const tenant_sequence_service_1 = require("../shared/tenant-sequence.service");
let ContainerService = class ContainerService {
    constructor(prisma, auditService, costAllocationService, tenantSequenceService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costAllocationService = costAllocationService;
        this.tenantSequenceService = tenantSequenceService;
    }
    toDate(value) {
        return value ? new Date(value) : null;
    }
    async create(tenantId, dto, userId) {
        const po = await this.prisma.purchaseOrder.findFirst({
            where: { id: dto.purchaseOrderId, tenantId },
        });
        if (!po) {
            throw new common_1.BadRequestException('Purchase order not found');
        }
        if (po.poType === client_1.PurchaseOrderType.LOOSE_BALE) {
            throw new common_1.BadRequestException('Containers are not allowed for LOOSE_BALE purchase orders');
        }
        if (po.status === client_1.PurchaseOrderStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot add container to a closed purchase order');
        }
        const { code: containerNumber } = await this.tenantSequenceService.generateCode(tenantId, client_1.SequenceScope.CONTAINER, { prefix: 'CONT', padSize: 3 }, async (code) => {
            const existing = await this.prisma.container.findFirst({
                where: { tenantId, containerNumber: code },
                select: { id: true },
            });
            return !existing;
        });
        const container = await this.prisma.container.create({
            data: {
                tenantId,
                purchaseOrderId: dto.purchaseOrderId,
                containerNumber,
                referenceNumber: dto.referenceNumber,
                containerType: dto.containerType,
                eta: this.toDate(dto.eta),
                etd: this.toDate(dto.etd),
                arrivedAt: this.toDate(dto.arrivedAt),
                clearedAt: this.toDate(dto.clearedAt),
                releasedAt: this.toDate(dto.releasedAt),
                grossWeight: dto.grossWeight,
                netWeight: dto.netWeight,
                billOfLadingNumber: dto.billOfLadingNumber,
                shipmentReference: dto.shipmentReference,
                shippingLine: dto.shippingLine,
                vesselName: dto.vesselName,
                portOfLoading: dto.portOfLoading,
                portOfDischarge: dto.portOfDischarge,
                forwarder: dto.forwarder,
                notes: dto.notes,
                status: client_1.ContainerStatus.IN_TRANSIT,
            },
            include: {
                containerCharges: true,
                purchaseOrder: {
                    select: { poNumber: true },
                },
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'CONTAINER_CREATED',
            entityType: 'Container',
            entityId: container.id,
            metadataJson: {
                containerNumber: container.containerNumber,
                poNumber: container.purchaseOrder.poNumber,
            },
        });
        return container;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.purchaseOrderId && { purchaseOrderId: options.purchaseOrderId }),
            ...(options?.status && { status: options.status }),
        };
        const [data, total] = await Promise.all([
            this.prisma.container.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    purchaseOrder: {
                        select: { id: true, poNumber: true, tenantId: true },
                    },
                    containerCharges: true,
                    _count: {
                        select: {
                            rags: true,
                            incomingBales: true,
                        },
                    },
                },
            }),
            this.prisma.container.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const container = await this.prisma.container.findFirst({
            where: {
                id,
                tenantId,
            },
            include: {
                purchaseOrder: {
                    select: { id: true, poNumber: true, tenantId: true, vendor: true },
                },
                containerCharges: true,
                rags: true,
                incomingBales: true,
            },
        });
        if (!container) {
            throw new common_1.NotFoundException('Container not found');
        }
        return container;
    }
    async update(tenantId, id, dto, userId) {
        const container = await this.findOne(tenantId, id);
        if (container.status === client_1.ContainerStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot modify a closed container');
        }
        const updated = await this.prisma.container.update({
            where: { id },
            data: {
                ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber }),
                ...(dto.containerType !== undefined && { containerType: dto.containerType }),
                ...(dto.grossWeight !== undefined && { grossWeight: dto.grossWeight }),
                ...(dto.netWeight !== undefined && { netWeight: dto.netWeight }),
                ...(dto.billOfLadingNumber !== undefined && { billOfLadingNumber: dto.billOfLadingNumber }),
                ...(dto.shipmentReference !== undefined && { shipmentReference: dto.shipmentReference }),
                ...(dto.shippingLine !== undefined && { shippingLine: dto.shippingLine }),
                ...(dto.vesselName !== undefined && { vesselName: dto.vesselName }),
                ...(dto.portOfLoading !== undefined && { portOfLoading: dto.portOfLoading }),
                ...(dto.portOfDischarge !== undefined && { portOfDischarge: dto.portOfDischarge }),
                ...(dto.forwarder !== undefined && { forwarder: dto.forwarder }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
                ...(dto.eta !== undefined && { eta: this.toDate(dto.eta) }),
                ...(dto.etd !== undefined && { etd: this.toDate(dto.etd) }),
                ...(dto.arrivedAt !== undefined && { arrivedAt: this.toDate(dto.arrivedAt) }),
                ...(dto.clearedAt !== undefined && { clearedAt: this.toDate(dto.clearedAt) }),
                ...(dto.releasedAt !== undefined && { releasedAt: this.toDate(dto.releasedAt) }),
            },
            include: {
                purchaseOrder: {
                    select: { poNumber: true },
                },
                containerCharges: true,
            },
        });
        if (dto.netWeight !== undefined) {
            await this.costAllocationService.allocateContainerCosts(id, userId);
        }
        await this.auditService.log({
            userId,
            tenantId,
            action: 'CONTAINER_UPDATED',
            entityType: 'Container',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async updateStatus(tenantId, id, dto, userId) {
        const container = await this.findOne(tenantId, id);
        const validTransitions = {
            [client_1.ContainerStatus.IN_TRANSIT]: [client_1.ContainerStatus.ARRIVED],
            [client_1.ContainerStatus.ARRIVED]: [client_1.ContainerStatus.CLEARED, client_1.ContainerStatus.IN_TRANSIT],
            [client_1.ContainerStatus.CLEARED]: [client_1.ContainerStatus.CLOSED, client_1.ContainerStatus.ARRIVED],
            [client_1.ContainerStatus.CLOSED]: [],
        };
        if (!validTransitions[container.status].includes(dto.status)) {
            throw new common_1.ConflictException(`Cannot transition from ${container.status} to ${dto.status}`);
        }
        const updated = await this.prisma.container.update({
            where: { id },
            data: { status: dto.status },
            include: {
                purchaseOrder: {
                    select: { poNumber: true },
                },
                containerCharges: true,
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'CONTAINER_STATUS_CHANGED',
            entityType: 'Container',
            entityId: id,
            metadataJson: {
                containerNumber: container.containerNumber,
                previousStatus: container.status,
                newStatus: dto.status,
            },
        });
        return updated;
    }
    async addCharge(tenantId, containerId, dto, userId) {
        const container = await this.findOne(tenantId, containerId);
        if (container.status === client_1.ContainerStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot add charges to a closed container');
        }
        const charge = await this.prisma.containerCharge.create({
            data: {
                containerId,
                chargeType: dto.chargeType,
                description: dto.description,
                amount: dto.amount,
            },
        });
        await this.costAllocationService.allocateContainerCosts(containerId, userId);
        await this.costAllocationService.syncPurchaseOrderTotals(container.purchaseOrder.id);
        await this.auditService.log({
            userId,
            tenantId,
            action: 'CONTAINER_CHARGE_ADDED',
            entityType: 'ContainerCharge',
            entityId: charge.id,
            metadataJson: {
                containerNumber: container.containerNumber,
                chargeType: dto.chargeType,
                amount: dto.amount,
            },
        });
        return charge;
    }
    async getCharges(tenantId, containerId) {
        await this.findOne(tenantId, containerId);
        return this.prisma.containerCharge.findMany({
            where: { containerId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async deleteCharge(tenantId, containerId, chargeId, userId) {
        const container = await this.findOne(tenantId, containerId);
        if (container.status === client_1.ContainerStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot delete charges from a closed container');
        }
        const charge = await this.prisma.containerCharge.findFirst({
            where: { id: chargeId, containerId },
        });
        if (!charge) {
            throw new common_1.NotFoundException('Charge not found');
        }
        await this.prisma.containerCharge.delete({
            where: { id: chargeId },
        });
        await this.costAllocationService.allocateContainerCosts(containerId, userId);
        await this.costAllocationService.syncPurchaseOrderTotals(container.purchaseOrder.id);
        await this.auditService.log({
            userId,
            tenantId,
            action: 'CONTAINER_CHARGE_DELETED',
            entityType: 'ContainerCharge',
            entityId: chargeId,
            metadataJson: {
                containerNumber: container.containerNumber,
                chargeType: charge.chargeType,
                amount: charge.amount.toString(),
            },
        });
        return { success: true };
    }
    async getCostBreakdown(tenantId, containerId) {
        await this.findOne(tenantId, containerId);
        return this.costAllocationService.getContainerCostBreakdown(containerId);
    }
};
exports.ContainerService = ContainerService;
exports.ContainerService = ContainerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        cost_allocation_service_1.CostAllocationService,
        tenant_sequence_service_1.TenantSequenceService])
], ContainerService);
//# sourceMappingURL=container.service.js.map