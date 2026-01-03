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
exports.SortSessionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const library_1 = require("@prisma/client/runtime/library");
const client_1 = require("@prisma/client");
let SortSessionService = class SortSessionService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, currentUserId) {
        const ragId = dto.ragId;
        const incomingBaleId = dto.incomingBaleId;
        if (!!ragId === !!incomingBaleId) {
            throw new common_1.BadRequestException('Exactly one of ragId or incomingBaleId must be provided');
        }
        const workerId = dto.workerId || currentUserId;
        const supervisorId = dto.supervisorId || currentUserId;
        const result = await this.prisma.$transaction(async (tx) => {
            let inputWeight;
            let containerId = null;
            if (ragId) {
                const rag = await tx.rag.findFirst({
                    where: { id: ragId, tenantId },
                    select: { id: true, weightKg: true, status: true, containerId: true },
                });
                if (!rag) {
                    throw new common_1.BadRequestException('Source not found: ragId');
                }
                if (rag.status !== client_1.RagStatus.NOT_STARTED) {
                    throw new common_1.ConflictException(`Rag cannot be sorted: status is ${rag.status}. Only NOT_STARTED rags can be sorted.`);
                }
                inputWeight = rag.weightKg;
                containerId = rag.containerId;
                await tx.rag.update({
                    where: { id: ragId },
                    data: { status: client_1.RagStatus.IN_SORTING },
                });
            }
            else if (incomingBaleId) {
                const bale = await tx.incomingBale.findFirst({
                    where: { id: incomingBaleId, tenantId },
                    select: { weightKg: true, containerId: true },
                });
                if (!bale) {
                    throw new common_1.BadRequestException('Source not found: incomingBaleId');
                }
                inputWeight = bale.weightKg;
                containerId = bale.containerId;
            }
            else {
                throw new common_1.BadRequestException('Missing source');
            }
            const session = await tx.sortSession.create({
                data: {
                    tenantId,
                    ragId: ragId || undefined,
                    incomingBaleId: incomingBaleId || undefined,
                    workerId,
                    supervisorId,
                    totalInputWeight: inputWeight,
                    totalOutputWeight: new library_1.Decimal(0),
                    wasteWeight: new library_1.Decimal(0),
                    status: client_1.SortStatus.OPEN,
                },
            });
            return { session, containerId };
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'SORT_SESSION_CREATED',
            entityType: 'SortSession',
            entityId: result.session.id,
            metadataJson: {
                ragId,
                incomingBaleId,
                workerId,
                supervisorId,
                totalInputWeight: result.session.totalInputWeight.toString(),
                ragStatusTransition: ragId ? 'NOT_STARTED → IN_SORTING' : null,
            },
        });
        return result.session;
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
            this.prisma.sortSession.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    rag: { select: { id: true, ragCode: true, weightKg: true, allocatedCost: true } },
                    incomingBale: { select: { id: true, baleCode: true, weightKg: true, cost: true } },
                    worker: { select: { id: true, name: true, email: true } },
                    supervisor: { select: { id: true, name: true, email: true } },
                    _count: { select: { sortCategoryBuckets: true } },
                },
            }),
            this.prisma.sortSession.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const session = await this.prisma.sortSession.findFirst({
            where: { id, tenantId },
            include: {
                rag: { select: { id: true, ragCode: true, weightKg: true, allocatedCost: true } },
                incomingBale: { select: { id: true, baleCode: true, weightKg: true, cost: true } },
                worker: { select: { id: true, name: true, email: true } },
                supervisor: { select: { id: true, name: true, email: true } },
                sortCategoryBuckets: {
                    orderBy: { updatedAt: 'desc' },
                    include: {
                        category: { select: { id: true, name: true } },
                        categoryOutputs: true,
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException('Sort session not found');
        const yieldPercent = session.totalInputWeight.equals(new library_1.Decimal(0))
            ? new library_1.Decimal(0)
            : session.totalOutputWeight.div(session.totalInputWeight).mul(new library_1.Decimal(100));
        return { ...session, yieldPercent: yieldPercent.toNumber() };
    }
    async update(tenantId, id, dto, currentUserId) {
        const session = await this.prisma.sortSession.findFirst({
            where: { id, tenantId },
            select: { id: true, status: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Sort session not found');
        if (session.status !== client_1.SortStatus.OPEN) {
            throw new common_1.ConflictException('Cannot update a CLOSED sort session');
        }
        const updated = await this.prisma.sortSession.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'SORT_SESSION_UPDATED',
            entityType: 'SortSession',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async close(tenantId, sessionId, currentUserId, options) {
        const result = await this.prisma.$transaction(async (tx) => {
            const session = await tx.sortSession.findFirst({
                where: { id: sessionId, tenantId },
                include: {
                    rag: { select: { id: true, allocatedCost: true, containerId: true } },
                    incomingBale: { select: { cost: true, containerId: true } },
                    sortCategoryBuckets: true,
                },
            });
            if (!session)
                throw new common_1.NotFoundException('Sort session not found');
            if (session.status !== client_1.SortStatus.OPEN)
                throw new common_1.ConflictException('Cannot close session twice');
            const buckets = session.sortCategoryBuckets;
            if (!buckets || buckets.length === 0) {
                throw new common_1.BadRequestException('At least one bucket is required to close');
            }
            const totalOutputWeight = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), new library_1.Decimal(0));
            if (totalOutputWeight.equals(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('totalOutputWeight must be > 0 to close');
            }
            if (totalOutputWeight.greaterThan(session.totalInputWeight)) {
                throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
            }
            const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);
            const existingWasteAgg = await tx.wasteLineItem.aggregate({
                where: { tenantId, stage: client_1.WasteStage.STAGE_1, sortSessionId: sessionId },
                _sum: { amount: true },
            });
            const declaredWasteAmount = existingWasteAgg._sum.amount || new library_1.Decimal(0);
            if (declaredWasteAmount.greaterThan(computedWasteWeight)) {
                throw new common_1.BadRequestException('Declared waste exceeds computed waste');
            }
            const remainingWasteAmount = computedWasteWeight.sub(declaredWasteAmount);
            if (remainingWasteAmount.greaterThan(new library_1.Decimal(0))) {
                if (!options?.wasteCategoryId) {
                    throw new common_1.BadRequestException('wasteCategoryId is required to seal when remaining waste > 0');
                }
                const category = await tx.wasteCategory.findFirst({
                    where: { id: options.wasteCategoryId, tenantId, isActive: true },
                });
                if (!category) {
                    throw new common_1.BadRequestException('Invalid waste category');
                }
                const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
                const ragId = session.ragId;
                await tx.wasteLineItem.create({
                    data: {
                        tenantId,
                        stage: client_1.WasteStage.STAGE_1,
                        wasteCategoryId: category.id,
                        amount: remainingWasteAmount,
                        unitType: category.unitType,
                        estimatedValue: remainingWasteAmount.mul(category.defaultResalePrice),
                        sortSessionId: sessionId,
                        containerId,
                        ragId: ragId || null,
                        categoryOutputId: null,
                    },
                });
            }
            const yieldPercent = session.totalInputWeight.equals(new library_1.Decimal(0))
                ? new library_1.Decimal(0)
                : totalOutputWeight.div(session.totalInputWeight).mul(new library_1.Decimal(100));
            const sourceCost = session.rag?.allocatedCost ?? session.incomingBale?.cost ?? new library_1.Decimal(0);
            const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
            const ragId = session.ragId;
            const outputs = [];
            for (const bucket of buckets) {
                if (bucket.outputWeightKg.equals(new library_1.Decimal(0)) && bucket.outputCount === 0)
                    continue;
                const allocatedCost = bucket.outputWeightKg.div(totalOutputWeight).mul(sourceCost);
                outputs.push(await tx.categoryOutput.create({
                    data: {
                        tenantId,
                        sortCategoryBucketId: bucket.id,
                        categoryId: bucket.categoryId,
                        weightKg: bucket.outputWeightKg,
                        count: bucket.outputCount,
                        allocatedCost,
                        containerId,
                        ragId: ragId,
                        sortSessionId: sessionId,
                    },
                }));
            }
            if (ragId) {
                await tx.rag.update({
                    where: { id: ragId },
                    data: { status: client_1.RagStatus.SORTED },
                });
            }
            const updatedSession = await tx.sortSession.update({
                where: { id: sessionId },
                data: {
                    status: client_1.SortStatus.CLOSED,
                    endTime: new Date(),
                    totalOutputWeight,
                    wasteWeight: computedWasteWeight,
                },
            });
            return {
                session: updatedSession,
                outputs,
                yieldPercent: yieldPercent.toNumber(),
                wasteWeight: computedWasteWeight,
            };
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'SORT_SESSION_CLOSED',
            entityType: 'SortSession',
            entityId: sessionId,
            metadataJson: {
                outputsCreated: result.outputs.length,
                yieldPercent: result.yieldPercent,
                wasteWeight: result.wasteWeight?.toString(),
                ragStatusTransition: 'IN_SORTING → SORTED',
            },
        });
        return result;
    }
};
exports.SortSessionService = SortSessionService;
exports.SortSessionService = SortSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SortSessionService);
//# sourceMappingURL=sort-session.service.js.map