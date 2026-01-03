import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackUnitDto, CreateRepackUnitV2Dto } from './dto';
import { RepackSessionStatus, UnitType, RepackStatus, MeasurementType, AllocationMode } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { formatSeq, formatYYYYMMDD, tokenFromName } from './unit-code.util';
import { encodeQrPayload, QrPayload } from '../qr-label/qr-payload.util';
import { RepackAllocationService } from '../shared/repack-allocation.service';

@Injectable()
export class RepackUnitService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private allocationService: RepackAllocationService,
  ) {}

  async createForSession(tenantId: string, sessionId: string, dto: CreateRepackUnitDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.repackSession.findFirst({
        where: { id: sessionId, tenantId },
        select: { id: true, tenantId: true, status: true },
      });
      if (!session) throw new NotFoundException('Repack session not found');
      if (session.status !== RepackSessionStatus.OPEN) {
        throw new ConflictException('Cannot add units if session is CLOSED');
      }

      // Validate unit type + required fields
      const pcsCount = dto.pcsCount ?? 0;
      if (dto.unitType === UnitType.PCS_PACK && pcsCount <= 0) {
        throw new BadRequestException('PCS_PACK requires pcsCount > 0');
      }

      if (dto.unitType !== UnitType.MIXED_BALE) {
        if (!dto.categoryId || !dto.gradeId) {
          throw new BadRequestException('categoryId and gradeId are required for non-mixed units');
        }
      }

      // Resolve tokens for unitCode
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { companyCode: true },
      });
      if (!tenant) throw new BadRequestException('Tenant not found');

      let categoryName: string | null = null;
      let gradeName: string | null = null;
      if (dto.unitType !== UnitType.MIXED_BALE) {
        const category = await tx.category.findFirst({
          where: { id: dto.categoryId!, tenantId, isActive: true },
          select: { name: true },
        });
        if (!category) throw new BadRequestException('Invalid category');
        categoryName = category.name;

        const grade = await tx.grade.findFirst({
          where: { id: dto.gradeId!, tenantId, isActive: true },
          select: { name: true },
        });
        if (!grade) throw new BadRequestException('Invalid grade');
        gradeName = grade.name;
      }

      const day = new Date();
      const dateToken = formatYYYYMMDD(day);
      const tenantToken = tokenFromName(tenant.companyCode, 10);
      const catToken = dto.unitType === UnitType.MIXED_BALE ? 'MIX' : tokenFromName(categoryName || '', 6);
      const gradeToken = dto.unitType === UnitType.MIXED_BALE ? 'MIX' : tokenFromName(gradeName || '', 6);

      // Generate a unique unitCode with retry (handles concurrency)
      const unitCode = await this.generateUniqueUnitCode(tx, tenantId, tenantToken, catToken, gradeToken, dateToken);

      const unit = await tx.repackUnit.create({
        data: {
          tenantId,
          repackSessionId: sessionId,
          categoryId: dto.unitType === UnitType.MIXED_BALE ? null : dto.categoryId!,
          gradeId: dto.unitType === UnitType.MIXED_BALE ? null : dto.gradeId!,
          unitCode,
          unitType: dto.unitType,
          weightKg: dto.weightKg,
          pcsCount,
          totalCost: new Decimal(0),
          measurementType: 'WEIGHT', // Default to weight-based measurement
          targetAmount: dto.weightKg, // Initial target matches input weight
          allocationMode: 'FIFO', // Default allocation mode
        },
        include: {
          category: { select: { name: true } },
          grade: { select: { name: true } },
        },
      });

      const payload: QrPayload = {
        unitId: unit.id,
        unitCode: unit.unitCode,
        category: unit.category?.name ?? null,
        grade: unit.grade?.name ?? null,
        weightKg: unit.weightKg.toString(),
        pcsCount: unit.pcsCount,
        totalCost: unit.totalCost.toString(),
        createdAt: unit.createdAt.toISOString(),
      };

      const qrCode = encodeQrPayload(payload);
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

  async findAll(tenantId: string, options?: { page?: number; limit?: number; sessionId?: string }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
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

  async findOne(tenantId: string, id: string) {
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
    if (!unit) throw new NotFoundException('Repack unit not found');

    // Transform allocations to include human-readable container/rag codes
    const transformedAllocations = unit.inputAllocations.map((alloc: any) => {
      const go = alloc.gradingOutput;
      const rag = go?.gradeBucket?.gradeSession?.categoryOutput?.sortCategoryBucket?.sortSession?.rag;
      const containerNumber = rag?.container?.containerNumber;
      const ragCode = rag?.ragCode;
      
      return {
        ...alloc,
        containerNumber: containerNumber || null,
        ragCode: ragCode || null,
        // Remove nested gradingOutput to keep response clean
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

    if (unit.status !== RepackStatus.DRAFT) {
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

    const allocatedAmount = unit.inputAllocations.reduce((sum, a: any) => sum + Number(a.amountUsed), 0);
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

  private async generateUniqueUnitCode(
    tx: any,
    tenantId: string,
    tenantToken: string,
    catToken: string,
    gradeToken: string,
    dateToken: string,
  ): Promise<string> {
    // try up to 5 times on unique collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const dayStart = new Date(Date.UTC(parseInt(dateToken.slice(0, 4)), parseInt(dateToken.slice(4, 6)) - 1, parseInt(dateToken.slice(6, 8)), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(parseInt(dateToken.slice(0, 4)), parseInt(dateToken.slice(4, 6)) - 1, parseInt(dateToken.slice(6, 8)) + 1, 0, 0, 0));
      const countToday = await tx.repackUnit.count({
        where: {
          tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });
      const seq = formatSeq(countToday + 1 + attempt);
      const unitCode = `${tenantToken}-${catToken}-${gradeToken}-${dateToken}-${seq}`;

      const existing = await tx.repackUnit.findFirst({
        where: { tenantId, unitCode },
        select: { id: true },
      });
      if (!existing) return unitCode;
    }
    throw new ConflictException('Could not generate unique unitCode');
  }

  // =============================================================
  // DELETED 2025-01-21: FIFO METHODS REMOVED - MANUAL ALLOCATION ONLY
  // =============================================================
  // async createV2FIFO(...) { ... }
  // async previewFIFOAllocation(...) { ... }
  // =============================================================

  /**
   * Create a repack unit with manual allocation
   */
  async createV2Manual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string) {
    if (!dto.manualAllocations || dto.manualAllocations.length === 0) {
      throw new BadRequestException('Manual allocations are required for MANUAL mode');
    }

    // Validate category and grade
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!category) throw new BadRequestException('Invalid category');

    const grade = await this.prisma.grade.findFirst({
      where: { id: dto.gradeId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!grade) throw new BadRequestException('Invalid grade');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyCode: true },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');

    // RepackUnit requires a repackSessionId in the schema.
    // For v2 flow (sessionless UI), attach to the latest OPEN session.
    let openSession = await this.prisma.repackSession.findFirst({
      where: { tenantId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!openSession) {
      // Minimal auto-session for v2 flow: attach work to an OPEN session.
      // Uses the requesting user as both worker and supervisor.
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

    // Generate unique unit code
    const day = new Date();
    const dateToken = formatYYYYMMDD(day);
    const tenantToken = tokenFromName(tenant.companyCode, 10);
    const catToken = tokenFromName(category.name, 6);
    const gradeToken = tokenFromName(grade.name, 6);
    const unitCode = await this.generateUniqueUnitCode(this.prisma, tenantId, tenantToken, catToken, gradeToken, dateToken);

    // Create repack unit in DRAFT status
    const unit = await this.prisma.repackUnit.create({
      data: {
        tenantId,
        repackSessionId: openSession.id,
        categoryId: dto.categoryId,
        gradeId: dto.gradeId,
        unitCode,
        unitType: dto.measurementType === MeasurementType.WEIGHT ? UnitType.KG_BALE : UnitType.PCS_PACK,
        weightKg: dto.measurementType === MeasurementType.WEIGHT ? new Decimal(dto.targetAmount) : new Decimal(0),
        pcsCount: dto.measurementType === MeasurementType.QUANTITY ? dto.targetAmount : 0,
        totalCost: new Decimal(0),
        status: RepackStatus.DRAFT,
        measurementType: dto.measurementType,
        targetAmount: new Decimal(dto.targetAmount),
        allocationMode: AllocationMode.MANUAL,
        createdBy: userId,
      },
    });

    // Perform manual allocation (allocateManual has its own transaction)
    const allocationResult = await this.allocationService.allocateManual(
      tenantId,
      unit.id,
      dto.measurementType,
      dto.targetAmount,
      dto.manualAllocations,
    );

    // Update unit with total cost from allocations
    const updatedUnit = await this.prisma.repackUnit.update({
      where: { id: unit.id },
      data: {
        totalCost: new Decimal(allocationResult.totalCost),
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

  // [previewFIFOAllocation method removed - see comment block above]

  /**
   * Seal a DRAFT repack unit (transition to SEALED)
   */
  async sealUnit(tenantId: string, unitId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.repackUnit.findFirst({
        where: { id: unitId, tenantId },
        include: {
          inputAllocations: true,
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
        },
      });

      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.status !== RepackStatus.DRAFT) {
        throw new ConflictException('Only DRAFT units can be sealed');
      }
      if (unit.inputAllocations.length === 0) {
        throw new BadRequestException('Cannot seal unit without allocations');
      }

      // Validate allocation totals match target
      const totalAllocated = unit.inputAllocations.reduce((sum, a) => sum + Number(a.amountUsed), 0);
      if (Math.abs(totalAllocated - Number(unit.targetAmount)) > 0.001) {
        throw new ConflictException(`Allocation mismatch: ${totalAllocated} allocated, ${unit.targetAmount} required`);
      }

      // Seal the unit
      const sealed = await tx.repackUnit.update({
        where: { id: unitId },
        data: {
          status: RepackStatus.SEALED,
        },
        include: {
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          inputAllocations: true,
        },
      });

      // Generate QR code if not exists
      const existingQr = await tx.qRLabel.findFirst({
        where: { repackUnitId: unitId },
      });

      if (!existingQr) {
        const payload: QrPayload = {
          unitId: sealed.id,
          unitCode: sealed.unitCode,
          category: sealed.category?.name ?? null,
          grade: sealed.grade?.name ?? null,
          weightKg: sealed.weightKg.toString(),
          pcsCount: sealed.pcsCount,
          totalCost: sealed.totalCost.toString(),
          createdAt: sealed.createdAt.toISOString(),
        };

        const qrCode = encodeQrPayload(payload);
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

  /**
   * Get available stock for allocation
   */
  async getAvailableStock(tenantId: string, categoryId?: string, gradeId?: string, measurementType?: MeasurementType) {
    return this.allocationService.getAvailableStock(tenantId, categoryId, gradeId, measurementType);
  }

  /**
   * Get draft units
   */
  async getDraftUnits(tenantId: string) {
    const units = await this.prisma.repackUnit.findMany({
      where: {
        tenantId,
        status: RepackStatus.DRAFT,
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

    return units.map((u: any) => {
      const allocatedAmount = (u.inputAllocations ?? []).reduce((sum: number, a: any) => sum + Number(a.amountUsed), 0);
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

  /**
   * Get sealed units
   */
  async getSealedUnits(tenantId: string) {
    const units = await this.prisma.repackUnit.findMany({
      where: {
        tenantId,
        status: RepackStatus.SEALED,
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

    return units.map((u: any) => ({
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

  async allocateToDraft(
    tenantId: string,
    unitId: string,
    allocations: { gradingOutputId: string; amountUsed: number }[],
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.repackUnit.findFirst({
        where: { id: unitId, tenantId },
        include: { inputAllocations: true },
      });
      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.status !== RepackStatus.DRAFT) throw new ConflictException('Only DRAFT units can be allocated');
      if (!unit.categoryId || !unit.gradeId) throw new BadRequestException('Draft unit must have categoryId and gradeId');
      if (!unit.measurementType) throw new BadRequestException('Draft unit must have measurementType');

      const alreadyAllocated = unit.inputAllocations.reduce((sum, a: any) => sum + Number(a.amountUsed), 0);
      const target = Number(unit.targetAmount ?? 0);
      const remainingTarget = Math.max(0, target - alreadyAllocated);
      if (remainingTarget <= 0.001) throw new ConflictException('Draft is already fully allocated');

      // Append new allocations atomically and update grading output balances.
      const append = await this.allocationService.appendManualAllocations(
        tenantId,
        unitId,
        unit.categoryId,
        unit.gradeId,
        unit.measurementType,
        remainingTarget,
        allocations,
        tx,
      );

      // Update repack totalCost (append-only; existing allocations preserved)
      const updatedUnit = await tx.repackUnit.update({
        where: { id: unitId },
        data: {
          totalCost: new Decimal(Number(unit.totalCost ?? 0) + append.totalCost),
          // Preserve existing traceability; only set if missing.
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

  async deallocateFromDraft(
    tenantId: string,
    unitId: string,
    allocationId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.repackUnit.findFirst({ where: { id: unitId, tenantId }, select: { id: true, status: true, totalCost: true } });
      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.status !== RepackStatus.DRAFT) throw new ConflictException('Only DRAFT units can be deallocated');

      const result = await this.allocationService.deallocateSingle(tenantId, allocationId, tx);
      if (result.repackUnitId !== unitId) throw new ConflictException('Allocation does not belong to this repack unit');

      await tx.repackUnit.update({
        where: { id: unitId },
        data: {
          totalCost: new Decimal(Math.max(0, Number(unit.totalCost ?? 0) - result.costRestored)),
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

  /**
   * Delete a draft unit (deallocates and removes)
   */
  async deleteDraft(tenantId: string, unitId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.repackUnit.findFirst({
        where: { id: unitId, tenantId },
      });

      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.status !== RepackStatus.DRAFT) {
        throw new ConflictException('Only DRAFT units can be deleted');
      }

      // Deallocate first (reverses GradingOutput balances)
      await this.allocationService.deallocate(tenantId, unitId);

      // Delete the unit (cascades to inputAllocations via FK)
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
}



