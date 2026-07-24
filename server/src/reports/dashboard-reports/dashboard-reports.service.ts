import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../common/report-utils';

type TrendPoint = { bucket: string; value: string };
type YieldWasteTrendPoint = { bucket: string; yieldPct: string; wastePct: string };

export interface OperatorLeaderboardRow {
  workerId: string;
  workerName: string;
  sessionCount: number;
  totalInputKg: string;
  totalOutputKg: string;
  avgKgPerHour: string;
}

export interface ContainerAuditRow {
  id: string;
  containerNumber: string;
  shippingLine: string | null;
  status: string;
  netWeightKg: string;
  scaleNetKg: string | null;
  varianceKg: string;
  variancePct: string;
  varianceAlertStatus: string;
  forwarder: string | null;
  billOfLadingNumber: string | null;
}

export interface CustomerRiskRow {
  id: string;
  name: string;
  companyName: string | null;
  creditLimit: string;
  creditStatus: string;
  paymentTerms: string;
  unpaidBalance: string;
}

export interface InventoryGradeRow {
  gradeName: string;
  categoryName: string;
  totalWeightKg: string;
  unitCount: number;
}

export interface MaterialBalanceFlow {
  intakeKg: string;
  sortedKg: string;
  gradedKg: string;
  repackedKg: string;
  shippedKg: string;
}

