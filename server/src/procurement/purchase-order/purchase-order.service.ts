import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderStatus, ContainerStatus } from '@prisma/client';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreatePurchaseOrderDto, userId: string) {
    // Check for duplicate PO number
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { tenantId, poNumber: dto.poNumber },
    });

    if (existing) {
      throw new BadRequestException(`Purchase order "${dto.poNumber}" already exists`);
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

    const po = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber: dto.poNumber,
        poType: dto.poType,
        vendorId: dto.vendorId,
        currency: dto.currency || 'USD',
        totalCost: dto.totalCost || 0,
        status: PurchaseOrderStatus.OPEN,
      },
      include: {
        vendor: true,
        containers: true,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'PURCHASE_ORDER_CREATED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadataJson: { poNumber: po.poNumber, poType: po.poType },
    });

    return po;
  }

  async findAll(
    tenantId: string,
    options?: {
      status?: PurchaseOrderStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(options?.status && { status: options.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: true,
          _count: {
            select: {
              containers: true,
            },
          },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        containers: {
          include: {
            containerCharges: true,
            _count: {
              select: {
                rags: true,
                incomingBales: true,
              },
            },
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    return po;
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto, userId: string) {
    const po = await this.findOne(tenantId, id);

    if (po.status === PurchaseOrderStatus.CLOSED) {
      throw new ConflictException('Cannot modify a closed purchase order');
    }

    // Validate vendor if changing
    if (dto.vendorId && dto.vendorId !== po.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, tenantId },
      });
      if (!vendor) {
        throw new BadRequestException('Vendor not found');
      }
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: dto,
      include: {
        vendor: true,
        containers: true,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'PURCHASE_ORDER_UPDATED',
      entityType: 'PurchaseOrder',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  async receive(tenantId: string, id: string, userId: string) {
    const po = await this.findOne(tenantId, id);

    if (po.status !== PurchaseOrderStatus.OPEN) {
      throw new ConflictException(`Cannot receive PO with status ${po.status}`);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.RECEIVED },
      include: {
        vendor: true,
        containers: true,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'PURCHASE_ORDER_RECEIVED',
      entityType: 'PurchaseOrder',
      entityId: id,
      metadataJson: { poNumber: po.poNumber },
    });

    return updated;
  }

  async close(tenantId: string, id: string, userId: string) {
    const po = await this.findOne(tenantId, id);

    if (po.status === PurchaseOrderStatus.CLOSED) {
      throw new ConflictException('Purchase order is already closed');
    }

    // Check if all containers are closed
    const openContainers = po.containers.filter(
      (c) => c.status !== ContainerStatus.CLOSED,
    );

    if (openContainers.length > 0) {
      throw new ConflictException(
        `Cannot close PO: ${openContainers.length} container(s) are not closed`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CLOSED },
      include: {
        vendor: true,
        containers: true,
      },
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'PURCHASE_ORDER_CLOSED',
      entityType: 'PurchaseOrder',
      entityId: id,
      metadataJson: { poNumber: po.poNumber },
    });

    return updated;
  }
}

