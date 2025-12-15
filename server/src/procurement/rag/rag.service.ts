import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { ContainerStatus } from '@prisma/client';

@Injectable()
export class RagService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costAllocationService: CostAllocationService,
  ) {}

  async create(tenantId: string, dto: CreateRagDto, userId: string) {
    // Validate container
    const container = await this.prisma.container.findFirst({
      where: {
        id: dto.containerId,
        purchaseOrder: { tenantId },
      },
      include: {
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
      },
    });

    if (!container) {
      throw new BadRequestException('Container not found');
    }

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot add rags to a closed container');
    }

    // Check for duplicate rag code within tenant
    const existing = await this.prisma.rag.findFirst({
      where: { tenantId, ragCode: dto.ragCode },
    });

    if (existing) {
      throw new BadRequestException(`Rag code "${dto.ragCode}" already exists`);
    }

    const rag = await this.prisma.rag.create({
      data: {
        tenantId,
        containerId: dto.containerId,
        ragCode: dto.ragCode,
        weightKg: dto.weightKg,
        allocatedCost: 0, // Will be calculated
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
      },
    });

    // Recalculate cost allocation
    await this.costAllocationService.allocateContainerCosts(dto.containerId, userId);

    // Reload to get updated cost
    const updatedRag = await this.prisma.rag.findUnique({
      where: { id: rag.id },
      include: {
        container: {
          select: { containerNumber: true },
        },
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'RAG_CREATED',
      entityType: 'Rag',
      entityId: rag.id,
      metadataJson: {
        ragCode: rag.ragCode,
        containerNumber: container.containerNumber,
        weightKg: dto.weightKg,
      },
    });

    return updatedRag;
  }

  async findAll(
    tenantId: string,
    options?: {
      containerId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(options?.containerId && { containerId: options.containerId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.rag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          container: {
            select: {
              id: true,
              containerNumber: true,
              purchaseOrder: {
                select: { id: true, poNumber: true },
              },
            },
          },
        },
      }),
      this.prisma.rag.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const rag = await this.prisma.rag.findFirst({
      where: { id, tenantId },
      include: {
        container: {
          select: {
            id: true,
            containerNumber: true,
            purchaseOrder: {
              select: { id: true, poNumber: true, vendor: true },
            },
          },
        },
        sortSessions: {
          select: { id: true, status: true },
        },
      },
    });

    if (!rag) {
      throw new NotFoundException('Rag not found');
    }

    return rag;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const rag = await this.findOne(tenantId, id);

    // Check if rag has been used in sorting
    if (rag.sortSessions.length > 0) {
      throw new ConflictException('Cannot delete rag that has been used in sorting');
    }

    const container = rag.container;

    await this.prisma.rag.delete({
      where: { id },
    });

    // Recalculate cost allocation for remaining rags
    await this.costAllocationService.allocateContainerCosts(container.id, userId);

    await this.auditService.log({
      userId,
      tenantId,
      action: 'RAG_DELETED',
      entityType: 'Rag',
      entityId: id,
      metadataJson: {
        ragCode: rag.ragCode,
        containerNumber: container.containerNumber,
      },
    });

    return { success: true };
  }
}

