import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGradeDto, UpdateGradeDto } from './grades.dto';

@Injectable()
export class GradesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Get all grades for tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.grade.findMany({
      where: { tenantId, isActive: true },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * Get all grades including inactive ones (for admin)
   */
  async findAllAdmin(tenantId: string) {
    return this.prisma.grade.findMany({
      where: { tenantId },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * Get single grade
   */
  async findOne(tenantId: string, id: string) {
    const grade = await this.prisma.grade.findFirst({
      where: { id, tenantId },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  /**
   * Create a new grade
   */
  async create(tenantId: string, dto: CreateGradeDto, userId: string) {
    // Check for duplicate name
    const existing = await this.prisma.grade.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);

    // Get next rank if not provided
    const rank = dto.rank ?? await this.getNextRank(tenantId);

    const grade = await this.prisma.grade.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        rank,
        isActive: true,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_CREATED',
      entityType: 'Grade',
      entityId: grade.id,
      metadataJson: { name: grade.name, rank: grade.rank },
    });

    return grade;
  }

  /**
   * Update a grade
   */
  async update(tenantId: string, id: string, dto: UpdateGradeDto, userId: string) {
    const grade = await this.findOne(tenantId, id);

    // Check for duplicate name if changing
    if (dto.name && dto.name !== grade.name) {
      const existing = await this.prisma.grade.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);
    }

    const updated = await this.prisma.grade.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        rank: dto.rank,
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_UPDATED',
      entityType: 'Grade',
      entityId: grade.id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  /**
   * Soft delete a grade (set inactive)
   */
  async remove(tenantId: string, id: string, userId: string) {
    const grade = await this.findOne(tenantId, id);

    // Check if grade is in use
    const inUse = await this.prisma.gradeBucket.count({
      where: { gradeId: id },
    });
    if (inUse > 0) {
      throw new ConflictException('Cannot delete grade that is in use by grading sessions');
    }

    const updated = await this.prisma.grade.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GRADE_DELETED',
      entityType: 'Grade',
      entityId: grade.id,
      metadataJson: { name: grade.name },
    });

    return updated;
  }

  private async getNextRank(tenantId: string): Promise<number> {
    const maxRank = await this.prisma.grade.aggregate({
      where: { tenantId },
      _max: { rank: true },
    });
    return (maxRank._max.rank || 0) + 1;
  }
}
