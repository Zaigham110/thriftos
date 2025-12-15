import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class ProcurementReportsService {
  constructor(private prisma: PrismaService) {}

  async containerCostBreakdown(tenantId: string, containerId: string) {
    const container = await this.prisma.container.findFirst({
      where: { id: containerId, purchaseOrder: { tenantId } },
      include: {
        containerCharges: true,
        rags: true,
        purchaseOrder: { select: { id: true, poNumber: true, vendorId: true } },
      },
    });
    if (!container) throw new NotFoundException('Container not found');

    const totalCharges = container.containerCharges.reduce(
      (sum, c) => sum.add(c.amount),
      new Decimal(0),
    );

    const costPerKg =
      container.netWeight && !container.netWeight.equals(new Decimal(0))
        ? totalCharges.div(container.netWeight)
        : new Decimal(0);

    const ragAllocations = container.rags.map((r) => ({
      ragId: r.id,
      ragCode: r.ragCode,
      weightKg: r.weightKg.toString(),
      allocatedCost: r.allocatedCost.toString(),
      costPerKg: r.weightKg.equals(new Decimal(0)) ? '0' : r.allocatedCost.div(r.weightKg).toString(),
    }));

    return {
      containerId: container.id,
      containerNumber: container.containerNumber,
      purchaseOrderId: container.purchaseOrderId,
      poNumber: container.purchaseOrder.poNumber,
      netWeightKg: container.netWeight?.toString() ?? null,
      totalCost: totalCharges.toString(),
      costPerKg: costPerKg.toString(),
      charges: container.containerCharges.map((c) => ({
        id: c.id,
        type: c.chargeType,
        description: c.description,
        amount: c.amount.toString(),
      })),
      ragAllocations,
    };
  }

  /**
   * Vendor procurement summary:
   * - Container purchases: sum rag weights + rag allocatedCost (represents container cost distributed)
   * - Loose bales: sum IncomingBale weight and cost where containerId is null
   */
  async vendorProcurementSummary(
    tenantId: string,
    filters: { startDate?: string; endDate?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    // Raw SQL for performance and correctness across joins.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        vendorId: string;
        vendorName: string;
        totalWeightKg: string;
        totalCost: string;
      }>
    >(
      `
      WITH container_rags AS (
        SELECT
          po."vendorId" AS "vendorId",
          SUM(r."weightKg") AS "weightKg",
          SUM(r."allocatedCost") AS "cost"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        JOIN "Rag" r ON r."containerId" = c."id"
        WHERE po."tenantId" = $1
          AND po."vendorId" IS NOT NULL
          ${start ? `AND r."createdAt" >= $2` : ``}
          ${end ? `AND r."createdAt" <= $3` : ``}
        GROUP BY po."vendorId"
      ),
      loose_bales AS (
        SELECT
          b."vendorId" AS "vendorId",
          SUM(b."weightKg") AS "weightKg",
          SUM(b."cost") AS "cost"
        FROM "IncomingBale" b
        WHERE b."tenantId" = $1
          AND b."vendorId" IS NOT NULL
          AND b."containerId" IS NULL
          ${start ? `AND b."createdAt" >= $2` : ``}
          ${end ? `AND b."createdAt" <= $3` : ``}
        GROUP BY b."vendorId"
      ),
      combined AS (
        SELECT * FROM container_rags
        UNION ALL
        SELECT * FROM loose_bales
      )
      SELECT
        v."id" AS "vendorId",
        v."name" AS "vendorName",
        COALESCE(SUM(combined."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(combined."cost"), 0) AS "totalCost"
      FROM "Vendor" v
      LEFT JOIN combined ON combined."vendorId" = v."id"
      WHERE v."tenantId" = $1
      GROUP BY v."id", v."name"
      ORDER BY v."name" ASC
      `,
      tenantId,
      start ?? new Date(0),
      end ?? new Date(),
    );

    return rows.map((r) => {
      const weight = new Decimal(r.totalWeightKg as any);
      const cost = new Decimal(r.totalCost as any);
      const avg = weight.equals(new Decimal(0)) ? new Decimal(0) : cost.div(weight);
      return {
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        totalWeightKg: weight.toString(),
        totalCost: cost.toString(),
        avgCostPerKg: avg.toString(),
      };
    });
  }
}


