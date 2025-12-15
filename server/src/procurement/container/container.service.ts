import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { CreateContainerChargeDto } from './dto/create-container-charge.dto';
import { ContainerStatus, PurchaseOrderType, PurchaseOrderStatus } from '@prisma/client';

@Injectable()
export class ContainerService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costAllocationService: CostAllocationService,
  ) {}

  async create(tenantId: string, dto: CreateContainerDto, userId: string) {
    // Validate purchase order
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, tenantId },
    });

    if (!po) {
      throw new BadRequestException('Purchase order not found');
    }

    if (po.poType !== PurchaseOrderType.CONTAINER) {
      throw new BadRequestException('Purchase order type must be CONTAINER to add containers');
    }

    if (po.status === PurchaseOrderStatus.CLOSED) {
      throw new ConflictException('Cannot add container to a closed purchase order');
    }

    // Check for duplicate container number within the PO
    const existing = await this.prisma.container.findFirst({
      where: { purchaseOrderId: dto.purchaseOrderId, containerNumber: dto.containerNumber },
    });

    if (existing) {
      throw new BadRequestException(`Container "${dto.containerNumber}" already exists in this PO`);
    }

    const container = await this.prisma.container.create({
      data: {
        purchaseOrderId: dto.purchaseOrderId,
        containerNumber: dto.containerNumber,
        referenceNumber: dto.referenceNumber,
        containerType: dto.containerType,
        eta: dto.eta ? new Date(dto.eta) : null,
        grossWeight: dto.grossWeight,
        netWeight: dto.netWeight,
        status: ContainerStatus.IN_TRANSIT,
      },
      include: {
        containerCharges: true,
        purchaseOrder: {
          select: { poNumber: true },
        },
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_CREATED',
      entityType: 'Container',
      entityId: container.id,
      metadataJson: {
        containerNumber: container.containerNumber,
        poNumber: container.purchaseOrder.poNumber,
      },
    });

    return container;
  }

  async findAll(
    tenantId: string,
    options?: {
      purchaseOrderId?: string;
      status?: ContainerStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      purchaseOrder: { tenantId },
      ...(options?.purchaseOrderId && { purchaseOrderId: options.purchaseOrderId }),
      ...(options?.status && { status: options.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.container.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, tenantId: true },
          },
          containerCharges: true,
          _count: {
            select: {
              rags: true,
              incomingBales: true,
            },
          },
        },
      }),
      this.prisma.container.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const container = await this.prisma.container.findFirst({
      where: {
        id,
        purchaseOrder: { tenantId },
      },
      include: {
        purchaseOrder: {
          select: { id: true, poNumber: true, tenantId: true, vendor: true },
        },
        containerCharges: true,
        rags: true,
        incomingBales: true,
      },
    });

    if (!container) {
      throw new NotFoundException('Container not found');
    }

    return container;
  }

  async update(tenantId: string, id: string, dto: UpdateContainerDto, userId: string) {
    const container = await this.findOne(tenantId, id);

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot modify a closed container');
    }

    const updated = await this.prisma.container.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.eta && { eta: new Date(dto.eta) }),
      },
      include: {
        purchaseOrder: {
          select: { poNumber: true },
        },
        containerCharges: true,
      },
    });

    // Recalculate cost allocation if weight changed
    if (dto.netWeight !== undefined) {
      await this.costAllocationService.allocateContainerCosts(id, userId);
    }

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_UPDATED',
      entityType: 'Container',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateContainerStatusDto, userId: string) {
    const container = await this.findOne(tenantId, id);

    // Validate status transitions
    const validTransitions: Record<ContainerStatus, ContainerStatus[]> = {
      [ContainerStatus.IN_TRANSIT]: [ContainerStatus.ARRIVED],
      [ContainerStatus.ARRIVED]: [ContainerStatus.CLEARED, ContainerStatus.IN_TRANSIT],
      [ContainerStatus.CLEARED]: [ContainerStatus.CLOSED, ContainerStatus.ARRIVED],
      [ContainerStatus.CLOSED]: [],
    };

    if (!validTransitions[container.status].includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition from ${container.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.container.update({
      where: { id },
      data: { status: dto.status },
      include: {
        purchaseOrder: {
          select: { poNumber: true },
        },
        containerCharges: true,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_STATUS_CHANGED',
      entityType: 'Container',
      entityId: id,
      metadataJson: {
        containerNumber: container.containerNumber,
        previousStatus: container.status,
        newStatus: dto.status,
      },
    });

    return updated;
  }

  // Container Charges
  async addCharge(tenantId: string, containerId: string, dto: CreateContainerChargeDto, userId: string) {
    const container = await this.findOne(tenantId, containerId);

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot add charges to a closed container');
    }

    const charge = await this.prisma.containerCharge.create({
      data: {
        containerId,
        chargeType: dto.chargeType,
        description: dto.description,
        amount: dto.amount,
      },
    });

    // Recalculate cost allocation
    await this.costAllocationService.allocateContainerCosts(containerId, userId);

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_CHARGE_ADDED',
      entityType: 'ContainerCharge',
      entityId: charge.id,
      metadataJson: {
        containerNumber: container.containerNumber,
        chargeType: dto.chargeType,
        amount: dto.amount,
      },
    });

    return charge;
  }

  async getCharges(tenantId: string, containerId: string) {
    await this.findOne(tenantId, containerId);

    return this.prisma.containerCharge.findMany({
      where: { containerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteCharge(tenantId: string, containerId: string, chargeId: string, userId: string) {
    const container = await this.findOne(tenantId, containerId);

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot delete charges from a closed container');
    }

    const charge = await this.prisma.containerCharge.findFirst({
      where: { id: chargeId, containerId },
    });

    if (!charge) {
      throw new NotFoundException('Charge not found');
    }

    await this.prisma.containerCharge.delete({
      where: { id: chargeId },
    });

    // Recalculate cost allocation
    await this.costAllocationService.allocateContainerCosts(containerId, userId);

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_CHARGE_DELETED',
      entityType: 'ContainerCharge',
      entityId: chargeId,
      metadataJson: {
        containerNumber: container.containerNumber,
        chargeType: charge.chargeType,
        amount: charge.amount.toString(),
      },
    });

    return { success: true };
  }

  async getCostBreakdown(tenantId: string, containerId: string) {
    await this.findOne(tenantId, containerId);
    return this.costAllocationService.getContainerCostBreakdown(containerId);
  }
}

