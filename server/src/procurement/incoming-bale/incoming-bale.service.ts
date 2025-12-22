import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateIncomingBaleDto } from './dto/create-incoming-bale.dto';
import { ContainerStatus, PurchaseOrderType, SequenceScope } from '@prisma/client';
import { TenantSequenceService } from '../shared/tenant-sequence.service';

@Injectable()
export class IncomingBaleService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costAllocationService: CostAllocationService,
    private tenantSequenceService: TenantSequenceService,
  ) {}

  async create(tenantId: string, dto: CreateIncomingBaleDto, userId: string) {
    let purchaseOrderId: string | null = dto.purchaseOrderId || null;

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

      purchaseOrderId = container.purchaseOrderId;
    } else if (purchaseOrderId) {
      const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          tenantId,
        },
      });

      if (!purchaseOrder) {
        throw new BadRequestException('Purchase order not found');
      }

      if (purchaseOrder.poType !== PurchaseOrderType.LOOSE_BALE && purchaseOrder.poType !== PurchaseOrderType.HYBRID) {
        throw new BadRequestException('Purchase order type must allow loose bales');
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

    const rawCategory = await this.prisma.rawCategory.findFirst({
      where: { id: dto.rawCategoryId, tenantId, isActive: true },
    });

    if (!rawCategory) {
      throw new BadRequestException('Raw category not found');
    }

    const { code: baleCode } = await this.tenantSequenceService.generateCode(
      tenantId,
      SequenceScope.INCOMING_BALE,
      { prefix: dto.containerId ? 'CB' : 'BALE', padSize: 3 },
      async (code) => {
        const collision = await this.prisma.incomingBale.findFirst({
          where: { tenantId, baleCode: code },
          select: { id: true },
        });
        return !collision;
      },
    );

    const bale = await this.prisma.incomingBale.create({
      data: {
        tenantId,
        containerId: dto.containerId,
        purchaseOrderId,
        vendorId: dto.vendorId,
        baleCode,
        rawCategoryId: dto.rawCategoryId,
        weightKg: dto.weightKg,
        cost: dto.containerId ? 0 : dto.cost || 0,
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
        vendor: {
          select: { name: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
        rawCategory: {
          select: { id: true, name: true, rawType: true },
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
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          rawCategory: {
            select: { id: true, name: true, rawType: true },
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
          rawCategory: rawCategory.name,
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
        rawCategory: rawCategory.name,
      },
    });

    if (!dto.containerId && purchaseOrderId) {
      await this.costAllocationService.syncPurchaseOrderTotals(purchaseOrderId);
    }

    return bale;
  }

  async findAll(
    tenantId: string,
    options?: {
      containerId?: string;
      vendorId?: string;
      purchaseOrderId?: string;
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
      ...(options?.purchaseOrderId && { purchaseOrderId: options.purchaseOrderId }),
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
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          rawCategory: {
            select: { id: true, name: true, rawType: true },
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
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            vendor: true,
          },
        },
        rawCategory: {
          select: { id: true, name: true, rawType: true },
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
    let targetPurchaseOrderId = bale.purchaseOrderId;

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

        targetPurchaseOrderId = container.purchaseOrderId;
      }
    }

    if (dto.purchaseOrderId !== undefined && dto.containerId === undefined) {
      if (dto.purchaseOrderId) {
        const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
          where: {
            id: dto.purchaseOrderId,
            tenantId,
          },
        });

        if (!purchaseOrder) {
          throw new BadRequestException('Purchase order not found');
        }

        if (purchaseOrder.poType !== PurchaseOrderType.LOOSE_BALE && purchaseOrder.poType !== PurchaseOrderType.HYBRID) {
          throw new BadRequestException('Purchase order type must allow loose bales');
        }

        targetPurchaseOrderId = dto.purchaseOrderId;
      } else {
        targetPurchaseOrderId = null;
      }
    }

    if (dto.containerId === null) {
      targetPurchaseOrderId = dto.purchaseOrderId ?? targetPurchaseOrderId;
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
    const previousStandalonePoId = bale.containerId ? null : bale.purchaseOrder?.id ?? bale.purchaseOrderId;

    let rawCategoryNameToPersist: string | undefined;
    if (dto.rawCategoryId !== undefined && dto.rawCategoryId !== bale.rawCategoryId) {
      const rawCategory = await this.prisma.rawCategory.findFirst({
        where: { id: dto.rawCategoryId, tenantId, isActive: true },
      });

      if (!rawCategory) {
        throw new BadRequestException('Raw category not found');
      }

      rawCategoryNameToPersist = rawCategory.name;
    }

    const updated = await this.prisma.incomingBale.update({
      where: { id },
      data: {
        ...(dto.containerId !== undefined && { containerId: dto.containerId }),
        ...(targetPurchaseOrderId !== undefined && { purchaseOrderId: targetPurchaseOrderId }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(rawCategoryNameToPersist && {
          rawCategoryId: dto.rawCategoryId,
        }),
        ...(dto.containerId !== undefined &&
          (dto.containerId
            ? { cost: undefined }
            : { cost: dto.cost ?? bale.cost ?? 0 })),
      },
      include: {
        container: {
          select: { containerNumber: true },
        },
        vendor: {
          select: { name: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
        rawCategory: {
          select: { id: true, name: true, rawType: true },
        },
      },
    });

    const containerChanged = dto.containerId !== undefined && dto.containerId !== oldContainerId;
    const finalContainerId = dto.containerId !== undefined ? dto.containerId : oldContainerId;

    if (oldContainerId && containerChanged) {
      await this.costAllocationService.allocateContainerCosts(oldContainerId, userId);
    }

    if (finalContainerId && (containerChanged || dto.weightKg !== undefined)) {
      await this.costAllocationService.allocateContainerCosts(finalContainerId, userId);
    }

    await this.auditService.log({
      userId,
      tenantId,
      action: 'INCOMING_BALE_UPDATED',
      entityType: 'IncomingBale',
      entityId: id,
      metadataJson: { changes: dto },
    });

    const newStandalonePoId = finalContainerId ? null : updated.purchaseOrder?.id ?? updated.purchaseOrderId ?? targetPurchaseOrderId ?? null;

    if (previousStandalonePoId) {
      await this.costAllocationService.syncPurchaseOrderTotals(previousStandalonePoId);
    }

    if (newStandalonePoId && newStandalonePoId !== previousStandalonePoId) {
      await this.costAllocationService.syncPurchaseOrderTotals(newStandalonePoId);
    }

    return updated;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const bale = await this.findOne(tenantId, id);

    // Check if bale has been used in sorting
    if (bale.sortSessions.length > 0) {
      throw new ConflictException('Cannot delete bale that has been used in sorting');
    }

    const containerId = bale.containerId;
    const standalonePoId = containerId ? null : bale.purchaseOrder?.id ?? bale.purchaseOrderId ?? null;

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

    if (standalonePoId) {
      await this.costAllocationService.syncPurchaseOrderTotals(standalonePoId);
    }

    return { success: true };
  }
}

