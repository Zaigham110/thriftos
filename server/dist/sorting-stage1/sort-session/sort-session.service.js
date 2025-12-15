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
        const inputWeight = await this.getInputWeight(tenantId, { ragId, incomingBaleId });
        const existingOpen = await this.prisma.sortSession.findFirst({
            where: {
                tenantId,
                status: client_1.SortStatus.OPEN,
                ...(ragId ? { ragId } : {}),
                ...(incomingBaleId ? { incomingBaleId } : {}),
            },
            select: { id: true },
        });
        if (existingOpen) {
            throw new common_1.ConflictException('An OPEN sort session already exists for this source');
        }
        const session = await this.prisma.sortSession.create({
            data: {
                tenantId,
                ragId: ragId || null,
                incomingBaleId: incomingBaleId || null,
                workerId,
                supervisorId,
                totalInputWeight: inputWeight,
                totalOutputWeight: new library_1.Decimal(0),
                wasteWeight: new library_1.Decimal(0),
                status: client_1.SortStatus.OPEN,
            },
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'SORT_SESSION_CREATED',
            entityType: 'SortSession',
            entityId: session.id,
            metadataJson: {
                ragId,
                incomingBaleId,
                workerId,
                supervisorId,
                totalInputWeight: inputWeight.toString(),
            },
        });
        return session;
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
    async close(tenantId, sessionId, currentUserId) {
        const result = await this.prisma.$transaction(async (tx) => {
            const session = await tx.sortSession.findFirst({
                where: { id: sessionId, tenantId },
                include: {
                    rag: { select: { allocatedCost: true } },
                    incomingBale: { select: { cost: true } },
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
            const wasteWeight = session.totalInputWeight.sub(totalOutputWeight);
            const yieldPercent = session.totalInputWeight.equals(new library_1.Decimal(0))
                ? new library_1.Decimal(0)
                : totalOutputWeight.div(session.totalInputWeight).mul(new library_1.Decimal(100));
            const sourceCost = session.rag?.allocatedCost ?? session.incomingBale?.cost ?? new library_1.Decimal(0);
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
                    },
                }));
            }
            const updatedSession = await tx.sortSession.update({
                where: { id: sessionId },
                data: {
                    status: client_1.SortStatus.CLOSED,
                    endTime: new Date(),
                    totalOutputWeight,
                    wasteWeight,
                },
            });
            return { session: updatedSession, outputs, yieldPercent: yieldPercent.toNumber() };
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
                wasteWeight: result.session.wasteWeight?.toString(),
            },
        });
        return result;
    }
    async getInputWeight(tenantId, ids) {
        if (ids.ragId) {
            const rag = await this.prisma.rag.findFirst({
                where: { id: ids.ragId, tenantId },
                select: { weightKg: true },
            });
            if (!rag)
                throw new common_1.BadRequestException('Source not found: ragId');
            return rag.weightKg;
        }
        if (ids.incomingBaleId) {
            const bale = await this.prisma.incomingBale.findFirst({
                where: { id: ids.incomingBaleId, tenantId },
                select: { weightKg: true },
            });
            if (!bale)
                throw new common_1.BadRequestException('Source not found: incomingBaleId');
            return bale.weightKg;
        }
        throw new common_1.BadRequestException('Missing source');
    }
};
exports.SortSessionService = SortSessionService;
exports.SortSessionService = SortSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SortSessionService);
//# sourceMappingURL=sort-session.service.js.map