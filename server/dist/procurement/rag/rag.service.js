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
let RagService = class RagService {
    constructor(prisma, auditService, costAllocationService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costAllocationService = costAllocationService;
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
            },
        });
        if (!container) {
            throw new common_1.BadRequestException('Container not found');
        }
        if (container.status === client_1.ContainerStatus.CLOSED) {
            throw new common_1.ConflictException('Cannot add rags to a closed container');
        }
        const existing = await this.prisma.rag.findFirst({
            where: { tenantId, ragCode: dto.ragCode },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Rag code "${dto.ragCode}" already exists`);
        }
        const rag = await this.prisma.rag.create({
            data: {
                tenantId,
                containerId: dto.containerId,
                ragCode: dto.ragCode,
                weightKg: dto.weightKg,
                allocatedCost: 0,
            },
            include: {
                container: {
                    select: { containerNumber: true },
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
        const where = {
            tenantId,
            ...(options?.containerId && { containerId: options.containerId }),
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
                sortSessions: {
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
        if (rag.sortSessions.length > 0) {
            throw new common_1.ConflictException('Cannot delete rag that has been used in sorting');
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
        cost_allocation_service_1.CostAllocationService])
], RagService);
//# sourceMappingURL=rag.service.js.map