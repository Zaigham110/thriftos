import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
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

  /**
   * Get cost breakdown for a container
   */
  async getContainerCostBreakdown(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      include: {
        containerCharges: true,
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

    const totalAllocatedToRags = container.rags.reduce(
      (sum, rag) => sum.add(rag.allocatedCost),
      new Decimal(0),
    );

    const totalAllocatedToBales = container.incomingBales.reduce(
      (sum, bale) => sum.add(bale.cost),
      new Decimal(0),
    );

    return {
      containerId,
      containerNumber: container.containerNumber,
      grossWeight: container.grossWeight,
      netWeight: container.netWeight,
      totalCharges: totalCharges.toString(),
      chargeBreakdown: container.containerCharges.map((c) => ({
        type: c.chargeType,
        description: c.description,
        amount: c.amount.toString(),
      })),
      rags: container.rags.map((r) => ({
        id: r.id,
        code: r.ragCode,
        weightKg: r.weightKg.toString(),
        allocatedCost: r.allocatedCost.toString(),
      })),
      incomingBales: container.incomingBales.map((b) => ({
        id: b.id,
        code: b.baleCode,
        weightKg: b.weightKg.toString(),
        allocatedCost: b.cost.toString(),
      })),
      totalAllocatedToRags: totalAllocatedToRags.toString(),
      totalAllocatedToBales: totalAllocatedToBales.toString(),
      totalAllocated: totalAllocatedToRags.add(totalAllocatedToBales).toString(),
    };
  }
}

