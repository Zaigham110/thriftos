import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateRagDto } from './dto/create-rag.dto';
import { ContainerStatus, RagStatus, RagSourceType, SequenceScope } from '@prisma/client';
import { TenantSequenceService } from '../shared/tenant-sequence.service';

@Injectable()
export class RagService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costAllocationService: CostAllocationService,
    private tenantSequenceService: TenantSequenceService,
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
        rags: {
          select: { weightKg: true },
        },
      },
    });

    if (!container) {
      throw new BadRequestException('Container not found');
    }

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot add rags to a closed container');
    }

    // Validate raw category exists and is active
    const rawCategory = await this.prisma.rawCategory.findFirst({
      where: { id: dto.rawCategoryId, tenantId, isActive: true },
    });

    if (!rawCategory) {
      throw new BadRequestException('Raw category not found or inactive');
    }

    // Validate total weight doesn't exceed container gross weight
    const currentTotalWeight = container.rags.reduce((sum, rag) => sum + Number(rag.weightKg), 0);
    const newTotalWeight = Number(currentTotalWeight) + Number(dto.weightKg);
    const grossWeight = Number(container.grossWeight);

    if (newTotalWeight > grossWeight) {
      throw new BadRequestException(
        `Total weight (${newTotalWeight} kg) would exceed container gross weight (${grossWeight} kg). Available: ${grossWeight - currentTotalWeight} kg`,
      );
    }

    // Determine prefix based on type
    const prefix = dto.ragBaleType === 'BALE' ? 'BALE' : 'RAG';

    const { code: ragCode } = await this.tenantSequenceService.generateCode(
      tenantId,
      SequenceScope.RAG,
      { prefix, padSize: 3 },
      async (candidate) => {
        const collision = await this.prisma.rag.findFirst({
          where: { tenantId, ragCode: candidate },
          select: { id: true },
        });
        return !collision;
      },
    );

    const rag = await this.prisma.rag.create({
      data: {
        tenantId,
        containerId: dto.containerId,
        ragCode,
        ragBaleType: dto.ragBaleType,
        rawCategoryId: dto.rawCategoryId,
        weightKg: dto.weightKg,
        allocatedCost: 0, // Will be calculated
        notes: dto.notes,
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
        rawCategory: {
          select: { id: true, name: true, rawType: true },
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

  /**
   * Find all rags for a tenant.
   * 
   * Phase 2.5 Domain Rules:
   * - status filter allows filtering by RagStatus (NOT_STARTED, IN_SORTING, SORTED)
   * - sortableOnly = true filters to only NOT_STARTED rags (available for sorting)
   */
  async findAll(
    tenantId: string,
    options?: {
      containerId?: string;
      status?: RagStatus;
      sortableOnly?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Phase 2.5: Status-based filtering
    // sortableOnly = true filters to only NOT_STARTED rags
    let statusFilter: RagStatus | undefined = options?.status;
    if (options?.sortableOnly) {
      statusFilter = RagStatus.NOT_STARTED;
    }

    const where = {
      tenantId,
      ...(options?.containerId && { containerId: options.containerId }),
      ...(statusFilter && { status: statusFilter }),
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
          rawCategory: {
            select: { id: true, name: true, rawType: true },
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
        rawCategory: {
          select: { id: true, name: true, rawType: true },
        },
        // Phase 2.5: One-to-one relation (Rag can only have one SortSession)
        sortSession: {
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

    // Phase 2.5: Check if rag has been used in sorting (one-to-one relation)
    if (rag.sortSession) {
      throw new ConflictException('Cannot delete rag that has been used in sorting');
    }

    // Phase 2.5: Additional check - only NOT_STARTED rags can be deleted
    if (rag.status !== RagStatus.NOT_STARTED) {
      throw new ConflictException(`Cannot delete rag with status ${rag.status}`);
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

