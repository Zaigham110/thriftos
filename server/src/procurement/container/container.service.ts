import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostingService } from '../../costing/costing.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerWeightsDto } from './dto/update-container-weights.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { CreateContainerChargeDto } from './dto/create-container-charge.dto';
import { ContainerStatus, PurchaseOrderType, PurchaseOrderStatus, SequenceScope, Prisma } from '@prisma/client';
import { TenantSequenceService } from '../shared/tenant-sequence.service';

@Injectable()
export class ContainerService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private costing: CostingService,
    private tenantSequenceService: TenantSequenceService,
  ) {}

  private toDate(value?: string) {
    return value ? new Date(value) : null;
  }

  private computeCreateWeightsOrThrow(grossWeightKg: number, netWeightKg: number, tareWeightKg?: number) {
    if (!Number.isFinite(grossWeightKg) || grossWeightKg <= 0) {
      throw new BadRequestException('grossWeightKg must be greater than 0');
    }
    if (!Number.isFinite(netWeightKg) || netWeightKg <= 0) {
      throw new BadRequestException('netWeightKg must be greater than 0');
    }

    const gross = new Prisma.Decimal(grossWeightKg).toDecimalPlaces(2);
    const net = new Prisma.Decimal(netWeightKg).toDecimalPlaces(2);

    if (net.gt(gross)) {
      throw new BadRequestException('netWeightKg must be less than or equal to grossWeightKg');
    }

    if (tareWeightKg === undefined) {
      // Tare weight is optional at creation time; store null if omitted.
      return { gross, tare: null as Prisma.Decimal | null, net };
    }

    if (!Number.isFinite(tareWeightKg) || tareWeightKg < 0) {
      throw new BadRequestException('tareWeightKg must be 0 or greater');
    }

    const tare = new Prisma.Decimal(tareWeightKg).toDecimalPlaces(2);

    if (tare.gte(gross)) {
      throw new BadRequestException('tareWeightKg must be less than grossWeightKg');
    }

    const computedNet = gross.minus(tare).toDecimalPlaces(2);
    if (!computedNet.equals(net)) {
      throw new BadRequestException('netWeightKg must equal grossWeightKg - tareWeightKg');
    }

    return { gross, tare, net };
  }

  private computeNetWeightOrThrow(grossWeightKg: number, tareWeightKg?: number | null) {
    if (!Number.isFinite(grossWeightKg) || grossWeightKg <= 0) {
      throw new BadRequestException('grossWeightKg must be greater than 0');
    }

    const safeTare = tareWeightKg === null || tareWeightKg === undefined ? 0 : tareWeightKg;
    if (!Number.isFinite(safeTare) || safeTare < 0) {
      throw new BadRequestException('tareWeightKg must be 0 or greater');
    }

    if (safeTare >= grossWeightKg) {
      throw new BadRequestException('tareWeightKg must be less than grossWeightKg');
    }

    const gross = new Prisma.Decimal(grossWeightKg);
    const tare = new Prisma.Decimal(safeTare);
    const net = gross.minus(tare).toDecimalPlaces(2);

    if (net.lte(0)) {
      throw new BadRequestException('Computed netWeight must be greater than 0');
    }

    return { gross, tare, net };
  }

  async create(tenantId: string, dto: CreateContainerDto, userId: string) {
    if (!dto.vendorId && !dto.purchaseOrderId) {
      throw new BadRequestException('Pick a supplier');
    }

    let vendorId = dto.vendorId ?? null;
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId, tenantId } });
      if (!po) throw new BadRequestException('Purchase order not found');
      if (po.poType === PurchaseOrderType.LOOSE_BALE) {
        throw new BadRequestException('Containers are not allowed for LOOSE_BALE purchase orders');
      }
      if (po.status === PurchaseOrderStatus.CLOSED) {
        throw new ConflictException('Cannot add container to a closed purchase order');
      }
      vendorId ??= po.vendorId;
    }

    const vendor = vendorId
      ? await this.prisma.vendor.findFirst({ where: { id: vendorId, tenantId }, select: { id: true, originCountry: true } })
      : null;
    if (vendorId && !vendor) throw new BadRequestException('Supplier not found');

    const containerNumber = dto.containerNumber?.trim() || (await this.nextContainerNumber(tenantId));
    const taken = await this.prisma.container.findFirst({ where: { tenantId, containerNumber }, select: { id: true } });
    if (taken) throw new ConflictException(`Container ${containerNumber} already exists`);

    const { gross, tare, net } = this.computeCreateWeightsOrThrow(dto.grossWeightKg ?? dto.netWeightKg, dto.netWeightKg, dto.tareWeightKg);
    const purchaseCurrency = (dto.purchaseCurrency ?? 'PKR').toUpperCase();
    if (purchaseCurrency !== 'PKR' && !dto.fxRate) {
      throw new BadRequestException(`Enter the ${purchaseCurrency} to PKR rate`);
    }

    const container = await this.prisma.$transaction(async (tx) => {
      const created = await tx.container.create({
        data: {
          tenantId,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          vendorId: vendor?.id ?? null,
          originCountry: dto.originCountry ?? vendor?.originCountry ?? null,
          containerNumber,
          referenceNumber: dto.referenceNumber,
          containerType: dto.containerType,
          eta: this.toDate(dto.eta),
          etd: this.toDate(dto.etd),
          arrivedAt: this.toDate(dto.arrivedAt),
          clearedAt: this.toDate(dto.clearedAt),
          releasedAt: this.toDate(dto.releasedAt),
          grossWeight: gross,
          tareWeight: tare,
          netWeight: net,
          purchaseCost: new Prisma.Decimal(dto.purchaseCost ?? 0),
          purchaseCurrency,
          fxRate: new Prisma.Decimal(purchaseCurrency === 'PKR' ? 1 : dto.fxRate!),
          billOfLadingNumber: dto.billOfLadingNumber,
          shipmentReference: dto.shipmentReference,
          shippingLine: dto.shippingLine,
          vesselName: dto.vesselName,
          portOfLoading: dto.portOfLoading,
          portOfDischarge: dto.portOfDischarge,
          forwarder: dto.forwarder,
          notes: dto.notes,
          status: ContainerStatus.IN_TRANSIT,
        },
      });
      await this.costing.recalculateContainerTx(tx, tenantId, created.id, userId);
      return created;
    });

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_CREATED',
      entityType: 'Container',
      entityId: container.id,
      metadataJson: { containerNumber, purchaseCost: container.purchaseCost.toString(), purchaseCurrency },
    });

    return this.findOne(tenantId, container.id);
  }

  private async nextContainerNumber(tenantId: string) {
    const { code } = await this.tenantSequenceService.generateCode(
      tenantId,
      SequenceScope.CONTAINER,
      { prefix: 'CONT', padSize: 3 },
      async (candidate) => !(await this.prisma.container.findFirst({ where: { tenantId, containerNumber: candidate }, select: { id: true } })),
    );
    return code;
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
      tenantId,
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
            select: { id: true, poNumber: true, tenantId: true, vendor: true },
          },
          vendor: { select: { id: true, name: true, originCountry: true } },
          containerCharges: true,
          _count: { select: { rags: true } },
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
        tenantId,
      },
      include: {
        purchaseOrder: {
          select: { id: true, poNumber: true, tenantId: true, vendor: true },
        },
        vendor: { select: { id: true, name: true, originCountry: true } },
        containerCharges: true,
        rags: true,
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

    // Weighbridge Audit Calculations
    let weighbridgeNetWeight: Prisma.Decimal | null = container.weighbridgeNetWeight;
    let weightVarianceKg: Prisma.Decimal | null = container.weightVarianceKg;
    let weightVariancePct: Prisma.Decimal | null = container.weightVariancePct;
    let varianceAlertStatus: string | null = container.varianceAlertStatus;

    const wbGross = dto.weighbridgeGrossWeight !== undefined ? dto.weighbridgeGrossWeight : (container.weighbridgeGrossWeight ? Number(container.weighbridgeGrossWeight) : null);
    const wbTare = dto.weighbridgeTareWeight !== undefined ? dto.weighbridgeTareWeight : (container.weighbridgeTareWeight ? Number(container.weighbridgeTareWeight) : 0);

    if (wbGross !== null && wbGross > 0) {
      const wbNetVal = Math.max(0, wbGross - (wbTare || 0));
      weighbridgeNetWeight = new Prisma.Decimal(wbNetVal);
      const blNet = Number(container.netWeight || 0);
      if (blNet > 0) {
        const diffKg = Number((wbNetVal - blNet).toFixed(2));
        const diffPct = Number(((diffKg / blNet) * 100).toFixed(2));
        weightVarianceKg = new Prisma.Decimal(diffKg);
        weightVariancePct = new Prisma.Decimal(diffPct);

        const absPct = Math.abs(diffPct);
        varianceAlertStatus = absPct <= 2.0 ? 'OK' : absPct <= 5.0 ? 'VARIANCE_WARNING' : 'CRITICAL_DISCREPANCY';
      }
    }

    const costChanged = dto.purchaseCost !== undefined || dto.purchaseCurrency !== undefined || dto.fxRate !== undefined;
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, tenantId }, select: { id: true } });
      if (!vendor) throw new BadRequestException('Supplier not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.container.update({
      where: { id },
      data: {
        ...(dto.referenceNumber !== undefined && { referenceNumber: dto.referenceNumber }),
        ...(dto.containerType !== undefined && { containerType: dto.containerType }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.billOfLadingNumber !== undefined && { billOfLadingNumber: dto.billOfLadingNumber }),
        ...(dto.shipmentReference !== undefined && { shipmentReference: dto.shipmentReference }),
        ...(dto.shippingLine !== undefined && { shippingLine: dto.shippingLine }),
        ...(dto.vesselName !== undefined && { vesselName: dto.vesselName }),
        ...(dto.portOfLoading !== undefined && { portOfLoading: dto.portOfLoading }),
        ...(dto.portOfDischarge !== undefined && { portOfDischarge: dto.portOfDischarge }),
        ...(dto.forwarder !== undefined && { forwarder: dto.forwarder }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.eta !== undefined && { eta: this.toDate(dto.eta) }),
        ...(dto.etd !== undefined && { etd: this.toDate(dto.etd) }),
        ...(dto.arrivedAt !== undefined && { arrivedAt: this.toDate(dto.arrivedAt) }),
        ...(dto.clearedAt !== undefined && { clearedAt: this.toDate(dto.clearedAt) }),
        ...(dto.releasedAt !== undefined && { releasedAt: this.toDate(dto.releasedAt) }),
        ...(dto.weighbridgeGrossWeight !== undefined && { weighbridgeGrossWeight: new Prisma.Decimal(dto.weighbridgeGrossWeight) }),
        ...(dto.weighbridgeTareWeight !== undefined && { weighbridgeTareWeight: new Prisma.Decimal(dto.weighbridgeTareWeight) }),
        ...(weighbridgeNetWeight !== null && { weighbridgeNetWeight }),
        ...(weightVarianceKg !== null && { weightVarianceKg }),
        ...(weightVariancePct !== null && { weightVariancePct }),
        ...(varianceAlertStatus !== null && { varianceAlertStatus }),
        ...(dto.fxRate !== undefined && { fxRate: new Prisma.Decimal(dto.fxRate) }),
        ...(dto.purchaseCost !== undefined && { purchaseCost: new Prisma.Decimal(dto.purchaseCost) }),
        ...(dto.purchaseCurrency !== undefined && { purchaseCurrency: dto.purchaseCurrency.toUpperCase() }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
        ...(dto.originCountry !== undefined && { originCountry: dto.originCountry }),
      },
      });
      if (costChanged) await this.costing.recalculateContainerTx(tx, tenantId, id, userId);
      return tx.container.findUniqueOrThrow({
        where: { id },
        include: { purchaseOrder: { select: { poNumber: true } }, containerCharges: true },
      });
    });

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

  async updateWeights(tenantId: string, id: string, dto: UpdateContainerWeightsDto, userId: string) {
    const container = await this.findOne(tenantId, id);

    if (container.status === ContainerStatus.CLOSED) {
      throw new ConflictException('Cannot modify a closed container');
    }

    const { gross, tare, net } = this.computeNetWeightOrThrow(dto.grossWeightKg, dto.tareWeightKg);

    const updated = await this.prisma.container.update({
      where: { id },
      data: {
        grossWeight: gross,
        tareWeight: tare,
        netWeight: net,
      },
      include: {
        purchaseOrder: {
          select: { poNumber: true },
        },
        containerCharges: true,
      },
    });

    await this.costing.recalculateContainer(tenantId, id, userId);

    await this.auditService.log({
      userId,
      tenantId,
      action: 'CONTAINER_WEIGHTS_UPDATED',
      entityType: 'Container',
      entityId: id,
      metadataJson: {
        grossWeightKg: dto.grossWeightKg,
        tareWeightKg: dto.tareWeightKg,
      },
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

    const charge = await this.prisma.$transaction(async (tx) => {
      const created = await tx.containerCharge.create({
        data: {
          containerId,
          chargeType: dto.chargeType,
          description: dto.description?.trim() || dto.chargeType,
          amount: new Prisma.Decimal(dto.amount),
        },
      });
      await this.costing.recalculateContainerTx(tx, tenantId, containerId, userId);
      return created;
    });

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

    await this.prisma.$transaction(async (tx) => {
      await tx.containerCharge.delete({ where: { id: chargeId } });
      await this.costing.recalculateContainerTx(tx, tenantId, containerId, userId);
    });

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
    return this.costing.containerBreakdown(tenantId, containerId);
  }
}

