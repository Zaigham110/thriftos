import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { ContainerStatus } from '@prisma/client';

@Injectable()
export class IncomingBaleService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costAllocationService: CostAllocationService,
  ) {}

  async create(tenantId: string, dto: CreateIncomingBaleDto, userId: string) {
    // Validate container if provided
    if (dto.containerId) {
      const container = await this.prisma.container.findFirst({
        where: {
          id: dto.containerId,
          purchaseOrder: { tenantId },
        },
      });

      if (!container) {
        throw new BadRequestException('Container not found');
      }

      if (container.status === ContainerStatus.CLOSED) {
        throw new ConflictException('Cannot add bales to a closed container');
      }
    }

    // Validate vendor if provided
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, tenantId },
      });

      if (!vendor) {
        throw new BadRequestException('Vendor not found');
      }
    }

    // If not linked to container, cost is required
    if (!dto.containerId && (dto.cost === undefined || dto.cost === null)) {
      throw new BadRequestException('Cost is required for standalone bales not linked to a container');
    }

    // Check for duplicate bale code within tenant
    const existing = await this.prisma.incomingBale.findFirst({
      where: { tenantId, baleCode: dto.baleCode },
    });

    if (existing) {
      throw new BadRequestException(`Bale code "${dto.baleCode}" already exists`);
    }

    const bale = await this.prisma.incomingBale.create({
      data: {
        tenantId,
        containerId: dto.containerId,
        vendorId: dto.vendorId,
        baleCode: dto.baleCode,
        categoryGuess: dto.categoryGuess,
        weightKg: dto.weightKg,
        cost: dto.cost || 0, // Will be calculated if linked to container
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
        vendor: {
          select: { name: true },
        },
      },
    });

    // Recalculate cost allocation if linked to container
    if (dto.containerId) {
      await this.costAllocationService.allocateContainerCosts(dto.containerId, userId);

      // Reload to get updated cost
      const updatedBale = await this.prisma.incomingBale.findUnique({
        where: { id: bale.id },
        include: {
          container: {
            select: { containerNumber: true },
          },
          vendor: {
            select: { name: true },
          },
        },
      });

      await this.auditService.log({
        userId,
        tenantId,
        action: 'INCOMING_BALE_CREATED',
        entityType: 'IncomingBale',
        entityId: bale.id,
        metadataJson: {
          baleCode: bale.baleCode,
          containerNumber: bale.container?.containerNumber,
          weightKg: dto.weightKg,
        },
      });

      return updatedBale;
    }

    await this.auditService.log({
      userId,
      tenantId,
      action: 'INCOMING_BALE_CREATED',
      entityType: 'IncomingBale',
      entityId: bale.id,
      metadataJson: {
        baleCode: bale.baleCode,
        vendorName: bale.vendor?.name,
        weightKg: dto.weightKg,
        cost: dto.cost,
      },
    });

    return bale;
  }

  async findAll(
    tenantId: string,
    options?: {
      containerId?: string;
      vendorId?: string;
      standalone?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.containerId && { containerId: options.containerId }),
      ...(options?.vendorId && { vendorId: options.vendorId }),
    };

    // Filter for standalone bales (not linked to container)
    if (options?.standalone === true) {
      where.containerId = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.incomingBale.findMany({
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
          vendor: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.incomingBale.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const bale = await this.prisma.incomingBale.findFirst({
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
        vendor: true,
        sortSessions: {
          select: { id: true, status: true },
        },
      },
    });

    if (!bale) {
      throw new NotFoundException('Incoming bale not found');
    }

    return bale;
  }

  async update(tenantId: string, id: string, dto: Partial<CreateIncomingBaleDto>, userId: string) {
    const bale = await this.findOne(tenantId, id);

    // Check if bale has been used in sorting
    if (bale.sortSessions.length > 0) {
      throw new ConflictException('Cannot modify bale that has been used in sorting');
    }

    // If changing container
    if (dto.containerId !== undefined && dto.containerId !== bale.containerId) {
      if (dto.containerId) {
        const container = await this.prisma.container.findFirst({
          where: {
            id: dto.containerId,
            purchaseOrder: { tenantId },
          },
        });

        if (!container) {
          throw new BadRequestException('Container not found');
        }

        if (container.status === ContainerStatus.CLOSED) {
          throw new ConflictException('Cannot link to a closed container');
        }
      }
    }

    // If changing vendor
    if (dto.vendorId !== undefined && dto.vendorId !== bale.vendorId) {
      if (dto.vendorId) {
        const vendor = await this.prisma.vendor.findFirst({
          where: { id: dto.vendorId, tenantId },
        });

        if (!vendor) {
          throw new BadRequestException('Vendor not found');
        }
      }
    }

    const oldContainerId = bale.containerId;

    const updated = await this.prisma.incomingBale.update({
      where: { id },
      data: {
        containerId: dto.containerId,
        vendorId: dto.vendorId,
        categoryGuess: dto.categoryGuess,
        weightKg: dto.weightKg,
        cost: dto.containerId ? undefined : dto.cost, // Keep cost if standalone
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
        vendor: {
          select: { name: true },
        },
      },
    });

    // Recalculate cost for old container if removed
    if (oldContainerId && dto.containerId === null) {
      await this.costAllocationService.allocateContainerCosts(oldContainerId, userId);
    }

    // Recalculate cost for new container if added
    if (dto.containerId) {
      await this.costAllocationService.allocateContainerCosts(dto.containerId, userId);
    }

    await this.auditService.log({
      userId,
      tenantId,
      action: 'INCOMING_BALE_UPDATED',
      entityType: 'IncomingBale',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const bale = await this.findOne(tenantId, id);

    // Check if bale has been used in sorting
    if (bale.sortSessions.length > 0) {
      throw new ConflictException('Cannot delete bale that has been used in sorting');
    }

    const containerId = bale.containerId;

    await this.prisma.incomingBale.delete({
      where: { id },
    });

    // Recalculate cost allocation if was linked to container
    if (containerId) {
      await this.costAllocationService.allocateContainerCosts(containerId, userId);
    }

    await this.auditService.log({
      userId,
      tenantId,
      action: 'INCOMING_BALE_DELETED',
      entityType: 'IncomingBale',
      entityId: id,
      metadataJson: {
        baleCode: bale.baleCode,
        containerNumber: bale.container?.containerNumber,
      },
    });

    return { success: true };
  }
}

