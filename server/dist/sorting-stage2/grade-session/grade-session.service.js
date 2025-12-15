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
exports.GradeSessionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const audit_service_1 = require("../../audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let GradeSessionService = class GradeSessionService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(tenantId, dto, currentUserId) {
        const workerId = dto.workerId || currentUserId;
        const supervisorId = dto.supervisorId || currentUserId;
        const categoryOutput = await this.prisma.categoryOutput.findFirst({
            where: { id: dto.categoryOutputId, tenantId },
            select: { id: true, weightKg: true, count: true, allocatedCost: true },
        });
        if (!categoryOutput) {
            throw new common_1.BadRequestException('CategoryOutput not found');
        }
        const existing = await this.prisma.gradeSession.findFirst({
            where: { tenantId, categoryOutputId: dto.categoryOutputId },
            select: { id: true, status: true },
        });
        if (existing) {
            throw new common_1.ConflictException('CategoryOutput already graded (or grading in progress)');
        }
        const session = await this.prisma.gradeSession.create({
            data: {
                tenantId,
                categoryOutputId: dto.categoryOutputId,
                workerId,
                supervisorId,
                status: client_1.GradeStatus.OPEN,
            },
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'GRADE_SESSION_CREATED',
            entityType: 'GradeSession',
            entityId: session.id,
            metadataJson: {
                categoryOutputId: dto.categoryOutputId,
                inputWeightKg: categoryOutput.weightKg.toString(),
                inputCount: categoryOutput.count,
                sourceCost: categoryOutput.allocatedCost.toString(),
                workerId,
                supervisorId,
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
            this.prisma.gradeSession.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    categoryOutput: { select: { id: true, weightKg: true, count: true, allocatedCost: true, categoryId: true } },
                    worker: { select: { id: true, name: true, email: true } },
                    supervisor: { select: { id: true, name: true, email: true } },
                    _count: { select: { gradeBuckets: true } },
                },
            }),
            this.prisma.gradeSession.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const session = await this.prisma.gradeSession.findFirst({
            where: { id, tenantId },
            include: {
                categoryOutput: {
                    include: {
                        category: { select: { id: true, name: true } },
                    },
                },
                worker: { select: { id: true, name: true, email: true } },
                supervisor: { select: { id: true, name: true, email: true } },
                gradeBuckets: {
                    orderBy: { updatedAt: 'desc' },
                    include: {
                        grade: { select: { id: true, name: true } },
                        gradeOutputs: true,
                    },
                },
            },
        });
        if (!session)
            throw new common_1.NotFoundException('Grade session not found');
        const inputWeight = session.categoryOutput.weightKg;
        const totalGradeOutputWeight = session.gradeBuckets.reduce((sum, b) => sum.add(b.outputWeightKg), new library_1.Decimal(0));
        const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
        const gradeYieldPercent = inputWeight.equals(new library_1.Decimal(0))
            ? new library_1.Decimal(0)
            : totalGradeOutputWeight.div(inputWeight).mul(new library_1.Decimal(100));
        return {
            ...session,
            totalGradeOutputWeight: totalGradeOutputWeight.toString(),
            wasteWeight: wasteWeight.toString(),
            gradeYieldPercent: gradeYieldPercent.toNumber(),
        };
    }
    async update(tenantId, id, dto, currentUserId) {
        const session = await this.prisma.gradeSession.findFirst({
            where: { id, tenantId },
            select: { id: true, status: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Grade session not found');
        if (session.status !== client_1.GradeStatus.OPEN)
            throw new common_1.ConflictException('Cannot update a CLOSED grade session');
        const updated = await this.prisma.gradeSession.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'GRADE_SESSION_UPDATED',
            entityType: 'GradeSession',
            entityId: id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async close(tenantId, sessionId, currentUserId) {
        const result = await this.prisma.$transaction(async (tx) => {
            const session = await tx.gradeSession.findFirst({
                where: { id: sessionId, tenantId },
                include: {
                    categoryOutput: { select: { id: true, weightKg: true, count: true, allocatedCost: true } },
                    gradeBuckets: true,
                },
            });
            if (!session)
                throw new common_1.NotFoundException('Grade session not found');
            if (session.status !== client_1.GradeStatus.OPEN)
                throw new common_1.ConflictException('Cannot close session twice');
            if (!session.gradeBuckets || session.gradeBuckets.length === 0) {
                throw new common_1.BadRequestException('At least one grade bucket is required to close');
            }
            const inputWeight = session.categoryOutput.weightKg;
            const sourceCost = session.categoryOutput.allocatedCost;
            const totalGradeOutputWeight = session.gradeBuckets.reduce((sum, b) => sum.add(b.outputWeightKg), new library_1.Decimal(0));
            if (totalGradeOutputWeight.equals(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('totalGradeOutputWeight must be > 0 to close');
            }
            const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
            if (wasteWeight.lessThan(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
            }
            const gradeYieldPercent = inputWeight.equals(new library_1.Decimal(0))
                ? new library_1.Decimal(0)
                : totalGradeOutputWeight.div(inputWeight).mul(new library_1.Decimal(100));
            const outputs = [];
            for (const bucket of session.gradeBuckets) {
                if (bucket.outputWeightKg.equals(new library_1.Decimal(0)) && bucket.outputCount === 0)
                    continue;
                const allocatedCost = bucket.outputWeightKg.div(totalGradeOutputWeight).mul(sourceCost);
                outputs.push(await tx.gradeOutput.create({
                    data: {
                        tenantId,
                        gradeBucketId: bucket.id,
                        gradeId: bucket.gradeId,
                        weightKg: bucket.outputWeightKg,
                        count: bucket.outputCount,
                        allocatedCost,
                    },
                }));
            }
            const closed = await tx.gradeSession.update({
                where: { id: sessionId },
                data: {
                    status: client_1.GradeStatus.CLOSED,
                    endTime: new Date(),
                },
            });
            return {
                session: closed,
                outputs,
                wasteWeight: wasteWeight.toString(),
                gradeYieldPercent: gradeYieldPercent.toNumber(),
            };
        });
        await this.auditService.log({
            tenantId,
            userId: currentUserId,
            action: 'GRADE_SESSION_CLOSED',
            entityType: 'GradeSession',
            entityId: sessionId,
            metadataJson: {
                outputsCreated: result.outputs.length,
                wasteWeight: result.wasteWeight,
                gradeYieldPercent: result.gradeYieldPercent,
            },
        });
        return result;
    }
};
exports.GradeSessionService = GradeSessionService;
exports.GradeSessionService = GradeSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GradeSessionService);
//# sourceMappingURL=grade-session.service.js.map