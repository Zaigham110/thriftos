import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class SortingReportsService {
  constructor(private prisma: PrismaService) {}

  async categoryYieldReport(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    // Build dynamic query with proper parameter positions
    const conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\''];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (start) {
      conditions.push(`s."startTime" >= $${paramIndex}`);
      params.push(start);
      paramIndex++;
    }
    if (end) {
      conditions.push(`s."startTime" <= $${paramIndex}`);
      params.push(end);
      paramIndex++;
    }
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
      Array<{
        categoryId: string;
        inputWeightKg: string;
        outputWeightKg: string;
        wasteWeightKg: string;
      }>
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

  async sortingEfficiency(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; workerId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const groups = await this.prisma.sortSession.groupBy({
      by: ['workerId'],
      where: {
        tenantId,
        status: 'CLOSED',
        ...(start || end
          ? {
              startTime: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
        ...(filters.workerId ? { workerId: filters.workerId } : {}),
      },
      _count: { _all: true },
      _sum: {
        totalInputWeight: true,
        totalOutputWeight: true,
        wasteWeight: true,
      },
    });

    return groups.map((g) => {
      const input = g._sum.totalInputWeight ?? new Decimal(0);
      const output = g._sum.totalOutputWeight ?? new Decimal(0);
      const waste = g._sum.wasteWeight ?? new Decimal(0);
      const avgYield = input.equals(new Decimal(0)) ? new Decimal(0) : output.div(input).mul(100);
      const avgWastePct = input.equals(new Decimal(0)) ? new Decimal(0) : waste.div(input).mul(100);
      return {
        workerId: g.workerId,
        sessionsHandled: g._count._all,
        inputWeightKg: input.toString(),
        outputWeightKg: output.toString(),
        wasteWeightKg: waste.toString(),
        avgYieldPct: avgYield.toFixed(2),
        avgWastePct: avgWastePct.toFixed(2),
      };
    });
  }
}


