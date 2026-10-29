import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  AllocationMode,
  GradingOutputStatus,
  InventoryStatus,
  MeasurementType,
  MovementType,
  RepackSessionStatus,
  RepackStatus,
  UnitType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateRepackUnitV2Dto } from '../repack-unit/dto';
import { formatYYYYMMDD, tokenFromName } from '../repack-unit/unit-code.util';

export type RepackSourceType = 'CONTAINER' | 'LOOSE_BALE';

export interface AvailableStockRow {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName: string;
  gradeId: string;
  gradeName: string;
  measurementType: MeasurementType;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  status: GradingOutputStatus;
  sourceType: RepackSourceType;
  sourceId: string | null;
  containerId: string | null;
  containerNumber: string | null;
  ragId: string | null;
  ragCode: string | null;
  sortSessionId: string | null;
  gradeSessionId: string | null;
  fifoTimestamp: string | null; // gradeSession.endTime
  createdAt: string;
}

export interface RepackDraftAllocationRow {
  id: string;
  gradingOutputId: string;
  amountUsed: number;
  allocatedCost: number;
  containerId: string | null;
  ragBaleId: string | null;
}

export interface RepackDraftResult {
  repackUnit: any;
  allocations: RepackDraftAllocationRow[];
  totalAllocated: number;
  totalCost: number;
}

export interface SealRepackResult {
  repackUnit: any;
  inventoryItem: any;
  qrLabel: any;
}

