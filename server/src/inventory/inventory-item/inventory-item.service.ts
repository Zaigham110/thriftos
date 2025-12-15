import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, MovementType, RepackStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto, IntakeDto } from './dto';

@Injectable()
export class InventoryItemService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async intake(tenantId: string, dto: IntakeDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId },
        select: { id: true, name: true },
      });
      if (!warehouse) throw new BadRequestException('Invalid warehouse');

      const unit = await tx.repackUnit.findFirst({
        where: { id: dto.repackUnitId, tenantId },
        include: {
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
        },
      });
      if (!unit) throw new BadRequestException('RepackUnit not found');
      if (unit.status !== RepackStatus.READY) {
        throw new ConflictException('RepackUnit must be READY for intake');
      }
      if (!unit.categoryId || !unit.gradeId) {
        throw new BadRequestException('RepackUnit must have categoryId and gradeId to intake');
      }

      const existing = await tx.inventoryItem.findFirst({
        where: { tenantId, repackUnitId: unit.id },
        select: { id: true },
      });
      if (existing) throw new ConflictException('Duplicate intake: InventoryItem already exists for this RepackUnit');

      // avgCost = totalCost / (weight or pcs)
      const denom =
        unit.pcsCount > 0 ? new Decimal(unit.pcsCount) : unit.weightKg;
      if (denom.equals(new Decimal(0))) {
        throw new BadRequestException('Cannot compute avgCost with zero denominator');
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
          status: InventoryStatus.AVAILABLE,
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
          movementType: MovementType.INTAKE,
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

      // Logical link: mark unit as RESERVED so it can’t be re-intaked and indicates it’s now in inventory.
      await tx.repackUnit.update({
        where: { id: unit.id },
        data: { status: RepackStatus.RESERVED },
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

  async findAll(
    tenantId: string,
    options?: {
      categoryId?: string;
      gradeId?: string;
      warehouseId?: string;
      status?: InventoryStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
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

  async findOne(tenantId: string, id: string) {
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
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async adjust(tenantId: string, id: string, dto: AdjustInventoryDto, userId: string) {
    const kgDelta = new Decimal(dto.quantityKgDelta ?? 0);
    const pcsDelta = dto.quantityPcsDelta ?? 0;
    if (kgDelta.equals(new Decimal(0)) && pcsDelta === 0) {
      throw new BadRequestException('At least one of quantityKgDelta or quantityPcsDelta must be provided');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id, tenantId },
      });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (item.status === InventoryStatus.SOLD) throw new ConflictException('SOLD inventory is immutable');

      const nextKg = item.weightKg.add(kgDelta);
      const nextPcs = item.pcsCount + pcsDelta;
      if (nextKg.lessThan(new Decimal(0)) || nextPcs < 0) {
        throw new BadRequestException('Cannot adjust below zero');
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: {
          weightKg: nextKg,
          pcsCount: nextPcs,
          // status remains AVAILABLE unless sold/reserved rules apply (prompt: keep unless hits zero)
          ...(nextKg.equals(new Decimal(0)) && nextPcs === 0 ? { status: InventoryStatus.AVAILABLE } : {}),
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          movementType: MovementType.ADJUSTMENT,
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

  async reserve(tenantId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (item.status === InventoryStatus.SOLD) throw new ConflictException('SOLD inventory cannot be reserved');
      if (item.status !== InventoryStatus.AVAILABLE) throw new ConflictException('Only AVAILABLE inventory can be reserved');

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { status: InventoryStatus.RESERVED },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          movementType: MovementType.RESERVATION,
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

  async release(tenantId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (item.status === InventoryStatus.SOLD) throw new ConflictException('SOLD inventory cannot be released');
      if (item.status !== InventoryStatus.RESERVED) throw new ConflictException('Only RESERVED inventory can be released');

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { status: InventoryStatus.AVAILABLE },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          movementType: MovementType.RELEASE,
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
}


