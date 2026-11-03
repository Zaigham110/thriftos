import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';
import { ReportsConsistencyService } from '../common/reports-consistency.service';

@Injectable()
export class ProcurementReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consistency: ReportsConsistencyService,
  ) {}

  async containerCostBreakdown(tenantId: string, containerId: string) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const container = await this.prisma.container.findFirst({
      where: { id: containerId, tenantId },
      include: {
        containerCharges: true,
        vendor: { select: { id: true, name: true } },
      },
    });
    if (!container) throw new NotFoundException('Container not found');

    const sumBy = (types: string[]) =>
      container.containerCharges
        .filter((c) => types.includes(c.chargeType))
        .reduce((acc, c) => acc.add(c.amount), new Decimal(0));

    const charges = container.containerCharges.reduce((acc, c) => acc.add(c.amount), new Decimal(0));
    const totalCost = container.landedCostPKR;
    const purchaseCost = totalCost.sub(charges);
    const shippingCost = sumBy(['FREIGHT', 'PORT_HANDLING', 'TRANSPORT']);
    const dutiesCost = sumBy(['DUTY', 'TAX', 'CLEARING']);
    const otherCosts = sumBy(['MISC', 'LABOUR', 'CIF']);
    const totalWeightKg = container.netWeight ?? new Decimal(0);
    const costPerKg = container.landedCostPerKg ?? new Decimal(0);

    return {
      containerId: container.id,
      containerCode: container.containerNumber,
      vendorName: container.vendor?.name ?? '—',
      landingDate: (container.clearedAt ?? container.arrivedAt ?? container.releasedAt ?? container.createdAt).toISOString(),
      purchaseCost: purchaseCost.toNumber(),
      shippingCost: shippingCost.toNumber(),
      dutiesCost: dutiesCost.toNumber(),
      otherCosts: otherCosts.toNumber(),
      totalCost: totalCost.toNumber(),
      totalWeightKg: totalWeightKg.toNumber(),
      costPerKg: costPerKg.toNumber(),
    };
  }

  /**
   * Vendor procurement summary:
   * - Container purchases: sum rag weights + rag allocatedCost (represents container cost distributed)
   * - Loose lots: sum lot weight and cost where the lot has no container
   */
  async vendorProcurementSummary(
    tenantId: string,
    filters: { startDate?: string; endDate?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    // Build dynamic query with proper parameter positions
    const ragConditions: string[] = ['c."tenantId" = $1', 'c."vendorId" IS NOT NULL'];
    const looseConditions: string[] = ['b."tenantId" = $1', 'b."vendorId" IS NOT NULL', 'b."containerId" IS NULL'];
    const ragParams: any[] = [tenantId];
    const looseParams: any[] = [tenantId];
    let ragIdx = 2;
    let looseIdx = 2;

    if (start) {
      ragConditions.push(`r."createdAt" >= $${ragIdx}`);
      ragParams.push(start);
      ragIdx++;
      looseConditions.push(`b."createdAt" >= $${looseIdx}`);
      looseParams.push(start);
      looseIdx++;
    }
    if (end) {
      ragConditions.push(`r."createdAt" <= $${ragIdx}`);
      ragParams.push(end);
      ragIdx++;
      looseConditions.push(`b."createdAt" <= $${looseIdx}`);
      looseParams.push(end);
      looseIdx++;
    }

    const ragWhere = ragConditions.join(' AND ');
    const looseWhere = looseConditions.join(' AND ');

    // Raw SQL for performance and correctness across joins.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        vendorId: string;
        vendorName: string;
        totalContainers: number;
        totalWeightKg: string;
        totalCost: string;
      }>
    >(
      `
      WITH container_rags AS (
        SELECT
          c."vendorId" AS "vendorId",
          COUNT(DISTINCT c."id")::int AS "containers",
          SUM(r."weightKg") AS "weightKg",
          SUM(r."allocatedCost") AS "cost"
        FROM "Container" c
        JOIN "Rag" r ON r."containerId" = c."id"
        WHERE ${ragWhere}
        GROUP BY c."vendorId"
      ),
      loose_bales AS (
        SELECT
          b."vendorId" AS "vendorId",
          0::int AS "containers",
          SUM(b."weightKg") AS "weightKg",
          SUM(b."allocatedCost") AS "cost"
        FROM "Rag" b
        WHERE ${looseWhere}
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
        COALESCE(SUM(combined."containers"), 0)::int AS "totalContainers",
        COALESCE(SUM(combined."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(combined."cost"), 0) AS "totalCost"
      FROM "Vendor" v
      LEFT JOIN combined ON combined."vendorId" = v."id"
      WHERE v."tenantId" = $1
      GROUP BY v."id", v."name"
      ORDER BY v."name" ASC
      `,
      ...ragParams, // Note: we use ragParams since both have same params
    );

    return rows.map((r) => {
      const weight = new Decimal(r.totalWeightKg as any);
      const cost = new Decimal(r.totalCost as any);
      const avg = weight.equals(new Decimal(0)) ? new Decimal(0) : cost.div(weight);
      return {
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        totalContainers: Number(r.totalContainers ?? 0),
        totalWeightKg: weight.toNumber(),
        totalCost: cost.toNumber(),
        avgCostPerKg: avg.toNumber(),
      };
    });
  }

  /**
   * Procurement Summary (ERP-grade):
   * - Break down by Purchase Order
   * - Containers purchased: qty, weight, landed cost
   * - Loose lots have no purchase order in v1; old loose-bale purchase orders show their stored total
   * - Validation (fail closed):
   *   - a container PO's totalCost must match its containers' landed cost within 0.01
   *   - PO currency must match tenant currency
   */
  async procurementSummary(tenantId: string, filters: { startDate?: string; endDate?: string }) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const tenantCurrency = tenant?.currency ?? 'USD';

    const poConditions: string[] = ['po."tenantId" = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (start) {
      poConditions.push(`po."createdAt" >= $${idx}`);
      params.push(start);
      idx++;
    }
    if (end) {
      poConditions.push(`po."createdAt" <= $${idx}`);
      params.push(end);
      idx++;
    }

    const poWhere = poConditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        purchaseOrderId: string;
        poNumber: string;
        poType: string;
        status: string;
        currency: string;
        poTotalCost: string;
        createdAt: string;
        vendorId: string | null;
        vendorName: string | null;
        containerCount: number;
        containerWeightKg: string;
        containerCost: string;
        looseBaleCount: number;
        looseBaleWeightKg: string;
        looseBaleCost: string;
      }>
    >(
      `
      WITH po_base AS (
        SELECT
          po."id" AS "purchaseOrderId",
          po."poNumber" AS "poNumber",
          po."poType" AS "poType",
          po."status" AS "status",
          po."currency" AS "currency",
          po."totalCost" AS "poTotalCost",
          po."createdAt" AS "createdAt",
          v."id" AS "vendorId",
          v."name" AS "vendorName"
        FROM "PurchaseOrder" po
        LEFT JOIN "Vendor" v ON v."id" = po."vendorId"
        WHERE ${poWhere}
      ),
      container_stats AS (
        SELECT
          c."purchaseOrderId" AS "purchaseOrderId",
          COUNT(*)::int AS "containerCount",
          COALESCE(SUM(c."netWeight"), 0) AS "containerWeightKg"
        FROM "Container" c
        JOIN po_base p ON p."purchaseOrderId" = c."purchaseOrderId"
        GROUP BY c."purchaseOrderId"
      ),
      container_cost AS (
        SELECT
          c."purchaseOrderId" AS "purchaseOrderId",
          COALESCE(SUM(c."landedCostPKR"), 0) AS "containerCost"
        FROM "Container" c
        JOIN po_base p ON p."purchaseOrderId" = c."purchaseOrderId"
        GROUP BY c."purchaseOrderId"
      )
      SELECT
        p."purchaseOrderId",
        p."poNumber",
        p."poType",
        p."status",
        p."currency",
        p."poTotalCost",
        p."createdAt",
        p."vendorId",
        p."vendorName",
        COALESCE(cs."containerCount", 0)::int AS "containerCount",
        COALESCE(cs."containerWeightKg", 0) AS "containerWeightKg",
        COALESCE(cc."containerCost", 0) AS "containerCost"
      FROM po_base p
      LEFT JOIN container_stats cs ON cs."purchaseOrderId" = p."purchaseOrderId"
      LEFT JOIN container_cost cc ON cc."purchaseOrderId" = p."purchaseOrderId"
      ORDER BY p."createdAt" DESC
      `,
      ...params,
    );

    const data = rows.map((r) => {
      const poTotalCost = new Decimal(r.poTotalCost as any);
      const containerCost = new Decimal(r.containerCost as any);
      // Loose lots are bought without a purchase order in v1. Old loose-bale purchase orders keep
      // their stored total; only container purchase orders are reconciled.
      const isLoosePo = r.poType === 'LOOSE_BALE';
      const looseBaleCost = isLoosePo ? poTotalCost : new Decimal(0);
      const computedCost = containerCost.add(looseBaleCost);
      const delta = poTotalCost.sub(computedCost);

      return {
        purchaseOrderId: r.purchaseOrderId,
        poNumber: r.poNumber,
        poType: r.poType,
        status: r.status,
        currency: r.currency,
        vendorId: r.vendorId,
        vendorName: r.vendorName ?? '—',
        createdAt: new Date(r.createdAt as any).toISOString(),

        containers: {
          count: Number(r.containerCount ?? 0),
          weightKg: new Decimal(r.containerWeightKg as any).toNumber(),
          cost: containerCost.toNumber(),
        },
        looseBales: {
          count: 0,
          weightKg: 0,
          cost: looseBaleCost.toNumber(),
        },

        poTotalCost: poTotalCost.toNumber(),
        computedProcurementCost: computedCost.toNumber(),
        costDelta: delta.toNumber(),
        matchesPoTotal: delta.abs().lte(new Decimal(0.01)),
      };
    });

    const currencyMismatches = data.filter((r) => r.currency !== tenantCurrency);
    if (currencyMismatches.length > 0) {
      throw new ConflictException({
        message: 'Reporting blocked: purchase order currency mismatch with tenant currency.',
        tenantCurrency,
        mismatchedPurchaseOrders: currencyMismatches.map((r) => ({
          purchaseOrderId: r.purchaseOrderId,
          poNumber: r.poNumber,
          poCurrency: r.currency,
        })),
      });
    }

    const poMismatches = data.filter((r) => !r.matchesPoTotal);
    if (poMismatches.length > 0) {
      throw new ConflictException({
        message: 'Reporting blocked: PO totalCost does not reconcile to containers + loose bales.',
        failingPurchaseOrders: poMismatches.map((r) => ({
          purchaseOrderId: r.purchaseOrderId,
          poNumber: r.poNumber,
          poTotalCost: r.poTotalCost,
          computedProcurementCost: r.computedProcurementCost,
          costDelta: r.costDelta,
        })),
      });
    }

    const summary = data.reduce(
      (acc, r) => {
        acc.totalPurchaseOrders += 1;
        acc.totalPoCost += r.poTotalCost;
        acc.totalContainers += r.containers.count;
        acc.totalContainerWeightKg += r.containers.weightKg;
        acc.totalContainerCost += r.containers.cost;
        acc.totalLooseBales += r.looseBales.count;
        acc.totalLooseBaleWeightKg += r.looseBales.weightKg;
        acc.totalLooseBaleCost += r.looseBales.cost;
        acc.totalComputedProcurementCost += r.computedProcurementCost;
        return acc;
      },
      {
        currency: tenantCurrency,
        totalPurchaseOrders: 0,
        totalPoCost: 0,
        totalContainers: 0,
        totalContainerWeightKg: 0,
        totalContainerCost: 0,
        totalLooseBales: 0,
        totalLooseBaleWeightKg: 0,
        totalLooseBaleCost: 0,
        totalComputedProcurementCost: 0,
      },
    );

    const avgCostPerKg =
      summary.totalContainerWeightKg + summary.totalLooseBaleWeightKg > 0
        ? summary.totalComputedProcurementCost / (summary.totalContainerWeightKg + summary.totalLooseBaleWeightKg)
        : 0;

    return {
      data,
      summary: {
        ...summary,
        avgCostPerKg,
      },
    };
  }
}


