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
exports.RepackItemService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const library_1 = require("@prisma/client/runtime/library");
const client_1 = require("@prisma/client");
const qr_payload_util_1 = require("../qr-label/qr-payload.util");
let RepackItemService = class RepackItemService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async addItem(tenantId, unitId, dto, userId) {
        return this.prisma.$transaction(async (tx) => {
            const unit = await tx.repackUnit.findFirst({
                where: { id: unitId, tenantId },
                include: {
                    repackSession: { select: { id: true, status: true } },
                    category: { select: { name: true } },
                    grade: { select: { name: true } },
                    qrLabel: true,
                },
            });
            if (!unit)
                throw new common_1.NotFoundException('Repack unit not found');
            if (unit.repackSession.status !== client_1.RepackSessionStatus.OPEN) {
                throw new common_1.ConflictException('Cannot add items to a unit in a CLOSED repack session');
            }
            const gradeOutput = await tx.gradeOutput.findFirst({
                where: { id: dto.gradeOutputId, tenantId },
                include: {
                    grade: { select: { id: true, name: true } },
                    gradeBucket: {
                        include: {
                            gradeSession: {
                                include: {
                                    categoryOutput: { select: { id: true, categoryId: true, weightKg: true, allocatedCost: true } },
                                },
                            },
                        },
                    },
                },
            });
            if (!gradeOutput)
                throw new common_1.BadRequestException('Invalid GradeOutput');
            const categoryOutput = gradeOutput.gradeBucket.gradeSession.categoryOutput;
            const sourceCategory = await tx.category.findFirst({
                where: { id: categoryOutput.categoryId, tenantId },
                select: { id: true, name: true },
            });
            if (!sourceCategory)
                throw new common_1.BadRequestException('Source category not found');
            if (unit.unitType !== client_1.UnitType.MIXED_BALE) {
                if (!unit.categoryId || !unit.gradeId) {
                    throw new common_1.BadRequestException('Unit is missing category/grade');
                }
                if (unit.categoryId !== sourceCategory.id) {
                    throw new common_1.BadRequestException('GradeOutput category does not match RepackUnit category');
                }
                if (unit.gradeId !== gradeOutput.gradeId) {
                    throw new common_1.BadRequestException('GradeOutput grade does not match RepackUnit grade');
                }
            }
            const unitTotals = await tx.repackItem.aggregate({
                where: { repackUnitId: unitId },
                _sum: { weightKg: true, pcsCount: true },
            });
            const usedUnitWeight = unitTotals._sum.weightKg || new library_1.Decimal(0);
            const usedUnitPcs = unitTotals._sum.pcsCount || 0;
            const nextUsedWeight = usedUnitWeight.add(new library_1.Decimal(dto.weightKg));
            const nextUsedPcs = usedUnitPcs + (dto.pcsCount || 0);
            if (nextUsedWeight.greaterThan(unit.weightKg)) {
                throw new common_1.BadRequestException('Cannot consume more weight than unit target weightKg');
            }
            if (unit.unitType === client_1.UnitType.PCS_PACK && nextUsedPcs > unit.pcsCount) {
                throw new common_1.BadRequestException('Cannot consume more pcs than unit target pcsCount');
            }
            const consumed = await tx.repackItem.aggregate({
                where: {
                    sourceType: client_1.SourceType.GRADE_OUTPUT,
                    sourceId: dto.gradeOutputId,
                    repackUnit: { tenantId },
                },
                _sum: { weightKg: true, pcsCount: true },
            });
            const alreadyConsumedWeight = consumed._sum.weightKg || new library_1.Decimal(0);
            const alreadyConsumedPcs = consumed._sum.pcsCount || 0;
            const remainingWeight = gradeOutput.weightKg.sub(alreadyConsumedWeight);
            const remainingPcs = gradeOutput.count - alreadyConsumedPcs;
            if (new library_1.Decimal(dto.weightKg).greaterThan(remainingWeight)) {
                throw new common_1.BadRequestException('Over-consumption: remaining weight would be negative');
            }
            if ((dto.pcsCount || 0) > remainingPcs) {
                throw new common_1.BadRequestException('Over-consumption: remaining pcs would be negative');
            }
            if (gradeOutput.weightKg.equals(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('Invalid GradeOutput weightKg (0)');
            }
            const itemCost = new library_1.Decimal(dto.weightKg).div(gradeOutput.weightKg).mul(gradeOutput.allocatedCost);
            const item = await tx.repackItem.create({
                data: {
                    repackUnitId: unitId,
                    sourceType: client_1.SourceType.GRADE_OUTPUT,
                    sourceId: dto.gradeOutputId,
                    weightKg: dto.weightKg,
                    pcsCount: dto.pcsCount || 0,
                },
            });
            const updatedUnit = await tx.repackUnit.update({
                where: { id: unitId },
                data: {
                    totalCost: unit.totalCost.add(itemCost),
                },
                include: {
                    category: { select: { name: true } },
                    grade: { select: { name: true } },
                    qrLabel: true,
                },
            });
            const payload = {
                unitId: updatedUnit.id,
                unitCode: updatedUnit.unitCode,
                category: updatedUnit.category?.name ?? null,
                grade: updatedUnit.grade?.name ?? null,
                weightKg: updatedUnit.weightKg.toString(),
                pcsCount: updatedUnit.pcsCount,
                totalCost: updatedUnit.totalCost.toString(),
                createdAt: updatedUnit.createdAt.toISOString(),
            };
            const qrCode = (0, qr_payload_util_1.encodeQrPayload)(payload);
            await tx.qRLabel.upsert({
                where: { repackUnitId: updatedUnit.id },
                update: { qrCode, generatedAt: new Date() },
                create: { repackUnitId: updatedUnit.id, qrCode },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'GRADE_OUTPUT_CONSUMED',
                entityType: 'RepackItem',
                entityId: item.id,
                metadataJson: {
                    repackUnitId: unitId,
                    gradeOutputId: dto.gradeOutputId,
                    consumedWeightKg: dto.weightKg,
                    consumedPcs: dto.pcsCount || 0,
                    itemCost: itemCost.toString(),
                },
            });
            return { item, unit: updatedUnit, itemCost: itemCost.toString() };
        });
    }
};
exports.RepackItemService = RepackItemService;
exports.RepackItemService = RepackItemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RepackItemService);
//# sourceMappingURL=repack-item.service.js.map