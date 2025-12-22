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
exports.CostAllocationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const library_1 = require("@prisma/client/runtime/library");
let CostAllocationService = class CostAllocationService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async allocateContainerCosts(containerId, userId) {
        await this.prisma.$transaction(async (tx) => {
            const container = await tx.container.findUnique({
                where: { id: containerId },
                include: {
                    containerCharges: true,
                    rags: true,
                    incomingBales: true,
                    purchaseOrder: {
                        select: { tenantId: true },
                    },
                },
            });
            if (!container) {
                throw new common_1.BadRequestException('Container not found');
            }
            const netWeight = container.netWeight;
            if (!netWeight || netWeight.equals(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('Container net weight must be greater than 0 for cost allocation');
            }
            const totalCost = container.containerCharges.reduce((sum, charge) => sum.add(charge.amount), new library_1.Decimal(0));
            for (const rag of container.rags) {
                const allocatedCost = rag.weightKg.div(netWeight).mul(totalCost);
                await tx.rag.update({
                    where: { id: rag.id },
                    data: { allocatedCost },
                });
            }
            for (const bale of container.incomingBales) {
                const allocatedCost = bale.weightKg.div(netWeight).mul(totalCost);
                await tx.incomingBale.update({
                    where: { id: bale.id },
                    data: { cost: allocatedCost },
                });
            }
            await this.syncPurchaseOrderTotals(container.purchaseOrderId, tx);
            if (userId) {
                await this.auditService.log({
                    userId,
                    tenantId: container.purchaseOrder.tenantId,
                    action: 'COST_ALLOCATION_RECALCULATED',
                    entityType: 'Container',
                    entityId: containerId,
                    metadataJson: {
                        containerNumber: container.containerNumber,
                        totalCost: totalCost.toString(),
                        netWeight: netWeight.toString(),
                        ragsCount: container.rags.length,
                        balesCount: container.incomingBales.length,
                    },
                });
            }
        });
    }
    async syncPurchaseOrderTotals(purchaseOrderId, prismaClient) {
        const client = prismaClient ?? this.prisma;
        const po = await client.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            select: {
                id: true,
                containers: {
                    select: {
                        containerCharges: {
                            select: { amount: true },
                        },
                    },
                },
                incomingBales: {
                    where: { containerId: null },
                    select: { cost: true },
                },
            },
        });
        if (!po) {
            return;
        }
        const containerTotals = po.containers.reduce((sum, container) => {
            const chargesTotal = container.containerCharges.reduce((chargeSum, charge) => chargeSum.add(charge.amount), new library_1.Decimal(0));
            return sum.add(chargesTotal);
        }, new library_1.Decimal(0));
        const looseBaleTotals = po.incomingBales.reduce((sum, bale) => sum.add(bale.cost ?? new library_1.Decimal(0)), new library_1.Decimal(0));
        await client.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data: { totalCost: containerTotals.add(looseBaleTotals) },
        });
    }
    async getContainerCostBreakdown(containerId) {
        const container = await this.prisma.container.findUnique({
            where: { id: containerId },
            include: {
                containerCharges: true,
                purchaseOrder: {
                    select: { currency: true },
                },
                rags: {
                    select: {
                        id: true,
                        ragCode: true,
                        weightKg: true,
                        allocatedCost: true,
                    },
                },
                incomingBales: {
                    select: {
                        id: true,
                        baleCode: true,
                        weightKg: true,
                        cost: true,
                    },
                },
            },
        });
        if (!container) {
            return null;
        }
        const totalCharges = container.containerCharges.reduce((sum, charge) => sum.add(charge.amount), new library_1.Decimal(0));
        const totalWeight = Number(container.netWeight) || 0;
        const totalCost = Number(totalCharges);
        const costPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;
        return {
            containerId,
            containerNumber: container.containerNumber,
            totalCost,
            costPerKg,
            totalWeight,
            currency: container.purchaseOrder?.currency ?? 'USD',
            charges: container.containerCharges.map((c) => ({
                id: c.id,
                containerId: c.containerId,
                chargeType: c.chargeType,
                description: c.description,
                amount: Number(c.amount),
                createdAt: c.createdAt.toISOString(),
                updatedAt: c.updatedAt.toISOString(),
            })),
            rags: container.rags.map((r) => ({
                id: r.id,
                code: r.ragCode,
                weightKg: Number(r.weightKg),
                allocatedCost: Number(r.allocatedCost),
            })),
            incomingBales: container.incomingBales.map((b) => ({
                id: b.id,
                code: b.baleCode,
                weightKg: Number(b.weightKg),
                allocatedCost: Number(b.cost),
            })),
        };
    }
};
exports.CostAllocationService = CostAllocationService;
exports.CostAllocationService = CostAllocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CostAllocationService);
//# sourceMappingURL=cost-allocation.service.js.map