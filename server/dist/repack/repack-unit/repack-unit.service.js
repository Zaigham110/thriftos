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
const repack_allocation_service_1 = require("../shared/repack-allocation.service");
let RepackUnitService = class RepackUnitService {
    constructor(prisma, auditService, allocationService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.allocationService = allocationService;
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
                    measurementType: 'WEIGHT',
                    targetAmount: dto.weightKg,
                    allocationMode: 'FIFO',
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
                inputAllocations: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        gradingOutput: {
                            select: {
                                id: true,
                                measurementType: true,
                                totalAmount: true,
                                usedAmount: true,
                                remainingAmount: true,
                                gradeId: true,
                                gradeBucket: {
                                    select: {
                                        gradeSession: {
                                            select: {
                                                categoryOutput: {
                                                    select: {
                                                        sortCategoryBucket: {
                                                            select: {
                                                                sortSession: {
                                                                    select: {
                                                                        rag: {
                                                                            select: {
                                                                                ragCode: true,
                                                                                container: {
                                                                                    select: {
                                                                                        containerNumber: true,
                                                                                    },
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!unit)
            throw new common_1.NotFoundException('Repack unit not found');
        const transformedAllocations = unit.inputAllocations.map((alloc) => {
            const go = alloc.gradingOutput;
            const rag = go?.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession?.rag;
            const containerNumber = rag?.container?.containerNumber;
            const ragCode = rag?.ragCode;
            return {
                ...alloc,
                containerNumber: containerNumber || null,
                ragCode: ragCode || null,
                gradingOutput: {
                    id: go?.id,
                    measurementType: go?.measurementType,
                    totalAmount: go?.totalAmount,
                    usedAmount: go?.usedAmount,
                    remainingAmount: go?.remainingAmount,
                    gradeId: go?.gradeId,
                },
            };
        });
        if (unit.status !== client_1.RepackStatus.DRAFT) {
            return {
                ...unit,
                inputAllocations: transformedAllocations,
            };
        }
        if (!unit.categoryId || !unit.gradeId || !unit.measurementType) {
            return {
                ...unit,
                inputAllocations: transformedAllocations,
            };
        }
        const allocatedAmount = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
        const target = Number(unit.targetAmount ?? 0);
        const remainingTargetAmount = Math.max(0, target - allocatedAmount);
        const eligibleStock = await this.getAvailableStock(tenantId, unit.categoryId, unit.gradeId, unit.measurementType);
        return {
            ...unit,
            inputAllocations: transformedAllocations,
            allocatedAmount,
            remainingTargetAmount,
            eligibleStock,
        };
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
    async createV2Manual(tenantId, dto, userId) {
        if (!dto.manualAllocations || dto.manualAllocations.length === 0) {
            throw new common_1.BadRequestException('Manual allocations are required for MANUAL mode');
        }
        const category = await this.prisma.category.findFirst({
            where: { id: dto.categoryId, tenantId, isActive: true },
            select: { id: true, name: true },
        });
        if (!category)
            throw new common_1.BadRequestException('Invalid category');
        const grade = await this.prisma.grade.findFirst({
            where: { id: dto.gradeId, tenantId, isActive: true },
            select: { id: true, name: true },
        });
        if (!grade)
            throw new common_1.BadRequestException('Invalid grade');
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { companyCode: true },
        });
        if (!tenant)
            throw new common_1.BadRequestException('Tenant not found');
        let openSession = await this.prisma.repackSession.findFirst({
            where: { tenantId, status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (!openSession) {
            openSession = await this.prisma.repackSession.create({
                data: {
                    tenantId,
                    workerId: userId,
                    supervisorId: userId,
                    status: 'OPEN',
                },
                select: { id: true },
            });
        }
        const day = new Date();
        const dateToken = (0, unit_code_util_1.formatYYYYMMDD)(day);
        const tenantToken = (0, unit_code_util_1.tokenFromName)(tenant.companyCode, 10);
        const catToken = (0, unit_code_util_1.tokenFromName)(category.name, 6);
        const gradeToken = (0, unit_code_util_1.tokenFromName)(grade.name, 6);
        const unitCode = await this.generateUniqueUnitCode(this.prisma, tenantId, tenantToken, catToken, gradeToken, dateToken);
        const unit = await this.prisma.repackUnit.create({
            data: {
                tenantId,
                repackSessionId: openSession.id,
                categoryId: dto.categoryId,
                gradeId: dto.gradeId,
                unitCode,
                unitType: dto.measurementType === client_1.MeasurementType.WEIGHT ? client_1.UnitType.KG_BALE : client_1.UnitType.PCS_PACK,
                weightKg: dto.measurementType === client_1.MeasurementType.WEIGHT ? new library_1.Decimal(dto.targetAmount) : new library_1.Decimal(0),
                pcsCount: dto.measurementType === client_1.MeasurementType.QUANTITY ? dto.targetAmount : 0,
                totalCost: new library_1.Decimal(0),
                status: client_1.RepackStatus.DRAFT,
                measurementType: dto.measurementType,
                targetAmount: new library_1.Decimal(dto.targetAmount),
                allocationMode: client_1.AllocationMode.MANUAL,
                createdBy: userId,
            },
        });
        const allocationResult = await this.allocationService.allocateManual(tenantId, unit.id, dto.measurementType, dto.targetAmount, dto.manualAllocations);
        const updatedUnit = await this.prisma.repackUnit.update({
            where: { id: unit.id },
            data: {
                totalCost: new library_1.Decimal(allocationResult.totalCost),
            },
            include: {
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
                inputAllocations: true,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'REPACK_UNIT_V2_CREATED_MANUAL',
            entityType: 'RepackUnit',
            entityId: unit.id,
            metadataJson: {
                unitCode: unit.unitCode,
                allocationMode: 'MANUAL',
                targetAmount: dto.targetAmount,
                totalCost: allocationResult.totalCost,
                allocationsCount: allocationResult.allocations.length,
            },
        });
        return { repackUnit: updatedUnit, ...allocationResult };
    }
    async sealUnit(tenantId, unitId, userId) {
        return this.prisma.$transaction(async (tx) => {
            const unit = await tx.repackUnit.findFirst({
                where: { id: unitId, tenantId },
                include: {
                    inputAllocations: true,
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                },
            });
            if (!unit)
                throw new common_1.NotFoundException('Repack unit not found');
            if (unit.status !== client_1.RepackStatus.DRAFT) {
                throw new common_1.ConflictException('Only DRAFT units can be sealed');
            }
            if (unit.inputAllocations.length === 0) {
                throw new common_1.BadRequestException('Cannot seal unit without allocations');
            }
            const totalAllocated = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
            if (Math.abs(totalAllocated - Number(unit.targetAmount)) > 0.001) {
                throw new common_1.ConflictException(`Allocation mismatch: ${totalAllocated} allocated, ${unit.targetAmount} required`);
            }
            const sealed = await tx.repackUnit.update({
                where: { id: unitId },
                data: {
                    status: client_1.RepackStatus.SEALED,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    inputAllocations: true,
                },
            });
            const existingQr = await tx.qRLabel.findFirst({
                where: { repackUnitId: unitId },
            });
            if (!existingQr) {
                const payload = {
                    unitId: sealed.id,
                    unitCode: sealed.unitCode,
                    category: sealed.category?.name ?? null,
                    grade: sealed.grade?.name ?? null,
                    weightKg: sealed.weightKg.toString(),
                    pcsCount: sealed.pcsCount,
                    totalCost: sealed.totalCost.toString(),
                    createdAt: sealed.createdAt.toISOString(),
                };
                const qrCode = (0, qr_payload_util_1.encodeQrPayload)(payload);
                await tx.qRLabel.create({
                    data: {
                        repackUnitId: sealed.id,
                        qrCode,
                    },
                });
                await this.auditService.log({
                    tenantId,
                    userId,
                    action: 'QR_GENERATED',
                    entityType: 'QRLabel',
                    entityId: sealed.id,
                    metadataJson: { unitCode: sealed.unitCode },
                });
            }
            await this.auditService.log({
                tenantId,
                userId,
                action: 'REPACK_UNIT_SEALED',
                entityType: 'RepackUnit',
                entityId: sealed.id,
                metadataJson: {
                    unitCode: sealed.unitCode,
                    totalCost: sealed.totalCost.toString(),
                    allocationsCount: sealed.inputAllocations.length,
                },
            });
            return sealed;
        });
    }
    async getAvailableStock(tenantId, categoryId, gradeId, measurementType) {
        return this.allocationService.getAvailableStock(tenantId, categoryId, gradeId, measurementType);
    }
    async getDraftUnits(tenantId) {
        const units = await this.prisma.repackUnit.findMany({
            where: {
                tenantId,
                status: client_1.RepackStatus.DRAFT,
            },
            select: {
                id: true,
                unitCode: true,
                createdAt: true,
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
                targetAmount: true,
                measurementType: true,
                inputAllocations: { select: { amountUsed: true } },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return units.map((u) => {
            const allocatedAmount = (u.inputAllocations ?? []).reduce((sum, a) => sum + Number(a.amountUsed), 0);
            return {
                id: u.id,
                code: u.unitCode,
                category: u.category,
                grade: u.grade,
                targetAmount: u.targetAmount,
                allocatedAmount,
                createdAt: u.createdAt,
            };
        });
    }
    async getSealedUnits(tenantId) {
        const units = await this.prisma.repackUnit.findMany({
            where: {
                tenantId,
                status: client_1.RepackStatus.SEALED,
            },
            select: {
                id: true,
                unitCode: true,
                createdAt: true,
                updatedAt: true,
                weightKg: true,
                pcsCount: true,
                totalCost: true,
                status: true,
                measurementType: true,
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        return units.map((u) => ({
            id: u.id,
            unitCode: u.unitCode,
            status: u.status,
            category: u.category,
            grade: u.grade,
            weightKg: Number(u.weightKg) || 0,
            pcsCount: u.pcsCount || 0,
            totalCost: Number(u.totalCost) || 0,
            measurementType: u.measurementType,
            createdAt: u.createdAt,
            sealedAt: u.updatedAt,
        }));
    }
    async allocateToDraft(tenantId, unitId, allocations, userId) {
        return this.prisma.$transaction(async (tx) => {
            const unit = await tx.repackUnit.findFirst({
                where: { id: unitId, tenantId },
                include: { inputAllocations: true },
            });
            if (!unit)
                throw new common_1.NotFoundException('Repack unit not found');
            if (unit.status !== client_1.RepackStatus.DRAFT)
                throw new common_1.ConflictException('Only DRAFT units can be allocated');
            if (!unit.categoryId || !unit.gradeId)
                throw new common_1.BadRequestException('Draft unit must have categoryId and gradeId');
            if (!unit.measurementType)
                throw new common_1.BadRequestException('Draft unit must have measurementType');
            const alreadyAllocated = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
            const target = Number(unit.targetAmount ?? 0);
            const remainingTarget = Math.max(0, target - alreadyAllocated);
            if (remainingTarget <= 0.001)
                throw new common_1.ConflictException('Draft is already fully allocated');
            const append = await this.allocationService.appendManualAllocations(tenantId, unitId, unit.categoryId, unit.gradeId, unit.measurementType, remainingTarget, allocations, tx);
            const updatedUnit = await tx.repackUnit.update({
                where: { id: unitId },
                data: {
                    totalCost: new library_1.Decimal(Number(unit.totalCost ?? 0) + append.totalCost),
                    containerId: unit.containerId ?? append.allocations[0]?.containerId ?? undefined,
                    ragId: unit.ragId ?? append.allocations[0]?.ragBaleId ?? undefined,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    inputAllocations: true,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'REPACK_UNIT_DRAFT_ALLOCATED_APPEND',
                entityType: 'RepackUnit',
                entityId: unitId,
                metadataJson: {
                    addedAllocationsCount: append.allocations.length,
                    addedAmount: append.totalAllocated,
                    addedCost: append.totalCost,
                },
            });
            return {
                repackUnit: updatedUnit,
                appended: append,
            };
        });
    }
    async deallocateFromDraft(tenantId, unitId, allocationId, userId) {
        return this.prisma.$transaction(async (tx) => {
            const unit = await tx.repackUnit.findFirst({ where: { id: unitId, tenantId }, select: { id: true, status: true, totalCost: true } });
            if (!unit)
                throw new common_1.NotFoundException('Repack unit not found');
            if (unit.status !== client_1.RepackStatus.DRAFT)
                throw new common_1.ConflictException('Only DRAFT units can be deallocated');
            const result = await this.allocationService.deallocateSingle(tenantId, allocationId, tx);
            if (result.repackUnitId !== unitId)
                throw new common_1.ConflictException('Allocation does not belong to this repack unit');
            await tx.repackUnit.update({
                where: { id: unitId },
                data: {
                    totalCost: new library_1.Decimal(Math.max(0, Number(unit.totalCost ?? 0) - result.costRestored)),
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'REPACK_UNIT_DRAFT_DEALLOCATED',
                entityType: 'RepackUnit',
                entityId: unitId,
                metadataJson: {
                    allocationId,
                    gradingOutputId: result.gradingOutputId,
                    amountRestored: result.amountRestored,
                    costRestored: result.costRestored,
                },
            });
            return { success: true };
        });
    }
    async deleteDraft(tenantId, unitId, userId) {
        return this.prisma.$transaction(async (tx) => {
            const unit = await tx.repackUnit.findFirst({
                where: { id: unitId, tenantId },
            });
            if (!unit)
                throw new common_1.NotFoundException('Repack unit not found');
            if (unit.status !== client_1.RepackStatus.DRAFT) {
                throw new common_1.ConflictException('Only DRAFT units can be deleted');
            }
            await this.allocationService.deallocate(tenantId, unitId);
            await tx.repackUnit.delete({
                where: { id: unitId },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'REPACK_UNIT_DRAFT_DELETED',
                entityType: 'RepackUnit',
                entityId: unitId,
                metadataJson: {
                    unitCode: unit.unitCode,
                },
            });
            return { success: true };
        });
    }
};
exports.RepackUnitService = RepackUnitService;
exports.RepackUnitService = RepackUnitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        repack_allocation_service_1.RepackAllocationService])
], RepackUnitService);
//# sourceMappingURL=repack-unit.service.js.map