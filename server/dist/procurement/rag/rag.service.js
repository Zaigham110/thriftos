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
exports.RagService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_allocation_service_1 = require("../cost-allocation/cost-allocation.service");
const client_1 = require("@prisma/client");
const tenant_sequence_service_1 = require("../shared/tenant-sequence.service");
let RagService = class RagService {
    constructor(prisma, auditService, costAllocationService, tenantSequenceService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costAllocationService = costAllocationService;
        this.tenantSequenceService = tenantSequenceService;
    }
    async create(tenantId, dto, userId) {
        const container = await this.prisma.container.findFirst({
            where: {
                id: dto.containerId,
                purchaseOrder: { tenantId },
            },
            include: {
                purchaseOrder: {
                    select: { id: true, poNumber: true },
                },
                rags: {
                    select: { weightKg: true },
                },
            },
        });
        if (!container) {
            throw new common_1.BadRequestException('Container not found');
        }
        if (container.status === client_1.ContainerStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot add rags to a closed container');
        }
        const rawCategory = await this.prisma.rawCategory.findFirst({
            where: { id: dto.rawCategoryId, tenantId, isActive: true },
        });
        if (!rawCategory) {
            throw new common_1.BadRequestException('Raw category not found or inactive');
        }
        const currentTotalWeight = container.rags.reduce((sum, rag) => sum + Number(rag.weightKg), 0);
        const newTotalWeight = Number(currentTotalWeight) + Number(dto.weightKg);
        const grossWeight = Number(container.grossWeight);
        if (newTotalWeight > grossWeight) {
            throw new common_1.BadRequestException(`Total weight (${newTotalWeight} kg) would exceed container gross weight (${grossWeight} kg). Available: ${grossWeight - currentTotalWeight} kg`);
        }
        const prefix = dto.ragBaleType === 'BALE' ? 'BALE' : 'RAG';
        const { code: ragCode } = await this.tenantSequenceService.generateCode(tenantId, client_1.SequenceScope.RAG, { prefix, padSize: 3 }, async (candidate) => {
            const collision = await this.prisma.rag.findFirst({
                where: { tenantId, ragCode: candidate },
                select: { id: true },
            });
            return !collision;
        });
        const rag = await this.prisma.rag.create({
            data: {
                tenantId,
                containerId: dto.containerId,
                ragCode,
                ragBaleType: dto.ragBaleType,
                rawCategoryId: dto.rawCategoryId,
                weightKg: dto.weightKg,
                allocatedCost: 0,
                notes: dto.notes,
            },
            include: {
                container: {
                    select: { containerNumber: true },
                },
                rawCategory: {
                    select: { id: true, name: true, rawType: true },
                },
            },
        });
        await this.costAllocationService.allocateContainerCosts(dto.containerId, userId);
        const updatedRag = await this.prisma.rag.findUnique({
            where: { id: rag.id },
            include: {
                container: {
                    select: { containerNumber: true },
                },
            },
        });
        await this.auditService.log({
            userId,
            tenantId,
            action: 'RAG_CREATED',
            entityType: 'Rag',
            entityId: rag.id,
            metadataJson: {
                ragCode: rag.ragCode,
                containerNumber: container.containerNumber,
                weightKg: dto.weightKg,
            },
        });
        return updatedRag;
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        let statusFilter = options?.status;
        if (options?.sortableOnly) {
            statusFilter = client_1.RagStatus.NOT_STARTED;
        }
        const where = {
            tenantId,
            ...(options?.containerId && { containerId: options.containerId }),
            ...(statusFilter && { status: statusFilter }),
        };
        const [data, total] = await Promise.all([
            this.prisma.rag.findMany({
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
                    rawCategory: {
                        select: { id: true, name: true, rawType: true },
                    },
                },
            }),
            this.prisma.rag.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const rag = await this.prisma.rag.findFirst({
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
                rawCategory: {
                    select: { id: true, name: true, rawType: true },
                },
                sortSession: {
                    select: { id: true, status: true },
                },
            },
        });
        if (!rag) {
            throw new common_1.NotFoundException('Rag not found');
        }
        return rag;
    }
    async delete(tenantId, id, userId) {
        const rag = await this.findOne(tenantId, id);
        if (rag.sortSession) {
            throw new common_1.ConflictException('Cannot delete rag that has been used in sorting');
        }
        if (rag.status !== client_1.RagStatus.NOT_STARTED) {
            throw new common_1.ConflictException(`Cannot delete rag with status ${rag.status}`);
        }
        const container = rag.container;
        await this.prisma.rag.delete({
            where: { id },
        });
        await this.costAllocationService.allocateContainerCosts(container.id, userId);
        await this.auditService.log({
            userId,
            tenantId,
            action: 'RAG_DELETED',
            entityType: 'Rag',
            entityId: id,
            metadataJson: {
                ragCode: rag.ragCode,
                containerNumber: container.containerNumber,
            },
        });
        return { success: true };
    }
};
exports.RagService = RagService;
exports.RagService = RagService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        cost_allocation_service_1.CostAllocationService,
        tenant_sequence_service_1.TenantSequenceService])
], RagService);
//# sourceMappingURL=rag.service.js.map