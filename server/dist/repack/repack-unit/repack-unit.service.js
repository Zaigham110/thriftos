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
exports.RepackUnitService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const unit_code_util_1 = require("./unit-code.util");
const qr_payload_util_1 = require("../qr-label/qr-payload.util");
let RepackUnitService = class RepackUnitService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createForSession(tenantId, sessionId, dto, userId) {
        return this.prisma.$transaction(async (tx) => {
            const session = await tx.repackSession.findFirst({
                where: { id: sessionId, tenantId },
                select: { id: true, tenantId: true, status: true },
            });
            if (!session)
                throw new common_1.NotFoundException('Repack session not found');
            if (session.status !== client_1.RepackSessionStatus.OPEN) {
                throw new common_1.ConflictException('Cannot add units if session is CLOSED');
            }
            const pcsCount = dto.pcsCount ?? 0;
            if (dto.unitType === client_1.UnitType.PCS_PACK && pcsCount <= 0) {
                throw new common_1.BadRequestException('PCS_PACK requires pcsCount > 0');
            }
            if (dto.unitType !== client_1.UnitType.MIXED_BALE) {
                if (!dto.categoryId || !dto.gradeId) {
                    throw new common_1.BadRequestException('categoryId and gradeId are required for non-mixed units');
                }
            }
            const tenant = await tx.tenant.findUnique({
                where: { id: tenantId },
                select: { companyCode: true },
            });
            if (!tenant)
                throw new common_1.BadRequestException('Tenant not found');
            let categoryName = null;
            let gradeName = null;
            if (dto.unitType !== client_1.UnitType.MIXED_BALE) {
                const category = await tx.category.findFirst({
                    where: { id: dto.categoryId, tenantId, isActive: true },
                    select: { name: true },
                });
                if (!category)
                    throw new common_1.BadRequestException('Invalid category');
                categoryName = category.name;
                const grade = await tx.grade.findFirst({
                    where: { id: dto.gradeId, tenantId, isActive: true },
                    select: { name: true },
                });
                if (!grade)
                    throw new common_1.BadRequestException('Invalid grade');
                gradeName = grade.name;
            }
            const day = new Date();
            const dateToken = (0, unit_code_util_1.formatYYYYMMDD)(day);
            const tenantToken = (0, unit_code_util_1.tokenFromName)(tenant.companyCode, 10);
            const catToken = dto.unitType === client_1.UnitType.MIXED_BALE ? 'MIX' : (0, unit_code_util_1.tokenFromName)(categoryName || '', 6);
            const gradeToken = dto.unitType === client_1.UnitType.MIXED_BALE ? 'MIX' : (0, unit_code_util_1.tokenFromName)(gradeName || '', 6);
            const unitCode = await this.generateUniqueUnitCode(tx, tenantId, tenantToken, catToken, gradeToken, dateToken);
            const unit = await tx.repackUnit.create({
                data: {
                    tenantId,
                    repackSessionId: sessionId,
                    categoryId: dto.unitType === client_1.UnitType.MIXED_BALE ? null : dto.categoryId,
                    gradeId: dto.unitType === client_1.UnitType.MIXED_BALE ? null : dto.gradeId,
                    unitCode,
                    unitType: dto.unitType,
                    weightKg: dto.weightKg,
                    pcsCount,
                    totalCost: new library_1.Decimal(0),
                },
                include: {
                    category: { select: { name: true } },
                    grade: { select: { name: true } },
                },
            });
            const payload = {
                unitId: unit.id,
                unitCode: unit.unitCode,
                category: unit.category?.name ?? null,
                grade: unit.grade?.name ?? null,
                weightKg: unit.weightKg.toString(),
                pcsCount: unit.pcsCount,
                totalCost: unit.totalCost.toString(),
                createdAt: unit.createdAt.toISOString(),
            };
            const qrCode = (0, qr_payload_util_1.encodeQrPayload)(payload);
            await tx.qRLabel.create({
                data: {
                    repackUnitId: unit.id,
                    qrCode,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'REPACK_UNIT_CREATED',
                entityType: 'RepackUnit',
                entityId: unit.id,
                metadataJson: {
                    unitCode: unit.unitCode,
                    unitType: unit.unitType,
                    weightKg: unit.weightKg.toString(),
                    pcsCount: unit.pcsCount,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'QR_GENERATED',
                entityType: 'QRLabel',
                entityId: unit.id,
                metadataJson: { unitCode: unit.unitCode },
            });
            return unit;
        });
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.sessionId && { repackSessionId: options.sessionId }),
        };
        const [data, total] = await Promise.all([
            this.prisma.repackUnit.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    qrLabel: true,
                    repackSession: { select: { id: true, status: true } },
                    _count: { select: { repackItems: true } },
                },
            }),
            this.prisma.repackUnit.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const unit = await this.prisma.repackUnit.findFirst({
            where: { id, tenantId },
            include: {
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
                qrLabel: true,
                repackSession: { select: { id: true, status: true } },
                repackItems: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!unit)
            throw new common_1.NotFoundException('Repack unit not found');
        return unit;
    }
    async generateUniqueUnitCode(tx, tenantId, tenantToken, catToken, gradeToken, dateToken) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const dayStart = new Date(Date.UTC(parseInt(dateToken.slice(0, 4)), parseInt(dateToken.slice(4, 6)) - 1, parseInt(dateToken.slice(6, 8)), 0, 0, 0));
            const dayEnd = new Date(Date.UTC(parseInt(dateToken.slice(0, 4)), parseInt(dateToken.slice(4, 6)) - 1, parseInt(dateToken.slice(6, 8)) + 1, 0, 0, 0));
            const countToday = await tx.repackUnit.count({
                where: {
                    tenantId,
                    createdAt: { gte: dayStart, lt: dayEnd },
                },
            });
            const seq = (0, unit_code_util_1.formatSeq)(countToday + 1 + attempt);
            const unitCode = `${tenantToken}-${catToken}-${gradeToken}-${dateToken}-${seq}`;
            const existing = await tx.repackUnit.findFirst({
                where: { tenantId, unitCode },
                select: { id: true },
            });
            if (!existing)
                return unitCode;
        }
        throw new common_1.ConflictException('Could not generate unique unitCode');
    }
};
exports.RepackUnitService = RepackUnitService;
exports.RepackUnitService = RepackUnitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RepackUnitService);
//# sourceMappingURL=repack-unit.service.js.map