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
exports.GradeBucketService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const audit_service_1 = require("../../audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let GradeBucketService = class GradeBucketService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createForSession(tenantId, sessionId, dto, userId) {
        const session = await this.prisma.gradeSession.findFirst({
            where: { id: sessionId, tenantId },
            include: { categoryOutput: { select: { weightKg: true } } },
        });
        if (!session)
            throw new common_1.NotFoundException('Grade session not found');
        if (session.status !== client_1.GradeStatus.OPEN)
            throw new common_1.ConflictException('Cannot add buckets after closing');
        const grade = await this.prisma.grade.findFirst({
            where: { id: dto.gradeId, tenantId, isActive: true },
            select: { id: true, name: true },
        });
        if (!grade)
            throw new common_1.BadRequestException('Invalid grade');
        const existing = await this.prisma.gradeBucket.findUnique({
            where: { gradeSessionId_gradeId: { gradeSessionId: sessionId, gradeId: dto.gradeId } },
            select: { id: true },
        });
        if (existing)
            throw new common_1.ConflictException('Bucket already exists for this grade in this session');
        const bucket = await this.prisma.gradeBucket.create({
            data: {
                gradeSessionId: sessionId,
                gradeId: dto.gradeId,
                outputWeightKg: dto.outputWeightKg,
                outputCount: dto.outputCount,
            },
        });
        await this.validateNonNegativeWaste(sessionId, session.categoryOutput.weightKg);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_BUCKET_CREATED',
            entityType: 'GradeBucket',
            entityId: bucket.id,
            metadataJson: {
                gradeSessionId: sessionId,
                gradeId: dto.gradeId,
                gradeName: grade.name,
                outputWeightKg: bucket.outputWeightKg.toString(),
                outputCount: bucket.outputCount,
            },
        });
        return bucket;
    }
    async update(tenantId, bucketId, dto, userId) {
        const bucket = await this.prisma.gradeBucket.findFirst({
            where: { id: bucketId, gradeSession: { tenantId } },
            include: { gradeSession: { include: { categoryOutput: { select: { weightKg: true } } } } },
        });
        if (!bucket)
            throw new common_1.NotFoundException('Grade bucket not found');
        if (bucket.gradeSession.status !== client_1.GradeStatus.OPEN)
            throw new common_1.ConflictException('Cannot edit buckets after closing');
        const updated = await this.prisma.gradeBucket.update({
            where: { id: bucketId },
            data: {
                outputWeightKg: dto.outputWeightKg,
                outputCount: dto.outputCount,
            },
        });
        await this.validateNonNegativeWaste(bucket.gradeSession.id, bucket.gradeSession.categoryOutput.weightKg);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_BUCKET_UPDATED',
            entityType: 'GradeBucket',
            entityId: bucketId,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async delete(tenantId, bucketId, userId) {
        const bucket = await this.prisma.gradeBucket.findFirst({
            where: { id: bucketId, gradeSession: { tenantId } },
            include: { gradeSession: { include: { categoryOutput: { select: { weightKg: true } } } } },
        });
        if (!bucket)
            throw new common_1.NotFoundException('Grade bucket not found');
        if (bucket.gradeSession.status !== client_1.GradeStatus.OPEN)
            throw new common_1.ConflictException('Cannot delete buckets after closing');
        await this.prisma.gradeBucket.delete({ where: { id: bucketId } });
        await this.validateNonNegativeWaste(bucket.gradeSession.id, bucket.gradeSession.categoryOutput.weightKg);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_BUCKET_DELETED',
            entityType: 'GradeBucket',
            entityId: bucketId,
            metadataJson: { gradeSessionId: bucket.gradeSessionId, gradeId: bucket.gradeId },
        });
        return { success: true };
    }
    async validateNonNegativeWaste(gradeSessionId, inputWeight) {
        const totals = await this.prisma.gradeBucket.aggregate({
            where: { gradeSessionId },
            _sum: { outputWeightKg: true },
        });
        const totalGradeOutputWeight = totals._sum.outputWeightKg || new library_1.Decimal(0);
        const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
        if (wasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
        }
    }
};
exports.GradeBucketService = GradeBucketService;
exports.GradeBucketService = GradeBucketService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GradeBucketService);
//# sourceMappingURL=grade-bucket.service.js.map