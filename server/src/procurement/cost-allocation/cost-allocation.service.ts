import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CostAllocationService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Allocate container costs to all rags and incoming bales
   * Formula: allocatedCost = (itemWeightKg / containerNetWeightKg) × containerTotalCost
   */
  async allocateContainerCosts(containerId: string, userId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get container with charges, rags, and incoming bales
      const container = await tx.container.findUnique({
        where: { id: containerId },
        include: {
          containerCharges: true,
          rags: true,
          incomingBales: true,
          purchaseOrder: {
            select: { tenantId: true },
          },
        },
      });

      if (!container) {
        throw new BadRequestException('Container not found');
      }

      const netWeight = container.netWeight;
      if (!netWeight || netWeight.equals(new Decimal(0))) {
        throw new BadRequestException('Container net weight must be greater than 0 for cost allocation');
      }

      // Calculate total container cost from charges
      const totalCost = container.containerCharges.reduce(
        (sum, charge) => sum.add(charge.amount),
        new Decimal(0),
      );

      // Allocate costs to rags
      for (const rag of container.rags) {
        const allocatedCost = rag.weightKg.div(netWeight).mul(totalCost);
        await tx.rag.update({
          where: { id: rag.id },
          data: { allocatedCost },
        });
      }

      // Allocate costs to incoming bales linked to this container
      for (const bale of container.incomingBales) {
        const allocatedCost = bale.weightKg.div(netWeight).mul(totalCost);
        await tx.incomingBale.update({
          where: { id: bale.id },
          data: { cost: allocatedCost },
        });
      }

      await this.syncPurchaseOrderTotals(container.purchaseOrderId, tx);

      // Log the allocation
      if (userId) {
        await this.auditService.log({
          userId,
          tenantId: container.purchaseOrder.tenantId,
          action: 'COST_ALLOCATION_RECALCULATED',
          entityType: 'Container',
          entityId: containerId,
          metadataJson: {
            containerNumber: container.containerNumber,
            totalCost: totalCost.toString(),
            netWeight: netWeight.toString(),
            ragsCount: container.rags.length,
            balesCount: container.incomingBales.length,
          },
        });
      }
    });
  }

  async syncPurchaseOrderTotals(
    purchaseOrderId: string,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = prismaClient ?? this.prisma;

    const po = await client.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        containers: {
          select: {
            containerCharges: {
              select: { amount: true },
            },
          },
        },
        incomingBales: {
          where: { containerId: null },
          select: { cost: true },
        },
      },
    });

    if (!po) {
      return;
    }

    const containerTotals = po.containers.reduce((sum, container) => {
      const chargesTotal = container.containerCharges.reduce(
        (chargeSum, charge) => chargeSum.add(charge.amount),
        new Decimal(0),
      );
      return sum.add(chargesTotal);
    }, new Decimal(0));

    const looseBaleTotals = po.incomingBales.reduce(
      (sum, bale) => sum.add(bale.cost ?? new Decimal(0)),
      new Decimal(0),
    );

    await client.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { totalCost: containerTotals.add(looseBaleTotals) },
    });
  }

  /**
   * Get cost breakdown for a container
   * Returns structure matching frontend CostBreakdown interface
   */
  async getContainerCostBreakdown(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      include: {
        containerCharges: true,
        purchaseOrder: {
          select: { currency: true },
        },
        rags: {
          select: {
            id: true,
            ragCode: true,
            weightKg: true,
            allocatedCost: true,
          },
        },
        incomingBales: {
          select: {
            id: true,
            baleCode: true,
            weightKg: true,
            cost: true,
          },
        },
      },
    });

    if (!container) {
      return null;
    }

    const totalCharges = container.containerCharges.reduce(
      (sum, charge) => sum.add(charge.amount),
      new Decimal(0),
    );

    const totalWeight = Number(container.netWeight) || 0;
    const totalCost = Number(totalCharges);
    const costPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;

    // Return structure matching frontend CostBreakdown interface
    return {
      containerId,
      containerNumber: container.containerNumber,
      totalCost,
      costPerKg,
      totalWeight,
      currency: container.purchaseOrder?.currency ?? 'USD',
      charges: container.containerCharges.map((c) => ({
        id: c.id,
        containerId: c.containerId,
        chargeType: c.chargeType,
        description: c.description,
        amount: Number(c.amount),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      // Additional data for detailed breakdown (optional)
      rags: container.rags.map((r) => ({
        id: r.id,
        code: r.ragCode,
        weightKg: Number(r.weightKg),
        allocatedCost: Number(r.allocatedCost),
      })),
      incomingBales: container.incomingBales.map((b) => ({
        id: b.id,
        code: b.baleCode,
        weightKg: Number(b.weightKg),
        allocatedCost: Number(b.cost),
      })),
    };
  }
}

