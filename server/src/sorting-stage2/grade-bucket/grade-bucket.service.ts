import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GradeStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeBucketDto, UpdateGradeBucketDto } from './dto';

@Injectable()
export class GradeBucketService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async createForSession(tenantId: string, sessionId: string, dto: CreateGradeBucketDto, userId: string) {
    const session = await this.prisma.gradeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { categoryOutput: { select: { weightKg: true } } },
    });
    if (!session) throw new NotFoundException('Grade session not found');
    if (session.status !== GradeStatus.OPEN) throw new ConflictException('Cannot add buckets after closing');

    const grade = await this.prisma.grade.findFirst({
      where: { id: dto.gradeId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!grade) throw new BadRequestException('Invalid grade');

    const existing = await this.prisma.gradeBucket.findUnique({
      where: { gradeSessionId_gradeId: { gradeSessionId: sessionId, gradeId: dto.gradeId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Bucket already exists for this grade in this session');

    const bucket = await this.prisma.gradeBucket.create({
      data: {
        gradeSessionId: sessionId,
        gradeId: dto.gradeId,
        outputWeightKg: dto.outputWeightKg,
        outputCount: dto.outputCount,
      },
    });

    await this.validateNonNegativeWaste(sessionId, session.categoryOutput.weightKg);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_BUCKET_CREATED',
      entityType: 'GradeBucket',
      entityId: bucket.id,
      metadataJson: {
        gradeSessionId: sessionId,
        gradeId: dto.gradeId,
        gradeName: grade.name,
        outputWeightKg: bucket.outputWeightKg.toString(),
        outputCount: bucket.outputCount,
      },
    });

    return bucket;
  }

  async update(tenantId: string, bucketId: string, dto: UpdateGradeBucketDto, userId: string) {
    const bucket = await this.prisma.gradeBucket.findFirst({
      where: { id: bucketId, gradeSession: { tenantId } },
      include: { gradeSession: { include: { categoryOutput: { select: { weightKg: true } } } } },
    });
    if (!bucket) throw new NotFoundException('Grade bucket not found');
    if (bucket.gradeSession.status !== GradeStatus.OPEN) throw new ConflictException('Cannot edit buckets after closing');

    const updated = await this.prisma.gradeBucket.update({
      where: { id: bucketId },
      data: {
        outputWeightKg: dto.outputWeightKg,
        outputCount: dto.outputCount,
      },
    });

    await this.validateNonNegativeWaste(bucket.gradeSession.id, bucket.gradeSession.categoryOutput.weightKg);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_BUCKET_UPDATED',
      entityType: 'GradeBucket',
      entityId: bucketId,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async delete(tenantId: string, bucketId: string, userId: string) {
    const bucket = await this.prisma.gradeBucket.findFirst({
      where: { id: bucketId, gradeSession: { tenantId } },
      include: { gradeSession: { include: { categoryOutput: { select: { weightKg: true } } } } },
    });
    if (!bucket) throw new NotFoundException('Grade bucket not found');
    if (bucket.gradeSession.status !== GradeStatus.OPEN) throw new ConflictException('Cannot delete buckets after closing');

    await this.prisma.gradeBucket.delete({ where: { id: bucketId } });

    await this.validateNonNegativeWaste(bucket.gradeSession.id, bucket.gradeSession.categoryOutput.weightKg);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_BUCKET_DELETED',
      entityType: 'GradeBucket',
      entityId: bucketId,
      metadataJson: { gradeSessionId: bucket.gradeSessionId, gradeId: bucket.gradeId },
    });

    return { success: true };
  }

  private async validateNonNegativeWaste(gradeSessionId: string, inputWeight: Decimal) {
    const totals = await this.prisma.gradeBucket.aggregate({
      where: { gradeSessionId },
      _sum: { outputWeightKg: true },
    });
    const totalGradeOutputWeight = totals._sum.outputWeightKg || new Decimal(0);
    const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
    if (wasteWeight.lessThan(new Decimal(0))) {
      throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
    }
  }
}


