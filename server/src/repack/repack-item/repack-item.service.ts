import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackItemDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { RepackSessionStatus, SourceType, UnitType } from '@prisma/client';
import { encodeQrPayload, QrPayload } from '../qr-label/qr-payload.util';

@Injectable()
export class RepackItemService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async addItem(tenantId: string, unitId: string, dto: CreateRepackItemDto, userId: string) {
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
      if (!unit) throw new NotFoundException('Repack unit not found');
      if (unit.repackSession.status !== RepackSessionStatus.OPEN) {
        throw new ConflictException('Cannot add items to a unit in a CLOSED repack session');
      }

      // Source must be GradeOutput
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
      if (!gradeOutput) throw new BadRequestException('Invalid GradeOutput');

      // Determine category from gradeOutput -> gradeSession -> categoryOutput
      const categoryOutput = gradeOutput.gradeBucket.gradeSession.categoryOutput;
      const sourceCategory = await tx.category.findFirst({
        where: { id: categoryOutput.categoryId, tenantId },
        select: { id: true, name: true },
      });
      if (!sourceCategory) throw new BadRequestException('Source category not found');

      // Validate unit type constraints:
      // - For non-mixed units, the gradeOutput category/grade must match unit category/grade
      if (unit.unitType !== UnitType.MIXED_BALE) {
        if (!unit.categoryId || !unit.gradeId) {
          throw new BadRequestException('Unit is missing category/grade');
        }
        if (unit.categoryId !== sourceCategory.id) {
          throw new BadRequestException('GradeOutput category does not match RepackUnit category');
        }
        if (unit.gradeId !== gradeOutput.gradeId) {
          throw new BadRequestException('GradeOutput grade does not match RepackUnit grade');
        }
      }

      // Ensure we don't overfill the unit itself
      const unitTotals = await tx.repackItem.aggregate({
        where: { repackUnitId: unitId },
        _sum: { weightKg: true, pcsCount: true },
      });
      const usedUnitWeight = unitTotals._sum.weightKg || new Decimal(0);
      const usedUnitPcs = unitTotals._sum.pcsCount || 0;
      const nextUsedWeight = usedUnitWeight.add(new Decimal(dto.weightKg));
      const nextUsedPcs = usedUnitPcs + (dto.pcsCount || 0);

      if (nextUsedWeight.greaterThan(unit.weightKg)) {
        throw new BadRequestException('Cannot consume more weight than unit target weightKg');
      }
      if (unit.unitType === UnitType.PCS_PACK && nextUsedPcs > unit.pcsCount) {
        throw new BadRequestException('Cannot consume more pcs than unit target pcsCount');
      }

      // Over-consumption validation against GradeOutput availability across all units (tenant-scoped)
      const consumed = await tx.repackItem.aggregate({
        where: {
          sourceType: SourceType.GRADE_OUTPUT,
          sourceId: dto.gradeOutputId,
          repackUnit: { tenantId },
        },
        _sum: { weightKg: true, pcsCount: true },
      });
      const alreadyConsumedWeight = consumed._sum.weightKg || new Decimal(0);
      const alreadyConsumedPcs = consumed._sum.pcsCount || 0;
      const remainingWeight = gradeOutput.weightKg.sub(alreadyConsumedWeight);
      const remainingPcs = gradeOutput.count - alreadyConsumedPcs;

      if (new Decimal(dto.weightKg).greaterThan(remainingWeight)) {
        throw new BadRequestException('Over-consumption: remaining weight would be negative');
      }
      if ((dto.pcsCount || 0) > remainingPcs) {
        throw new BadRequestException('Over-consumption: remaining pcs would be negative');
      }

      // Level-4 cost allocation:
      // itemCost = (consumedWeight / gradeOutput.weightKg) × gradeOutput.allocatedCost
      if (gradeOutput.weightKg.equals(new Decimal(0))) {
        throw new BadRequestException('Invalid GradeOutput weightKg (0)');
      }
      const itemCost = new Decimal(dto.weightKg).div(gradeOutput.weightKg).mul(gradeOutput.allocatedCost);

      const item = await tx.repackItem.create({
        data: {
          repackUnitId: unitId,
          sourceType: SourceType.GRADE_OUTPUT,
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

      // Update QRLabel payload whenever cost changes (so QR reflects latest cost)
      const payload: QrPayload = {
        unitId: updatedUnit.id,
        unitCode: updatedUnit.unitCode,
        category: updatedUnit.category?.name ?? null,
        grade: updatedUnit.grade?.name ?? null,
        weightKg: updatedUnit.weightKg.toString(),
        pcsCount: updatedUnit.pcsCount,
        totalCost: updatedUnit.totalCost.toString(),
        createdAt: updatedUnit.createdAt.toISOString(),
      };
      const qrCode = encodeQrPayload(payload);
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
}


