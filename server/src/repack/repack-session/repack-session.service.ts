import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RepackSessionStatus, RepackStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateRepackSessionDto, UpdateRepackSessionDto } from './dto';

@Injectable()
export class RepackSessionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateRepackSessionDto, currentUserId: string) {
    const workerId = dto.workerId || currentUserId;
    const supervisorId = dto.supervisorId || currentUserId;

    const session = await this.prisma.repackSession.create({
      data: {
        tenantId,
        workerId,
        supervisorId,
        status: RepackSessionStatus.OPEN,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'REPACK_SESSION_CREATED',
      entityType: 'RepackSession',
      entityId: session.id,
      metadataJson: { workerId, supervisorId },
    });

    return session;
  }

  async findAll(tenantId: string, options?: { status?: RepackSessionStatus; page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.status && { status: options.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.repackSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          worker: { select: { id: true, name: true, email: true } },
          supervisor: { select: { id: true, name: true, email: true } },
          _count: { select: { repackUnits: true } },
        },
      }),
      this.prisma.repackSession.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const session = await this.prisma.repackSession.findFirst({
      where: { id, tenantId },
      include: {
        worker: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        repackUnits: {
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            qrLabel: true,
            _count: { select: { repackItems: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Repack session not found');
    return session;
  }

  async update(tenantId: string, id: string, dto: UpdateRepackSessionDto, currentUserId: string) {
    const session = await this.prisma.repackSession.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Repack session not found');
    if (session.status !== RepackSessionStatus.OPEN) {
      throw new ConflictException('Cannot update a CLOSED repack session');
    }

    const updated = await this.prisma.repackSession.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'REPACK_SESSION_UPDATED',
      entityType: 'RepackSession',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async close(tenantId: string, id: string, currentUserId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.repackSession.findFirst({
        where: { id, tenantId },
        include: { repackUnits: { select: { id: true } } },
      });
      if (!session) throw new NotFoundException('Repack session not found');
      if (session.status !== RepackSessionStatus.OPEN) throw new ConflictException('Cannot close session twice');

      if (!session.repackUnits || session.repackUnits.length === 0) {
        throw new BadRequestException('At least one RepackUnit is required to close the session');
      }

      // Lock session
      const closed = await tx.repackSession.update({
        where: { id },
        data: { status: RepackSessionStatus.CLOSED, endTime: new Date() },
      });

      // Ensure units become READY (per prompt)
      await tx.repackUnit.updateMany({
        where: { repackSessionId: id },
        data: { status: RepackStatus.READY },
      });

      return closed;
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'REPACK_SESSION_CLOSED',
      entityType: 'RepackSession',
      entityId: id,
    });

    return result;
  }
}


