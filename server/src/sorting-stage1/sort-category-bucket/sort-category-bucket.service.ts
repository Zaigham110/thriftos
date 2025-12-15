import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSortCategoryBucketDto, UpdateSortCategoryBucketDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { SortStatus } from '@prisma/client';

@Injectable()
export class SortCategoryBucketService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createForSession(tenantId: string, sessionId: string, dto: CreateSortCategoryBucketDto, userId: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, status: true, totalInputWeight: true },
    });
    if (!session) throw new NotFoundException('Sort session not found');
    if (session.status !== SortStatus.OPEN) throw new ConflictException('Cannot add buckets after closing');

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!category) throw new BadRequestException('Invalid category');

    const existing = await this.prisma.sortCategoryBucket.findUnique({
      where: { sortSessionId_categoryId: { sortSessionId: sessionId, categoryId: dto.categoryId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Bucket already exists for this category in this session');

    const bucket = await this.prisma.sortCategoryBucket.create({
      data: {
        sortSessionId: sessionId,
        categoryId: dto.categoryId,
        outputWeightKg: dto.outputWeightKg,
        outputCount: dto.outputCount,
      },
    });

    await this.recomputeTotalsOrThrow(sessionId, session.totalInputWeight);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SORT_BUCKET_CREATED',
      entityType: 'SortCategoryBucket',
      entityId: bucket.id,
      metadataJson: {
        sortSessionId: sessionId,
        categoryId: dto.categoryId,
        categoryName: category.name,
        outputWeightKg: bucket.outputWeightKg.toString(),
        outputCount: bucket.outputCount,
      },
    });

    return bucket;
  }

  async update(tenantId: string, bucketId: string, dto: UpdateSortCategoryBucketDto, userId: string) {
    const bucket = await this.prisma.sortCategoryBucket.findFirst({
      where: { id: bucketId, sortSession: { tenantId } },
      include: { sortSession: { select: { id: true, status: true, totalInputWeight: true } } },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');
    if (bucket.sortSession.status !== SortStatus.OPEN) throw new ConflictException('Cannot edit buckets after closing');

    const updated = await this.prisma.sortCategoryBucket.update({
      where: { id: bucketId },
      data: {
        outputWeightKg: dto.outputWeightKg,
        outputCount: dto.outputCount,
      },
    });

    await this.recomputeTotalsOrThrow(bucket.sortSession.id, bucket.sortSession.totalInputWeight);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SORT_BUCKET_UPDATED',
      entityType: 'SortCategoryBucket',
      entityId: bucketId,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async delete(tenantId: string, bucketId: string, userId: string) {
    const bucket = await this.prisma.sortCategoryBucket.findFirst({
      where: { id: bucketId, sortSession: { tenantId } },
      include: { sortSession: { select: { id: true, status: true, totalInputWeight: true } } },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');
    if (bucket.sortSession.status !== SortStatus.OPEN) throw new ConflictException('Cannot delete buckets after closing');

    await this.prisma.sortCategoryBucket.delete({ where: { id: bucketId } });

    await this.recomputeTotalsOrThrow(bucket.sortSession.id, bucket.sortSession.totalInputWeight);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SORT_BUCKET_DELETED',
      entityType: 'SortCategoryBucket',
      entityId: bucketId,
      metadataJson: { sortSessionId: bucket.sortSession.id, categoryId: bucket.categoryId },
    });

    return { success: true };
  }

  private async recomputeTotalsOrThrow(sessionId: string, totalInputWeight: Decimal) {
    const totals = await this.prisma.sortCategoryBucket.aggregate({
      where: { sortSessionId: sessionId },
      _sum: { outputWeightKg: true },
    });

    const totalOutputWeight = totals._sum.outputWeightKg || new Decimal(0);
    const wasteWeight = totalInputWeight.sub(totalOutputWeight);

    if (wasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
    }

    await this.prisma.sortSession.update({
      where: { id: sessionId },
      data: { totalOutputWeight, wasteWeight },
    });
  }
}


