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
    async getContainerCostBreakdown(containerId) {
        const container = await this.prisma.container.findUnique({
            where: { id: containerId },
            include: {
                containerCharges: true,
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
        const totalAllocatedToRags = container.rags.reduce((sum, rag) => sum.add(rag.allocatedCost), new library_1.Decimal(0));
        const totalAllocatedToBales = container.incomingBales.reduce((sum, bale) => sum.add(bale.cost), new library_1.Decimal(0));
        return {
            containerId,
            containerNumber: container.containerNumber,
            grossWeight: container.grossWeight,
            netWeight: container.netWeight,
            totalCharges: totalCharges.toString(),
            chargeBreakdown: container.containerCharges.map((c) => ({
                type: c.chargeType,
                description: c.description,
                amount: c.amount.toString(),
            })),
            rags: container.rags.map((r) => ({
                id: r.id,
                code: r.ragCode,
                weightKg: r.weightKg.toString(),
                allocatedCost: r.allocatedCost.toString(),
            })),
            incomingBales: container.incomingBales.map((b) => ({
                id: b.id,
                code: b.baleCode,
                weightKg: b.weightKg.toString(),
                allocatedCost: b.cost.toString(),
            })),
            totalAllocatedToRags: totalAllocatedToRags.toString(),
            totalAllocatedToBales: totalAllocatedToBales.toString(),
            totalAllocated: totalAllocatedToRags.add(totalAllocatedToBales).toString(),
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