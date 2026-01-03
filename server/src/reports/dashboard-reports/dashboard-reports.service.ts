import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../common/report-utils';

type TrendPoint = { bucket: string; value: string };
type YieldWasteTrendPoint = { bucket: string; yieldPct: string; wastePct: string };

function toIsoDate(d: Date): string {
  // Ensure YYYY-MM-DD in UTC
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

  private async sortingTotals(
    tenantId: string,
    start: Date,
    end: Date,
    filters: { categoryId?: string; workerId?: string },
  ) {
    // If category filter is applied, restrict to sessions with activity in that category.
    // Worker filter applies directly to sessions.
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

    const input = new Decimal(rows?.[0]?.inputWeightKg as any);
    const output = new Decimal(rows?.[0]?.outputWeightKg as any);
    const waste = new Decimal(rows?.[0]?.wasteWeightKg as any);

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
      const input = new Decimal(r.inputWeightKg as any);
      const output = new Decimal(r.outputWeightKg as any);
      const waste = new Decimal(r.wasteWeightKg as any);
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
    // Mirrors SortingReportsService.categoryYieldReport logic but constrained to the summary range.
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
      const input = new Decimal(r.inputWeightKg as any);
      const output = new Decimal(r.outputWeightKg as any);
      const waste = new Decimal(r.wasteWeightKg as any);
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

  async summary(tenantId: string, filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string }) {
    const range = this.resolveEffectiveRange(filters);
    const prev = this.resolvePreviousRange(range);

    const [
      procurementNow,
      procurementPrev,
      sortingNow,
      sortingPrev,
      procurementTrend,
      volumeTrend,
      yieldWasteTrend,
      categoryYield,
    ] = await Promise.all([
      this.procurementTotals(tenantId, range.start, range.end),
      this.procurementTotals(tenantId, prev.start, prev.end),
      this.sortingTotals(tenantId, range.start, range.end, filters),
      this.sortingTotals(tenantId, prev.start, prev.end, filters),
      this.procurementCostTrend(tenantId, range.start, range.end),
      this.sortingVolumeTrend(tenantId, range.start, range.end, filters),
      this.sortingYieldWasteTrend(tenantId, range.start, range.end, filters),
      this.categoryYield(tenantId, range.start, range.end, filters),
    ]);

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
        procurementCost: {
          value: procurementNow.toString(),
          change: this.deltaPctLabel(procurementPrev, procurementNow),
          sparkline: procurementTrend.map((p) => Number(p.value)),
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
      analytics: {
        sortedVolumeTrend: volumeTrend,
        categoryYield: topCategories,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