function toIsoDate(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return utc.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class DashboardReportsService {
  constructor(private prisma: PrismaService) {}

  private resolveEffectiveRange(filters: { startDate?: string; endDate?: string }) {
    const { start, end } = parseDateRange(filters);

    const effectiveEnd = end ?? startOfTodayUtc();
    const effectiveStart = start ?? addDays(effectiveEnd, -29);

    const msDay = 1000 * 60 * 60 * 24;
    const days = Math.max(1, Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / msDay) + 1);

    return {
      start: effectiveStart,
      end: effectiveEnd,
      days,
      startDate: toIsoDate(effectiveStart),
      endDate: toIsoDate(effectiveEnd),
    };
  }

  private resolvePreviousRange(current: { start: Date; days: number }) {
    const prevEnd = addDays(current.start, -1);
    const prevStart = addDays(prevEnd, -(current.days - 1));
    return {
      start: prevStart,
      end: prevEnd,
      startDate: toIsoDate(prevStart),
      endDate: toIsoDate(prevEnd),
    };
  }

  private deltaPctLabel(prev: Decimal, current: Decimal): string | undefined {
    if (!prev || prev.equals(new Decimal(0))) return undefined;
    const pct = current.sub(prev).div(prev).mul(100);
    const n = pct.toNumber();
    if (!Number.isFinite(n)) return undefined;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
  }

  private deltaAbsLabel(prev: Decimal, current: Decimal, suffix: string): string | undefined {
    if (!prev || !current) return undefined;
    const d = current.sub(prev);
    const n = d.toNumber();
    if (!Number.isFinite(n)) return undefined;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}${suffix}`;
  }

  private async procurementTotals(tenantId: string, start: Date, end: Date) {
    const agg = await this.prisma.purchaseOrder.aggregate({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalCost: true },
    });

    return agg._sum.totalCost ?? new Decimal(0);
  }

  private async salesTotals(tenantId: string, start: Date, end: Date) {
    const agg = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    return agg._sum.totalAmount ?? new Decimal(0);
  }

  private async materialFlow(tenantId: string, start: Date, end: Date): Promise<MaterialBalanceFlow> {
    const [containerAgg, sortingAgg, repackAgg, salesAgg] = await Promise.all([
      this.prisma.container.aggregate({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        _sum: { netWeight: true, weighbridgeNetWeight: true },
      }),
      this.prisma.sortSession.aggregate({
        where: { tenantId, status: 'CLOSED', startTime: { gte: start, lte: end } },
        _sum: { totalInputWeight: true, totalOutputWeight: true },
      }),
      this.prisma.repackUnit.aggregate({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        _sum: { weightKg: true },
      }),
      this.prisma.saleLine.aggregate({
        where: { sale: { tenantId, createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true },
      }),
    ]);

    const intake = containerAgg._sum.weighbridgeNetWeight ?? containerAgg._sum.netWeight ?? new Decimal(0);
    const sorted = sortingAgg._sum.totalInputWeight ?? new Decimal(0);
    const graded = sortingAgg._sum.totalOutputWeight ?? new Decimal(0);
    const repacked = repackAgg._sum.weightKg ?? new Decimal(0);
    const shipped = salesAgg._sum.quantity ?? new Decimal(0);

    return {
      intakeKg: intake.toFixed(2),
      sortedKg: sorted.toFixed(2),
      gradedKg: graded.toFixed(2),
      repackedKg: repacked.toFixed(2),
      shippedKg: shipped.toFixed(2),
    };
  }

  private async procurementCostTrend(tenantId: string, start: Date, end: Date): Promise<TrendPoint[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ bucket: string; value: string }>>(
      `
      SELECT
        to_char(date_trunc('day', po."createdAt"), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(po."totalCost"), 0) AS value
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = $1
        AND po."createdAt" >= $2
        AND po."createdAt" <= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      tenantId,
      start,
      end,
    );

    return rows;
  }

  private async salesRevenueTrend(tenantId: string, start: Date, end: Date): Promise<TrendPoint[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ bucket: string; value: string }>>(
      `
      SELECT
        to_char(date_trunc('day', s."createdAt"), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(s."totalAmount"), 0) AS value
      FROM "Sale" s
      WHERE s."tenantId" = $1
        AND s."createdAt" >= $2
        AND s."createdAt" <= $3
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      tenantId,
      start,
      end,
    );

    return rows;
  }

  private async sortingTotals(
    tenantId: string,
    start: Date,
    end: Date,
    filters: { categoryId?: string; workerId?: string },
  ) {
    const conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\'', 's."startTime" >= $2', 's."startTime" <= $3'];
    const params: any[] = [tenantId, start, end];
    let paramIndex = 4;

    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }

    if (filters.categoryId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM "SortCategoryBucket" b WHERE b."sortSessionId" = s."id" AND b."categoryId" = $${paramIndex})`,
      );
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ inputWeightKg: string; outputWeightKg: string; wasteWeightKg: string }>
    >(
      `
      SELECT
        COALESCE(SUM(s."totalInputWeight"), 0) AS "inputWeightKg",
        COALESCE(SUM(s."totalOutputWeight"), 0) AS "outputWeightKg",
        COALESCE(SUM(s."wasteWeight"), 0) AS "wasteWeightKg"
      FROM "SortSession" s
      WHERE ${whereClause}
      `,
      ...params,
    );

    const input = new Decimal(rows?.[0]?.inputWeightKg as any || 0);
    const output = new Decimal(rows?.[0]?.outputWeightKg as any || 0);
    const waste = new Decimal(rows?.[0]?.wasteWeightKg as any || 0);

    const yieldPct = input.equals(new Decimal(0)) ? new Decimal(0) : output.div(input).mul(100);
    const wastePct = input.equals(new Decimal(0)) ? new Decimal(0) : waste.div(input).mul(100);

    return { input, output, waste, yieldPct, wastePct };
  }

  private async sortingVolumeTrend(
    tenantId: string,
    start: Date,
    end: Date,
    filters: { categoryId?: string; workerId?: string },
  ): Promise<TrendPoint[]> {
    const conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\'', 's."startTime" >= $2', 's."startTime" <= $3'];
    const params: any[] = [tenantId, start, end];
    let paramIndex = 4;

    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM "SortCategoryBucket" b WHERE b."sortSessionId" = s."id" AND b."categoryId" = $${paramIndex})`,
      );
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<Array<{ bucket: string; value: string }>>(
      `
      SELECT
        to_char(date_trunc('day', s."startTime"), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(s."totalInputWeight"), 0) AS value
      FROM "SortSession" s
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      ...params,
    );

    return rows;
  }

  private async sortingYieldWasteTrend(
    tenantId: string,
    start: Date,
    end: Date,
    filters: { categoryId?: string; workerId?: string },
  ): Promise<YieldWasteTrendPoint[]> {
    const conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\'', 's."startTime" >= $2', 's."startTime" <= $3'];
    const params: any[] = [tenantId, start, end];
    let paramIndex = 4;

    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM "SortCategoryBucket" b WHERE b."sortSessionId" = s."id" AND b."categoryId" = $${paramIndex})`,
      );
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ bucket: string; inputWeightKg: string; outputWeightKg: string; wasteWeightKg: string }>
    >(
      `
      SELECT
        to_char(date_trunc('day', s."startTime"), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(s."totalInputWeight"), 0) AS "inputWeightKg",
        COALESCE(SUM(s."totalOutputWeight"), 0) AS "outputWeightKg",
        COALESCE(SUM(s."wasteWeight"), 0) AS "wasteWeightKg"
      FROM "SortSession" s
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      ...params,
    );

    return rows.map((r) => {
      const input = new Decimal(r.inputWeightKg as any || 0);
      const output = new Decimal(r.outputWeightKg as any || 0);
      const waste = new Decimal(r.wasteWeightKg as any || 0);
      const yieldPct = input.equals(new Decimal(0)) ? new Decimal(0) : output.div(input).mul(100);
      const wastePct = input.equals(new Decimal(0)) ? new Decimal(0) : waste.div(input).mul(100);
      return { bucket: r.bucket, yieldPct: yieldPct.toFixed(2), wastePct: wastePct.toFixed(2) };
    });
  }

  private async categoryYield(
    tenantId: string,
    start: Date,
    end: Date,
    filters: { categoryId?: string; workerId?: string },
  ) {
    const conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\'', 's."startTime" >= $2', 's."startTime" <= $3'];
    const params: any[] = [tenantId, start, end];
    let paramIndex = 4;

    if (filters.categoryId) {
      conditions.push(`b."categoryId" = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ categoryId: string; inputWeightKg: string; outputWeightKg: string; wasteWeightKg: string }>
    >(
      `
      WITH buckets AS (
        SELECT
          b."categoryId" AS "categoryId",
          b."outputWeightKg" AS "bucketOutput",
          s."totalInputWeight" AS "input",
          s."wasteWeight" AS "waste",
          s."totalOutputWeight" AS "totalOutput"
        FROM "SortCategoryBucket" b
        JOIN "SortSession" s ON s."id" = b."sortSessionId"
        WHERE ${whereClause}
      )
      SELECT
        "categoryId",
        COALESCE(SUM("bucketOutput"), 0) AS "outputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "input" * ("bucketOutput" / "totalOutput") END), 0) AS "inputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "waste" * ("bucketOutput" / "totalOutput") END), 0) AS "wasteWeightKg"
      FROM buckets
      GROUP BY "categoryId"
      ORDER BY "categoryId" ASC
      `,
      ...params,
    );

    return rows.map((r) => {
      const input = new Decimal(r.inputWeightKg as any || 0);
      const output = new Decimal(r.outputWeightKg as any || 0);
      const waste = new Decimal(r.wasteWeightKg as any || 0);
      const yieldPct = input.equals(new Decimal(0)) ? new Decimal(0) : output.div(input).mul(100);
      return {
        categoryId: r.categoryId,
        inputWeightKg: input.toString(),
        outputWeightKg: output.toString(),
        wasteWeightKg: waste.toString(),
        yieldPct: yieldPct.toFixed(2),
      };
    });
  }

  private async operatorLeaderboard(tenantId: string, start: Date, end: Date): Promise<OperatorLeaderboardRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        workerId: string;
        workerName: string;
        sessionCount: string | number;
        totalInputKg: string;
        totalOutputKg: string;
        totalHours: string;
      }>
    >(
      `
      SELECT
        s."workerId" AS "workerId",
        u."name" AS "workerName",
        COUNT(s."id") AS "sessionCount",
        COALESCE(SUM(s."totalInputWeight"), 0) AS "totalInputKg",
        COALESCE(SUM(s."totalOutputWeight"), 0) AS "totalOutputKg",
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(s."endTime", NOW()) - s."startTime")) / 3600.0), 0) AS "totalHours"
      FROM "SortSession" s
      JOIN "User" u ON u."id" = s."workerId"
      WHERE s."tenantId" = $1
        AND s."status" = 'CLOSED'
        AND s."startTime" >= $2
        AND s."startTime" <= $3
      GROUP BY s."workerId", u."name"
      ORDER BY SUM(s."totalInputWeight") DESC
      LIMIT 8
      `,
      tenantId,
      start,
      end,
    );

    return rows.map((r) => {
      const input = parseFloat(r.totalInputKg || '0');
      const hours = parseFloat(r.totalHours || '0');
      const speed = hours > 0 ? (input / hours).toFixed(1) : '0.0';
      return {
        workerId: r.workerId,
        workerName: r.workerName || 'Unknown Operator',
        sessionCount: Number(r.sessionCount || 0),
        totalInputKg: input.toFixed(2),
        totalOutputKg: parseFloat(r.totalOutputKg || '0').toFixed(2),
        avgKgPerHour: speed,
      };
    });
  }

  private async containerAuditsList(tenantId: string): Promise<ContainerAuditRow[]> {
    const containers = await this.prisma.container.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    return containers.map((c) => ({
      id: c.id,
      containerNumber: c.containerNumber,
      shippingLine: c.shippingLine,
      status: c.status,
      netWeightKg: c.netWeight.toString(),
      scaleNetKg: c.weighbridgeNetWeight ? c.weighbridgeNetWeight.toString() : null,
      varianceKg: c.weightVarianceKg ? c.weightVarianceKg.toString() : '0.00',
      variancePct: c.weightVariancePct ? c.weightVariancePct.toString() : '0.0',
      varianceAlertStatus: c.varianceAlertStatus || 'OK',
      forwarder: c.forwarder,
      billOfLadingNumber: c.billOfLadingNumber,
    }));
  }

  private async customerRiskList(tenantId: string): Promise<CustomerRiskRow[]> {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });

    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      creditLimit: c.creditLimit.toString(),
      creditStatus: c.creditStatus,
      paymentTerms: c.paymentTerms,
      unpaidBalance: '0.00',
    }));
  }

  private async inventoryGradeBreakdown(tenantId: string): Promise<InventoryGradeRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        gradeName: string;
        categoryName: string;
        totalWeightKg: string;
        unitCount: string | number;
      }>
    >(
      `
      SELECT
        COALESCE(g."name", 'Standard Grade') AS "gradeName",
        COALESCE(c."name", 'General Raw') AS "categoryName",
        COALESCE(SUM(i."weightKg"), 0) AS "totalWeightKg",
        COUNT(i."id") AS "unitCount"
      FROM "InventoryItem" i
      LEFT JOIN "Grade" g ON g."id" = i."gradeId"
      LEFT JOIN "Category" c ON c."id" = i."categoryId"
      WHERE i."tenantId" = $1
        AND i."status" = 'AVAILABLE'
      GROUP BY g."name", c."name"
      ORDER BY SUM(i."weightKg") DESC
      LIMIT 8
      `,
      tenantId,
    );

    return rows.map((r) => ({
      gradeName: r.gradeName,
      categoryName: r.categoryName,
      totalWeightKg: parseFloat(r.totalWeightKg || '0').toFixed(2),
      unitCount: Number(r.unitCount || 0),
    }));
  }

  private async executiveRiskAndInventoryOverview(tenantId: string) {
    const [
      inTransitContainersCount,
      weighbridgeVarianceAlertsCount,
      blockedCustomersCount,
      availableInventoryAgg,
    ] = await Promise.all([
      this.prisma.container.count({
        where: { tenantId, status: 'IN_TRANSIT' },
      }),
      this.prisma.container.count({
        where: {
          tenantId,
          varianceAlertStatus: { in: ['VARIANCE_WARNING', 'CRITICAL_DISCREPANCY'] },
        },
      }),
      this.prisma.customer.count({
        where: {
          tenantId,
          creditStatus: { in: ['ON_HOLD', 'CREDIT_BLOCKED'] },
        },
      }),
      this.prisma.inventoryItem.aggregate({
        where: { tenantId, status: 'AVAILABLE' },
        _sum: { weightKg: true },
        _count: { id: true },
      }),
    ]);

    return {
      inTransitContainersCount,
      weighbridgeVarianceAlertsCount,
      blockedCustomersCount,
      availableInventoryKg: (availableInventoryAgg._sum.weightKg ?? new Decimal(0)).toString(),
      availableInventoryUnitsCount: availableInventoryAgg._count.id ?? 0,
    };
  }

  async summary(tenantId: string, filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string }) {
    const range = this.resolveEffectiveRange(filters);
    const prev = this.resolvePreviousRange(range);

    const [
      procurementNow,
      procurementPrev,
      salesNow,
      salesPrev,
      sortingNow,
      sortingPrev,
      materialBalanceFlow,
      procurementTrend,
      salesTrend,
      volumeTrend,
      yieldWasteTrend,
      categoryYield,
      executiveOverview,
      operatorLeaderboard,
      containerAudits,
      customerRisks,
      inventoryGrades,
    ] = await Promise.all([
      this.procurementTotals(tenantId, range.start, range.end),
      this.procurementTotals(tenantId, prev.start, prev.end),
      this.salesTotals(tenantId, range.start, range.end),
      this.salesTotals(tenantId, prev.start, prev.end),
      this.sortingTotals(tenantId, range.start, range.end, filters),
      this.sortingTotals(tenantId, prev.start, prev.end, filters),
      this.materialFlow(tenantId, range.start, range.end),
      this.procurementCostTrend(tenantId, range.start, range.end),
      this.salesRevenueTrend(tenantId, range.start, range.end),
      this.sortingVolumeTrend(tenantId, range.start, range.end, filters),
      this.sortingYieldWasteTrend(tenantId, range.start, range.end, filters),
      this.categoryYield(tenantId, range.start, range.end, filters),
      this.executiveRiskAndInventoryOverview(tenantId),
      this.operatorLeaderboard(tenantId, range.start, range.end),
      this.containerAuditsList(tenantId),
      this.customerRiskList(tenantId),
      this.inventoryGradeBreakdown(tenantId),
    ]);

    const netMarginNow = salesNow.sub(procurementNow);
    const netMarginPrev = salesPrev.sub(procurementPrev);

    const sortedWeightNow = sortingNow.input;
    const sortedWeightPrev = sortingPrev.input;

    const yieldNow = sortingNow.yieldPct;
    const yieldPrev = sortingPrev.yieldPct;

    const wasteNow = sortingNow.wastePct;
    const wastePrev = sortingPrev.wastePct;

    const topCategories = categoryYield
      .slice()
      .sort((a, b) => Number(b.outputWeightKg) - Number(a.outputWeightKg))
      .slice(0, 8);

    return {
      range: { startDate: range.startDate, endDate: range.endDate },
      previousRange: { startDate: prev.startDate, endDate: prev.endDate },
      kpis: {
        salesRevenue: {
          value: salesNow.toString(),
          change: this.deltaPctLabel(salesPrev, salesNow),
          sparkline: salesTrend.map((p) => Number(p.value)),
        },
        procurementCost: {
          value: procurementNow.toString(),
          change: this.deltaPctLabel(procurementPrev, procurementNow),
          sparkline: procurementTrend.map((p) => Number(p.value)),
        },
        netOperationalMargin: {
          value: netMarginNow.toString(),
          change: this.deltaPctLabel(netMarginPrev, netMarginNow),
          sparkline: [],
        },
        sortedWeightKg: {
          value: sortedWeightNow.toString(),
          change: this.deltaPctLabel(sortedWeightPrev, sortedWeightNow),
          sparkline: volumeTrend.map((p) => Number(p.value)),
        },
        yieldPct: {
          value: yieldNow.toFixed(2),
          change: this.deltaAbsLabel(yieldPrev, yieldNow, '%'),
          sparkline: yieldWasteTrend.map((p) => Number(p.yieldPct)),
        },
        wastePct: {
          value: wasteNow.toFixed(2),
          change: this.deltaAbsLabel(wastePrev, wasteNow, '%'),
          sparkline: yieldWasteTrend.map((p) => Number(p.wastePct)),
        },
      },
      materialBalanceFlow,
      executiveOverview,
      operatorLeaderboard,
      containerAudits,
      customerRisks,
      inventoryGrades,
      analytics: {
        salesRevenueTrend: salesTrend,
        procurementCostTrend: procurementTrend,
        sortedVolumeTrend: volumeTrend,
        categoryYield: topCategories,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