@Injectable()
export class RepackV3Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAvailableStock(
    tenantId: string,
    categoryId?: string,
    gradeId?: string,
    measurementType?: MeasurementType,
  ): Promise<AvailableStockRow[]> {
    const rows = await this.prisma.gradeOutput.findMany({
      where: {
        tenantId,
        ...(gradeId ? { gradeId } : {}),
        ...(measurementType ? { measurementType } : {}),
        status: { in: [GradingOutputStatus.AVAILABLE, GradingOutputStatus.PARTIALLY_USED, GradingOutputStatus.READY_FOR_REPACK] },
        remainingAmount: { gt: 0 },
        gradeBucket: {
          gradeSession: {
            categoryOutput: categoryId ? { categoryId } : {},
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

      const sourceType: RepackSourceType = container?.id ? 'CONTAINER' : 'LOOSE_BALE';
      const sourceId = rag?.id ?? null;
      
      // Calculate cost per unit for display
      const totalAmountNum = Number(o.totalAmount) || 0;
      const allocatedCostNum = Number(o.allocatedCost) || 0;
      const costPerUnit = totalAmountNum > 0 ? allocatedCostNum / totalAmountNum : 0;

      return {
        id: o.id,
        tenantId: o.tenantId,
        categoryId: co?.category?.id ?? categoryId ?? '',
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

  // ===================================================================
  // DELETED 2025-01-21: FIFO METHODS REMOVED - MANUAL ALLOCATION ONLY
  // ===================================================================
  // async previewFifo(...) { ... }
  // async createDraftFifo(...) { ... }
  // private async allocateFifoTx(...) { ... }
  // ===================================================================

  // [FIFO methods commented out - see git history for original code]

  async createDraftManual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string): Promise<RepackDraftResult> {
    return this.prisma.$transaction(async (tx) => {
      this.assertDraftInputs(dto);
      const manualAllocations = dto.manualAllocations || [];
      if (manualAllocations.length > 0) {
        const totalRequested = manualAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
        if (totalRequested <= 0) {
          throw new BadRequestException('Manual allocation total must be greater than zero');
        }
      }
      // Allow any amount - can be less than, equal to, or more than target
      // Users can add multiple allocations from different sources to reach target

      const { openSessionId, unitCode } = await this.ensureOpenSessionAndUnitCode(
        tx, tenantId, dto.categoryId, dto.gradeId, userId, dto.repackSessionId,
      );
      const unit = await tx.repackUnit.create({
        data: {
          tenantId,
          repackSessionId: openSessionId,
          categoryId: dto.categoryId,
          gradeId: dto.gradeId,
          unitCode,
          unitType: dto.measurementType === MeasurementType.WEIGHT ? UnitType.KG_BALE : UnitType.PCS_PACK,
          weightKg: dto.measurementType === MeasurementType.WEIGHT ? new Decimal(dto.targetAmount) : new Decimal(0),
          pcsCount: dto.measurementType === MeasurementType.QUANTITY ? Math.trunc(dto.targetAmount) : 0,
          totalCost: new Decimal(0),
          status: RepackStatus.DRAFT,
          measurementType: dto.measurementType,
          targetAmount: new Decimal(dto.targetAmount),
          allocationMode: AllocationMode.MANUAL,
          createdBy: userId,
        },
      });

      const { allocations, totalCost, primaryTrace } = await this.allocateManualTx(
        tx,
        tenantId,
        unit.id,
        dto.categoryId,
        dto.gradeId,
        dto.measurementType,
        dto.targetAmount,
        dto.manualAllocations,
      );

      const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);

      const updatedUnit = await tx.repackUnit.update({
        where: { id: unit.id },
        data: {
          totalCost: new Decimal(totalCost),
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
        totalAllocated,
        totalCost,
      };
    });
  }

  async sealUnit(tenantId: string, unitId: string, warehouseId: string | null, userId: string): Promise<SealRepackResult> {
    // warehouseId is optional - inventory can be created without warehouse assignment

    return this.prisma.$transaction(async (tx) => {
      let warehouse: { id: string; name: string } | null = null;
      if (warehouseId) {
        warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, tenantId }, select: { id: true, name: true } });
        if (!warehouse) throw new BadRequestException('Invalid warehouse');
      }

      const unit = await tx.repackUnit.findFirst({
        where: { id: unitId, tenantId },
        include: {
          inputAllocations: true,
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
        },
      });
      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.status !== RepackStatus.DRAFT) throw new ConflictException('Only DRAFT repack units can be sealed');
      if (unit.inputAllocations.length === 0) throw new BadRequestException('Cannot seal without allocations');
      if (!unit.categoryId || !unit.gradeId) throw new BadRequestException('Repack unit must have categoryId and gradeId');

      const allocatedAmount = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
      const targetAmount = Number(unit.targetAmount ?? 0);
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new BadRequestException('Invalid targetAmount on repack unit');
      }
      // ERP rule: allocated amount must meet or exceed target (allow slight overage)
      if (allocatedAmount < targetAmount - 0.001) {
        const shortfall = targetAmount - allocatedAmount;
        throw new BadRequestException(
          `Cannot seal: need ${shortfall.toFixed(2)} more to reach target of ${targetAmount}`,
        );
      }
      // Overage is acceptable (real-world scenario: 26kg + 25kg = 51kg for 50kg target)

      // Ensure primary trace fields are present (derive from first allocation if missing)
      let containerId = unit.containerId;
      let ragId = unit.ragId;
      if (!containerId || !ragId) {
        const firstAlloc = unit.inputAllocations[0];
        // firstAlloc.ragBaleId is the rag id; containerId is denormalized
        containerId = containerId ?? firstAlloc.containerId;
        ragId = ragId ?? firstAlloc.ragBaleId;
      }

      const sealedUnit = await tx.repackUnit.update({
        where: { id: unit.id },
        data: {
          status: RepackStatus.SEALED,
          containerId,
          ragId,
        },
        include: {
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          inputAllocations: true,
        },
      });

      // Create inventory item ONLY from SEALED repack (inside same transaction)
      const existingInv = await tx.inventoryItem.findFirst({ where: { tenantId, repackUnitId: sealedUnit.id }, select: { id: true } });
      if (existingInv) throw new ConflictException('Inventory already exists for this repack unit');

      const denom = sealedUnit.measurementType === MeasurementType.QUANTITY
        ? new Decimal(sealedUnit.pcsCount)
        : sealedUnit.weightKg;
      if (denom.equals(new Decimal(0))) throw new BadRequestException('Cannot create inventory with zero amount');
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
          status: InventoryStatus.AVAILABLE,
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
          movementType: MovementType.INTAKE,
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

      // QR label (if not already generated)
      const qrLabel = await tx.qRLabel.upsert({
        where: { repackUnitId: sealedUnit.id },
        create: {
          repackUnitId: sealedUnit.id,
          // Implementation detail: stable, unique QR payload string.
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

  // =========================
  // Internals
  // =========================

  private assertDraftInputs(dto: CreateRepackUnitV2Dto) {
    if (!dto.categoryId) throw new BadRequestException('categoryId is required');
    if (!dto.gradeId) throw new BadRequestException('gradeId is required');
    if (!dto.measurementType) throw new BadRequestException('measurementType is required');
    if (!Number.isFinite(dto.targetAmount) || dto.targetAmount <= 0) {
      throw new BadRequestException('targetAmount must be > 0');
    }
  }

  private async ensureOpenSessionAndUnitCode(
    tx: any,
    tenantId: string,
    categoryId: string,
    gradeId: string,
    userId: string,
    requestedSessionId?: string,
  ): Promise<{ openSessionId: string; unitCode: string }> {
    // Ensure category/grade are valid and active
    const [tenant, category, grade] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { companyCode: true } }),
      tx.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { name: true } }),
      tx.grade.findFirst({ where: { id: gradeId, tenantId, isActive: true }, select: { name: true } }),
    ]);
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!category) throw new BadRequestException('Invalid category');
    if (!grade) throw new BadRequestException('Invalid grade');

    // A resumed task must remain in its original OPEN tenant session. New work
    // retains the auto-managed latest-open-session behaviour.
    let session = requestedSessionId
      ? await tx.repackSession.findFirst({
          where: { id: requestedSessionId, tenantId, status: RepackSessionStatus.OPEN },
          select: { id: true },
        })
      : await tx.repackSession.findFirst({
          where: { tenantId, status: RepackSessionStatus.OPEN },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
    if (requestedSessionId && !session) {
      throw new ConflictException('The repack session is unavailable or already closed');
    }
    if (!session) {
      session = await tx.repackSession.create({
        data: { tenantId, workerId: userId, supervisorId: userId, status: RepackSessionStatus.OPEN },
        select: { id: true },
      });
    }

    const dateToken = formatYYYYMMDD(new Date());
    const tenantToken = tokenFromName(tenant.companyCode, 10);
    const catToken = tokenFromName(category.name, 6);
    const gradeToken = tokenFromName(grade.name, 6);

    // Deterministic seq: count existing units for today; retries on uniqueness.
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

    throw new ConflictException('Could not generate unique repack unit code');
  }

  // [allocateFifoTx method removed - see comment block at top of class]

  private async allocateManualTx(
    tx: any,
    tenantId: string,
    repackUnitId: string,
    categoryId: string,
    gradeId: string,
    measurementType: MeasurementType,
    targetAmount: number,
    manualAllocations: { gradingOutputId: string; amountUsed: number }[],
  ): Promise<{ allocations: RepackDraftAllocationRow[]; totalCost: number; primaryTrace: any }> {
    // no duplicates
    const ids = manualAllocations.map((a) => a.gradingOutputId);
    const uniq = new Set(ids);
    if (uniq.size !== ids.length) throw new BadRequestException('Duplicate gradingOutputId in manual allocations');

    const outputs = await tx.gradeOutput.findMany({
      where: {
        tenantId,
        id: { in: ids },
        gradeId,
        measurementType,
        status: {
          in: [
            GradingOutputStatus.AVAILABLE,
            GradingOutputStatus.PARTIALLY_USED,
            GradingOutputStatus.READY_FOR_REPACK,
          ],
        },
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
      throw new NotFoundException('Some grading outputs are missing or not eligible');
    }

    const allocations: RepackDraftAllocationRow[] = [];
    let totalCost = 0;
    let primaryTrace: any = {};

    for (const input of manualAllocations) {
      const output = outputs.find((o) => o.id === input.gradingOutputId);
      if (!output) throw new NotFoundException(`Grading output not found: ${input.gradingOutputId}`);
      const take = Number(input.amountUsed);
      if (!Number.isFinite(take) || take <= 0) throw new BadRequestException('amountUsed must be > 0');

      if (Number(output.remainingAmount) < take) {
        throw new BadRequestException(`Insufficient remaining amount in grading output ${output.id}`);
      }

      const totalAmountNum = Number(output.totalAmount);
      const allocatedCostNum = Number(output.allocatedCost);
      if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
        throw new BadRequestException(`Invalid grading output totalAmount for cost calculation: ${output.id}`);
      }
      if (!Number.isFinite(allocatedCostNum) || allocatedCostNum < 0) {
        throw new BadRequestException(`Invalid grading output allocatedCost for cost calculation: ${output.id}`);
      }
      const allocationCost = (allocatedCostNum / totalAmountNum) * take;
      if (!Number.isFinite(allocationCost)) {
        throw new BadRequestException(`Invalid allocation cost computed for grading output: ${output.id}`);
      }

      const sortSession = output.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession;
      const rag = sortSession?.rag;
      const containerId = rag?.containerId ?? null;
      const ragBaleId = rag?.id ?? null;

      const updated = await tx.gradeOutput.updateMany({
        where: { id: output.id, tenantId, remainingAmount: output.remainingAmount, status: { not: GradingOutputStatus.DEPLETED } },
        data: {
          usedAmount: { increment: new Decimal(take) },
          remainingAmount: { decrement: new Decimal(take) },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(`Concurrent update detected for grading output ${output.id}. Please retry.`);
      }

      const after = await tx.gradeOutput.findUnique({ where: { id: output.id }, select: { remainingAmount: true } });
      const remainingAfter = Number(after?.remainingAmount ?? 0);
      const newStatus = remainingAfter <= 0.001 ? GradingOutputStatus.DEPLETED : GradingOutputStatus.PARTIALLY_USED;
      await tx.gradeOutput.update({ where: { id: output.id }, data: { status: newStatus } });

      const alloc = await tx.repackInputAllocation.create({
        data: {
          tenantId,
          repackUnitId,
          gradingOutputId: output.id,
          containerId,
          ragBaleId,
          amountUsed: new Decimal(take),
          measurementType,
          allocatedCost: new Decimal(allocationCost),
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

    // NOTE: Draft creation supports partial allocations; completeness is enforced at seal time.

    return { allocations, totalCost, primaryTrace };
  }
}
