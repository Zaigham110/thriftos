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
exports.InventoryItemService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const audit_service_1 = require("../../audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let InventoryItemService = class InventoryItemService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async intake(tenantId, dto, userId) {
        return this.prisma.$transaction(async (tx) => {
            const warehouse = await tx.warehouse.findFirst({
                where: { id: dto.warehouseId, tenantId },
                select: { id: true, name: true },
            });
            if (!warehouse)
                throw new common_1.BadRequestException('Invalid warehouse');
            const unit = await tx.repackUnit.findFirst({
                where: { id: dto.repackUnitId, tenantId },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                },
            });
            if (!unit)
                throw new common_1.BadRequestException('RepackUnit not found');
            if (unit.status !== client_1.RepackStatus.READY) {
                throw new common_1.ConflictException('RepackUnit must be READY for intake');
            }
            if (!unit.categoryId || !unit.gradeId) {
                throw new common_1.BadRequestException('RepackUnit must have categoryId and gradeId to intake');
            }
            const existing = await tx.inventoryItem.findFirst({
                where: { tenantId, repackUnitId: unit.id },
                select: { id: true },
            });
            if (existing)
                throw new common_1.ConflictException('Duplicate intake: InventoryItem already exists for this RepackUnit');
            const denom = unit.pcsCount > 0 ? new library_1.Decimal(unit.pcsCount) : unit.weightKg;
            if (denom.equals(new library_1.Decimal(0))) {
                throw new common_1.BadRequestException('Cannot compute avgCost with zero denominator');
            }
            const avgCost = unit.totalCost.div(denom);
            const item = await tx.inventoryItem.create({
                data: {
                    tenantId,
                    repackUnitId: unit.id,
                    categoryId: unit.categoryId,
                    gradeId: unit.gradeId,
                    weightKg: unit.weightKg,
                    pcsCount: unit.pcsCount,
                    avgCost,
                    warehouseId: warehouse.id,
                    status: client_1.InventoryStatus.AVAILABLE,
                },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true } },
                },
            });
            await tx.stockMovement.create({
                data: {
                    inventoryItemId: item.id,
                    movementType: client_1.MovementType.INTAKE,
                    quantityKg: item.weightKg,
                    quantityPcs: item.pcsCount,
                    referenceId: unit.id,
                    metadataJson: {
                        repackUnitId: unit.id,
                        unitCode: unit.unitCode,
                        warehouseId: warehouse.id,
                        warehouseName: warehouse.name,
                        avgCost: avgCost.toString(),
                    },
                },
            });
            await tx.repackUnit.update({
                where: { id: unit.id },
                data: { status: client_1.RepackStatus.RESERVED },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'INVENTORY_INTAKE',
                entityType: 'InventoryItem',
                entityId: item.id,
                metadataJson: {
                    repackUnitId: unit.id,
                    unitCode: unit.unitCode,
                    category: unit.category?.name,
                    grade: unit.grade?.name,
                    weightKg: unit.weightKg.toString(),
                    pcsCount: unit.pcsCount,
                    warehouse: warehouse.name,
                },
            });
            return item;
        });
    }
    async findAll(tenantId, options) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;
        const where = {
            tenantId,
            ...(options?.categoryId && { categoryId: options.categoryId }),
            ...(options?.gradeId && { gradeId: options.gradeId }),
            ...(options?.warehouseId && { warehouseId: options.warehouseId }),
            ...(options?.status && { status: options.status }),
        };
        const [data, total] = await Promise.all([
            this.prisma.inventoryItem.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { id: true, name: true } },
                    grade: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, name: true, code: true } },
                    repackUnit: { select: { id: true, unitCode: true, unitType: true } },
                    _count: { select: { stockMovements: true } },
                },
            }),
            this.prisma.inventoryItem.count({ where }),
        ]);
        return { data, total, page, limit };
    }
    async findOne(tenantId, id) {
        const item = await this.prisma.inventoryItem.findFirst({
            where: { id, tenantId },
            include: {
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
                warehouse: { select: { id: true, name: true, code: true } },
                repackUnit: { select: { id: true, unitCode: true, unitType: true, weightKg: true, pcsCount: true, totalCost: true } },
                stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 },
            },
        });
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found');
        return item;
    }
    async adjust(tenantId, id, dto, userId) {
        const kgDelta = new library_1.Decimal(dto.quantityKgDelta ?? 0);
        const pcsDelta = dto.quantityPcsDelta ?? 0;
        if (kgDelta.equals(new library_1.Decimal(0)) && pcsDelta === 0) {
            throw new common_1.BadRequestException('At least one of quantityKgDelta or quantityPcsDelta must be provided');
        }
        return this.prisma.$transaction(async (tx) => {
            const item = await tx.inventoryItem.findFirst({
                where: { id, tenantId },
            });
            if (!item)
                throw new common_1.NotFoundException('Inventory item not found');
            if (item.status === client_1.InventoryStatus.SOLD)
                throw new common_1.ConflictException('SOLD inventory is immutable');
            const nextKg = item.weightKg.add(kgDelta);
            const nextPcs = item.pcsCount + pcsDelta;
            if (nextKg.lessThan(new library_1.Decimal(0)) || nextPcs < 0) {
                throw new common_1.BadRequestException('Cannot adjust below zero');
            }
            const updated = await tx.inventoryItem.update({
                where: { id },
                data: {
                    weightKg: nextKg,
                    pcsCount: nextPcs,
                    ...(nextKg.equals(new library_1.Decimal(0)) && nextPcs === 0 ? { status: client_1.InventoryStatus.AVAILABLE } : {}),
                },
            });
            await tx.stockMovement.create({
                data: {
                    inventoryItemId: id,
                    movementType: client_1.MovementType.ADJUSTMENT,
                    quantityKg: kgDelta,
                    quantityPcs: pcsDelta,
                    referenceId: null,
                    metadataJson: { reason: dto.reason },
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'INVENTORY_ADJUSTMENT',
                entityType: 'InventoryItem',
                entityId: id,
                metadataJson: { quantityKgDelta: kgDelta.toString(), quantityPcsDelta: pcsDelta, reason: dto.reason },
            });
            return updated;
        });
    }
    async reserve(tenantId, id, userId) {
        return this.prisma.$transaction(async (tx) => {
            const item = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
            if (!item)
                throw new common_1.NotFoundException('Inventory item not found');
            if (item.status === client_1.InventoryStatus.SOLD)
                throw new common_1.ConflictException('SOLD inventory cannot be reserved');
            if (item.status !== client_1.InventoryStatus.AVAILABLE)
                throw new common_1.ConflictException('Only AVAILABLE inventory can be reserved');
            const updated = await tx.inventoryItem.update({
                where: { id },
                data: { status: client_1.InventoryStatus.RESERVED },
            });
            await tx.stockMovement.create({
                data: {
                    inventoryItemId: id,
                    movementType: client_1.MovementType.RESERVATION,
                    quantityKg: item.weightKg,
                    quantityPcs: item.pcsCount,
                    metadataJson: { note: 'Reserved (full item)' },
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'INVENTORY_RESERVED',
                entityType: 'InventoryItem',
                entityId: id,
            });
            return updated;
        });
    }
    async release(tenantId, id, userId) {
        return this.prisma.$transaction(async (tx) => {
            const item = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
            if (!item)
                throw new common_1.NotFoundException('Inventory item not found');
            if (item.status === client_1.InventoryStatus.SOLD)
                throw new common_1.ConflictException('SOLD inventory cannot be released');
            if (item.status !== client_1.InventoryStatus.RESERVED)
                throw new common_1.ConflictException('Only RESERVED inventory can be released');
            const updated = await tx.inventoryItem.update({
                where: { id },
                data: { status: client_1.InventoryStatus.AVAILABLE },
            });
            await tx.stockMovement.create({
                data: {
                    inventoryItemId: id,
                    movementType: client_1.MovementType.RELEASE,
                    quantityKg: item.weightKg,
                    quantityPcs: item.pcsCount,
                    metadataJson: { note: 'Released (full item)' },
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'INVENTORY_RELEASED',
                entityType: 'InventoryItem',
                entityId: id,
            });
            return updated;
        });
    }
};
exports.InventoryItemService = InventoryItemService;
exports.InventoryItemService = InventoryItemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], InventoryItemService);
//# sourceMappingURL=inventory-item.service.js.map