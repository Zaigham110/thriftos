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
exports.GradesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
let GradesService = class GradesService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async findAll(tenantId) {
        return this.prisma.grade.findMany({
            where: { tenantId, isActive: true },
            orderBy: { rank: 'asc' },
        });
    }
    async findAllAdmin(tenantId) {
        return this.prisma.grade.findMany({
            where: { tenantId },
            orderBy: { rank: 'asc' },
        });
    }
    async findOne(tenantId, id) {
        const grade = await this.prisma.grade.findFirst({
            where: { id, tenantId },
        });
        if (!grade)
            throw new common_1.NotFoundException('Grade not found');
        return grade;
    }
    async create(tenantId, dto, userId) {
        const existing = await this.prisma.grade.findUnique({
            where: { tenantId_name: { tenantId, name: dto.name } },
        });
        if (existing)
            throw new common_1.ConflictException(`Grade "${dto.name}" already exists`);
        const rank = dto.rank ?? await this.getNextRank(tenantId);
        const grade = await this.prisma.grade.create({
            data: {
                tenantId,
                name: dto.name,
                description: dto.description,
                rank,
                isActive: true,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_CREATED',
            entityType: 'Grade',
            entityId: grade.id,
            metadataJson: { name: grade.name, rank: grade.rank },
        });
        return grade;
    }
    async update(tenantId, id, dto, userId) {
        const grade = await this.findOne(tenantId, id);
        if (dto.name && dto.name !== grade.name) {
            const existing = await this.prisma.grade.findUnique({
                where: { tenantId_name: { tenantId, name: dto.name } },
            });
            if (existing)
                throw new common_1.ConflictException(`Grade "${dto.name}" already exists`);
        }
        const updated = await this.prisma.grade.update({
            where: { id },
            data: {
                name: dto.name,
                description: dto.description,
                rank: dto.rank,
                isActive: dto.isActive,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_UPDATED',
            entityType: 'Grade',
            entityId: grade.id,
            metadataJson: { changes: dto },
        });
        return updated;
    }
    async remove(tenantId, id, userId) {
        const grade = await this.findOne(tenantId, id);
        const inUse = await this.prisma.gradeBucket.count({
            where: { gradeId: id },
        });
        if (inUse > 0) {
            throw new common_1.ConflictException('Cannot delete grade that is in use by grading sessions');
        }
        const updated = await this.prisma.grade.update({
            where: { id },
            data: { isActive: false },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GRADE_DELETED',
            entityType: 'Grade',
            entityId: grade.id,
            metadataJson: { name: grade.name },
        });
        return updated;
    }
    async getNextRank(tenantId) {
        const maxRank = await this.prisma.grade.aggregate({
            where: { tenantId },
            _max: { rank: true },
        });
        return (maxRank._max.rank || 0) + 1;
    }
};
exports.GradesService = GradesService;
exports.GradesService = GradesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GradesService);
//# sourceMappingURL=grades.service.js.map