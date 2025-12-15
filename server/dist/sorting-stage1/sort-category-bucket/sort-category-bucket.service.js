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
exports.SortCategoryBucketService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const library_1 = require("@prisma/client/runtime/library");
const client_1 = require("@prisma/client");
let SortCategoryBucketService = class SortCategoryBucketService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createForSession(tenantId, sessionId, dto, userId) {
        const session = await this.prisma.sortSession.findFirst({
            where: { id: sessionId, tenantId },
            select: { id: true, status: true, totalInputWeight: true },
        });
        if (!session)
            throw new common_1.NotFoundException('Sort session not found');
        if (session.status !== client_1.SortStatus.OPEN)
            throw new common_1.ConflictException('Cannot add buckets after closing');
        const category = await this.prisma.category.findFirst({
            where: { id: dto.categoryId, tenantId, isActive: true },
            select: { id: true, name: true },
        });
        if (!category)
            throw new common_1.BadRequestException('Invalid category');
        const existing = await this.prisma.sortCategoryBucket.findUnique({
            where: { sortSessionId_categoryId: { sortSessionId: sessionId, categoryId: dto.categoryId } },
            select: { id: true },
        });
        if (existing)
            throw new common_1.ConflictException('Bucket already exists for this category in this session');
        const bucket = await this.prisma.sortCategoryBucket.create({
            data: {
                sortSessionId: sessionId,
                categoryId: dto.categoryId,
                outputWeightKg: dto.outputWeightKg,
                outputCount: dto.outputCount,
            },
        });
        await this.recomputeTotalsOrThrow(sessionId, session.totalInputWeight);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SORT_BUCKET_CREATED',
            entityType: 'SortCategoryBucket',
            entityId: bucket.id,
            metadataJson: {
                sortSessionId: sessionId,
                categoryId: dto.categoryId,
                categoryName: category.name,
                outputWeightKg: bucket.outputWeightKg.toString(),
                outputCount: bucket.outputCount,
            },
        });
        return bucket;
    }
    async update(tenantId, bucketId, dto, userId) {
        const bucket = await this.prisma.sortCategoryBucket.findFirst({
            where: { id: bucketId, sortSession: { tenantId } },
            include: { sortSession: { select: { id: true, status: true, totalInputWeight: true } } },
        });
        if (!bucket)
            throw new common_1.NotFoundException('Bucket not found');
        if (bucket.sortSession.status !== client_1.SortStatus.OPEN)
            throw new common_1.ConflictException('Cannot edit buckets after closing');
        const updated = await this.prisma.sortCategoryBucket.update({
            where: { id: bucketId },
            data: {
                outputWeightKg: dto.outputWeightKg,
                outputCount: dto.outputCount,
            },
        });
        await this.recomputeTotalsOrThrow(bucket.sortSession.id, bucket.sortSession.totalInputWeight);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SORT_BUCKET_UPDATED',
            entityType: 'SortCategoryBucket',
            entityId: bucketId,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async delete(tenantId, bucketId, userId) {
        const bucket = await this.prisma.sortCategoryBucket.findFirst({
            where: { id: bucketId, sortSession: { tenantId } },
            include: { sortSession: { select: { id: true, status: true, totalInputWeight: true } } },
        });
        if (!bucket)
            throw new common_1.NotFoundException('Bucket not found');
        if (bucket.sortSession.status !== client_1.SortStatus.OPEN)
            throw new common_1.ConflictException('Cannot delete buckets after closing');
        await this.prisma.sortCategoryBucket.delete({ where: { id: bucketId } });
        await this.recomputeTotalsOrThrow(bucket.sortSession.id, bucket.sortSession.totalInputWeight);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SORT_BUCKET_DELETED',
            entityType: 'SortCategoryBucket',
            entityId: bucketId,
            metadataJson: { sortSessionId: bucket.sortSession.id, categoryId: bucket.categoryId },
        });
        return { success: true };
    }
    async recomputeTotalsOrThrow(sessionId, totalInputWeight) {
        const totals = await this.prisma.sortCategoryBucket.aggregate({
            where: { sortSessionId: sessionId },
            _sum: { outputWeightKg: true },
        });
        const totalOutputWeight = totals._sum.outputWeightKg || new library_1.Decimal(0);
        const wasteWeight = totalInputWeight.sub(totalOutputWeight);
        if (wasteWeight.lessThan(new library_1.Decimal(0))) {
            throw new common_1.BadRequestException('wasteWeight cannot be negative (output exceeds input)');
        }
        await this.prisma.sortSession.update({
            where: { id: sessionId },
            data: { totalOutputWeight, wasteWeight },
        });
    }
};
exports.SortCategoryBucketService = SortCategoryBucketService;
exports.SortCategoryBucketService = SortCategoryBucketService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SortCategoryBucketService);
//# sourceMappingURL=sort-category-bucket.service.js.map