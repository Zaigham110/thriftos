import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackUnitDto } from './dto';
import { RepackSessionStatus, UnitType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { formatSeq, formatYYYYMMDD, tokenFromName } from './unit-code.util';
import { encodeQrPayload, QrPayload } from '../qr-label/qr-payload.util';

@Injectable()
export class RepackUnitService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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
      },
    });
    if (!unit) throw new NotFoundException('Repack unit not found');
    return unit;
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
}


