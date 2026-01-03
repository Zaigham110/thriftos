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
exports.RepackV3Service = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const unit_code_util_1 = require("../repack-unit/unit-code.util");
let RepackV3Service = class RepackV3Service {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getAvailableStock(tenantId, categoryId, gradeId, measurementType) {
        if (!categoryId || !gradeId || !measurementType) {
            throw new common_1.BadRequestException('categoryId, gradeId and measurementType are required');
        }
        const rows = await this.prisma.gradeOutput.findMany({
            where: {
                tenantId,
                gradeId,
                measurementType,
                status: { in: [client_1.GradingOutputStatus.AVAILABLE, client_1.GradingOutputStatus.PARTIALLY_USED, client_1.GradingOutputStatus.READY_FOR_REPACK] },
                remainingAmount: { gt: 0 },
                gradeBucket: {
                    gradeSession: {
                        categoryOutput: {
                            categoryId,
                        },
                    },
                },
            },
            include: {
                grade: { select: { id: true, name: true } },
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: {
                                    include: {
                                        category: { select: { id: true, name: true } },
                                        sortCategoryBucket: {
                                            include: {
                                                sortSession: {
                                                    include: {
                                                        rag: {
                                                            include: {
                                                                container: { select: { id: true, containerNumber: true } },
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
            orderBy: {
                gradeBucket: {
                    gradeSession: {
                        endTime: 'asc',
                    },
                },
            },
        });
        return rows.map((o) => {
            const gs = o.gradeBucket?.gradeSession;
            const co = gs?.categoryOutput;
            const ss = co?.sortCategoryBucket?.sortSession;
            const rag = ss?.rag;
            const container = rag?.container;
            const sourceType = container?.id ? 'CONTAINER' : 'LOOSE_BALE';
            const sourceId = rag?.id ?? null;
            const totalAmountNum = Number(o.totalAmount) || 0;
            const allocatedCostNum = Number(o.allocatedCost) || 0;
            const costPerUnit = totalAmountNum > 0 ? allocatedCostNum / totalAmountNum : 0;
            return {
                id: o.id,
                tenantId: o.tenantId,
                categoryId: co?.category?.id ?? categoryId,
                categoryName: co?.category?.name ?? 'Unknown',
                gradeId: o.gradeId,
                gradeName: o.grade?.name ?? 'Unknown',
                measurementType: o.measurementType,
                totalAmount: Number(o.totalAmount),
                usedAmount: Number(o.usedAmount),
                remainingAmount: Number(o.remainingAmount),
                allocatedCost: allocatedCostNum,
                costPerUnit,
                status: o.status,
                sourceType,
                sourceId,
                containerId: container?.id ?? null,
                containerNumber: container?.containerNumber ?? null,
                ragId: rag?.id ?? null,
                ragCode: rag?.ragCode ?? null,
                sortSessionId: ss?.id ?? null,
                gradeSessionId: gs?.id ?? null,
                fifoTimestamp: gs?.endTime ? gs.endTime.toISOString() : null,
                createdAt: o.createdAt.toISOString(),
            };
        });
    }
    async createDraftManual(tenantId, dto, userId) {
        return this.prisma.$transaction(async (tx) => {
            this.assertDraftInputs(dto);
            if (!dto.manualAllocations || dto.manualAllocations.length === 0) {
                throw new common_1.BadRequestException('manualAllocations are required for MANUAL mode');
            }
            const totalRequested = dto.manualAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
            if (totalRequested <= 0) {
                throw new common_1.BadRequestException('Manual allocation total must be greater than zero');
            }
            const { openSessionId, unitCode } = await this.ensureOpenSessionAndUnitCode(tx, tenantId, dto.categoryId, dto.gradeId, userId);
            const unit = await tx.repackUnit.create({
                data: {
                    tenantId,
                    repackSessionId: openSessionId,
                    categoryId: dto.categoryId,
                    gradeId: dto.gradeId,
                    unitCode,
                    unitType: dto.measurementType === client_1.MeasurementType.WEIGHT ? client_1.UnitType.KG_BALE : client_1.UnitType.PCS_PACK,
                    weightKg: dto.measurementType === client_1.MeasurementType.WEIGHT ? new library_1.Decimal(dto.targetAmount) : new library_1.Decimal(0),
                    pcsCount: dto.measurementType === client_1.MeasurementType.QUANTITY ? Math.trunc(dto.targetAmount) : 0,
                    totalCost: new library_1.Decimal(0),
                    status: client_1.RepackStatus.DRAFT,
                    measurementType: dto.measurementType,
                    targetAmount: new library_1.Decimal(dto.targetAmount),
                    allocationMode: client_1.AllocationMode.MANUAL,
                    createdBy: userId,
                },
            });
            const { allocations, totalCost, primaryTrace } = await this.allocateManualTx(tx, tenantId, unit.id, dto.categoryId, dto.gradeId, dto.measurementType, dto.targetAmount, dto.manualAllocations);
            const updatedUnit = await tx.repackUnit.update({
                where: { id: unit.id },
                data: {
                    totalCost: new library_1.Decimal(totalCost),
                    ...primaryTrace,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    inputAllocations: true,
                },
            });
            await this.audit.log({
                tenantId,
                userId,
                action: 'REPACK_V3_DRAFT_CREATED_MANUAL',
                entityType: 'RepackUnit',
                entityId: unit.id,
                metadataJson: { unitCode, targetAmount: dto.targetAmount, measurementType: dto.measurementType },
            });
            return {
                repackUnit: updatedUnit,
                allocations,
                totalAllocated: dto.targetAmount,
                totalCost,
            };
        });
    }
    async sealUnit(tenantId, unitId, warehouseId, userId) {
        return this.prisma.$transaction(async (tx) => {
            let warehouse = null;
            if (warehouseId) {
                warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, tenantId }, select: { id: true, name: true } });
                if (!warehouse)
                    throw new common_1.BadRequestException('Invalid warehouse');
            }
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
            if (unit.status !== client_1.RepackStatus.DRAFT)
                throw new common_1.ConflictException('Only DRAFT repack units can be sealed');
            if (unit.inputAllocations.length === 0)
                throw new common_1.BadRequestException('Cannot seal without allocations');
            if (!unit.categoryId || !unit.gradeId)
                throw new common_1.BadRequestException('Repack unit must have categoryId and gradeId');
            const allocatedAmount = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
            const targetAmount = Number(unit.targetAmount ?? 0);
            if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
                throw new common_1.BadRequestException('Invalid targetAmount on repack unit');
            }
            if (allocatedAmount < targetAmount - 0.001) {
                const shortfall = targetAmount - allocatedAmount;
                throw new common_1.BadRequestException(`Cannot seal: need ${shortfall.toFixed(2)} more to reach target of ${targetAmount}`);
            }
            let containerId = unit.containerId;
            let ragId = unit.ragId;
            if (!containerId || !ragId) {
                const firstAlloc = unit.inputAllocations[0];
                containerId = containerId ?? firstAlloc.containerId;
                ragId = ragId ?? firstAlloc.ragBaleId;
            }
            const sealedUnit = await tx.repackUnit.update({
                where: { id: unit.id },
                data: {
                    status: client_1.RepackStatus.SEALED,
                    containerId,
                    ragId,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    inputAllocations: true,
                },
            });
            const existingInv = await tx.inventoryItem.findFirst({ where: { tenantId, repackUnitId: sealedUnit.id }, select: { id: true } });
            if (existingInv)
                throw new common_1.ConflictException('Inventory already exists for this repack unit');
            const denom = sealedUnit.measurementType === client_1.MeasurementType.QUANTITY
                ? new library_1.Decimal(sealedUnit.pcsCount)
                : sealedUnit.weightKg;
            if (denom.equals(new library_1.Decimal(0)))
                throw new common_1.BadRequestException('Cannot create inventory with zero amount');
            const avgCost = sealedUnit.totalCost.div(denom);
            const inventoryItem = await tx.inventoryItem.create({
                data: {
                    tenantId,
                    repackUnitId: sealedUnit.id,
                    categoryId: sealedUnit.categoryId,
                    gradeId: sealedUnit.gradeId,
                    weightKg: sealedUnit.weightKg,
                    pcsCount: sealedUnit.pcsCount,
                    avgCost,
                    warehouseId: warehouse?.id ?? null,
                    status: client_1.InventoryStatus.AVAILABLE,
                    containerId: sealedUnit.containerId,
                    ragId: sealedUnit.ragId,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true, code: true } },
                },
            });
            await tx.stockMovement.create({
                data: {
                    inventoryItemId: inventoryItem.id,
                    movementType: client_1.MovementType.INTAKE,
                    quantityKg: inventoryItem.weightKg,
                    quantityPcs: inventoryItem.pcsCount,
                    referenceId: sealedUnit.id,
                    metadataJson: {
                        repackUnitId: sealedUnit.id,
                        unitCode: sealedUnit.unitCode,
                        warehouseId: warehouse?.id ?? null,
                        warehouseName: warehouse?.name ?? null,
                        avgCost: avgCost.toString(),
                    },
                },
            });
            const qrLabel = await tx.qRLabel.upsert({
                where: { repackUnitId: sealedUnit.id },
                create: {
                    repackUnitId: sealedUnit.id,
                    qrCode: `REPACK:${sealedUnit.unitCode}`,
                },
                update: {},
            });
            await this.audit.log({
                tenantId,
                userId,
                action: 'REPACK_V3_SEALED_AND_INTAKED',
                entityType: 'RepackUnit',
                entityId: sealedUnit.id,
                metadataJson: {
                    unitCode: sealedUnit.unitCode,
                    warehouseId: warehouse?.id ?? null,
                    inventoryItemId: inventoryItem.id,
                },
            });
            return { repackUnit: sealedUnit, inventoryItem, qrLabel };
        });
    }
    assertDraftInputs(dto) {
        if (!dto.categoryId)
            throw new common_1.BadRequestException('categoryId is required');
        if (!dto.gradeId)
            throw new common_1.BadRequestException('gradeId is required');
        if (!dto.measurementType)
            throw new common_1.BadRequestException('measurementType is required');
        if (!Number.isFinite(dto.targetAmount) || dto.targetAmount <= 0) {
            throw new common_1.BadRequestException('targetAmount must be > 0');
        }
    }
    async ensureOpenSessionAndUnitCode(tx, tenantId, categoryId, gradeId, userId) {
        const [tenant, category, grade] = await Promise.all([
            tx.tenant.findUnique({ where: { id: tenantId }, select: { companyCode: true } }),
            tx.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { name: true } }),
            tx.grade.findFirst({ where: { id: gradeId, tenantId, isActive: true }, select: { name: true } }),
        ]);
        if (!tenant)
            throw new common_1.BadRequestException('Tenant not found');
        if (!category)
            throw new common_1.BadRequestException('Invalid category');
        if (!grade)
            throw new common_1.BadRequestException('Invalid grade');
        let session = await tx.repackSession.findFirst({
            where: { tenantId, status: client_1.RepackSessionStatus.OPEN },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (!session) {
            session = await tx.repackSession.create({
                data: { tenantId, workerId: userId, supervisorId: userId, status: client_1.RepackSessionStatus.OPEN },
                select: { id: true },
            });
        }
        const dateToken = (0, unit_code_util_1.formatYYYYMMDD)(new Date());
        const tenantToken = (0, unit_code_util_1.tokenFromName)(tenant.companyCode, 10);
        const catToken = (0, unit_code_util_1.tokenFromName)(category.name, 6);
        const gradeToken = (0, unit_code_util_1.tokenFromName)(grade.name, 6);
        for (let attempt = 1; attempt <= 5; attempt++) {
            const count = await tx.repackUnit.count({
                where: {
                    tenantId,
                    unitCode: { startsWith: `${tenantToken}-${catToken}-${gradeToken}-${dateToken}` },
                },
            });
            const seq = String(count + attempt).padStart(4, '0');
            const unitCode = `${tenantToken}-${catToken}-${gradeToken}-${dateToken}-${seq}`;
            const exists = await tx.repackUnit.findFirst({ where: { tenantId, unitCode }, select: { id: true } });
            if (!exists) {
                return { openSessionId: session.id, unitCode };
            }
        }
        throw new common_1.ConflictException('Could not generate unique repack unit code');
    }
    async allocateManualTx(tx, tenantId, repackUnitId, categoryId, gradeId, measurementType, targetAmount, manualAllocations) {
        const ids = manualAllocations.map((a) => a.gradingOutputId);
        const uniq = new Set(ids);
        if (uniq.size !== ids.length)
            throw new common_1.BadRequestException('Duplicate gradingOutputId in manual allocations');
        const outputs = await tx.gradeOutput.findMany({
            where: {
                tenantId,
                id: { in: ids },
                gradeId,
                measurementType,
                status: { in: [client_1.GradingOutputStatus.AVAILABLE, client_1.GradingOutputStatus.PARTIALLY_USED] },
                gradeBucket: { gradeSession: { categoryOutput: { categoryId } } },
            },
            include: {
                gradeBucket: {
                    include: {
                        gradeSession: {
                            include: {
                                categoryOutput: {
                                    include: {
                                        sortCategoryBucket: { include: { sortSession: { include: { rag: { select: { id: true, containerId: true } } } } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (outputs.length !== manualAllocations.length) {
            throw new common_1.NotFoundException('Some grading outputs are missing or not eligible');
        }
        const allocations = [];
        let totalCost = 0;
        let primaryTrace = {};
        for (const input of manualAllocations) {
            const output = outputs.find((o) => o.id === input.gradingOutputId);
            if (!output)
                throw new common_1.NotFoundException(`Grading output not found: ${input.gradingOutputId}`);
            const take = Number(input.amountUsed);
            if (!Number.isFinite(take) || take <= 0)
                throw new common_1.BadRequestException('amountUsed must be > 0');
            if (Number(output.remainingAmount) < take) {
                throw new common_1.BadRequestException(`Insufficient remaining amount in grading output ${output.id}`);
            }
            const totalAmountNum = Number(output.totalAmount);
            const allocatedCostNum = Number(output.allocatedCost);
            if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
                throw new common_1.BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
            }
            if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
                throw new common_1.BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
            }
            const allocationCost = (allocatedCostNum / totalAmountNum) * take;
            if (!Number.isFinite(allocationCost)) {
                throw new common_1.BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
            }
            const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
            const rag = sortSession?.rag;
            const containerId = rag?.containerId ?? null;
            const ragBaleId = rag?.id ?? null;
            const updated = await tx.gradeOutput.updateMany({
                where: { id: output.id, tenantId, remainingAmount: output.remainingAmount, status: { not: client_1.GradingOutputStatus.DEPLETED } },
                data: {
                    usedAmount: { increment: new library_1.Decimal(take) },
                    remainingAmount: { decrement: new library_1.Decimal(take) },
                },
            });
            if (updated.count !== 1) {
                throw new common_1.ConflictException(`Concurrent update detected for grading output ${output.id}. Please retry.`);
            }
            const after = await tx.gradeOutput.findUnique({ where: { id: output.id }, select: { remainingAmount: true } });
            const remainingAfter = Number(after?.remainingAmount ?? 0);
            const newStatus = remainingAfter <= 0.001 ? client_1.GradingOutputStatus.DEPLETED : client_1.GradingOutputStatus.PARTIALLY_USED;
            await tx.gradeOutput.update({ where: { id: output.id }, data: { status: newStatus } });
            const alloc = await tx.repackInputAllocation.create({
                data: {
                    tenantId,
                    repackUnitId,
                    gradingOutputId: output.id,
                    containerId,
                    ragBaleId,
                    amountUsed: new library_1.Decimal(take),
                    measurementType,
                    allocatedCost: new library_1.Decimal(allocationCost),
                },
            });
            allocations.push({
                id: alloc.id,
                gradingOutputId: output.id,
                amountUsed: take,
                allocatedCost: allocationCost,
                containerId,
                ragBaleId,
            });
            if (allocations.length === 1) {
                primaryTrace = {
                    containerId,
                    ragId: ragBaleId,
                    sortSessionId: sortSession?.id ?? null,
                    gradeSessionId: output.gradeBucket?.gradeSession?.id ?? null,
                };
            }
            totalCost += allocationCost;
        }
        const totalAllocated = allocations.reduce((sum, a) => sum + a.amountUsed, 0);
        if (Math.abs(totalAllocated - targetAmount) > 0.001) {
            throw new common_1.BadRequestException(`Allocated total (${totalAllocated}) does not match target (${targetAmount})`);
        }
        return { allocations, totalCost, primaryTrace };
    }
};
exports.RepackV3Service = RepackV3Service;
exports.RepackV3Service = RepackV3Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RepackV3Service);
//# sourceMappingURL=repack-v3.service.js.map