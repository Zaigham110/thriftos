import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class GradingReportsService {
  constructor(private prisma: PrismaService) {}

  async gradeDistribution(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        categoryId: string;
        gradeId: string;
        gradeWeightKg: string;
        gradeCost: string;
        gradePct: string;
        costPerKg: string;
      }>
    >(
      `
      WITH base AS (
        SELECT
          co."categoryId" AS "categoryId",
          go."gradeId" AS "gradeId",
          SUM(go."weightKg") AS "gradeWeightKg",
          SUM(go."allocatedCost") AS "gradeCost"
        FROM "GradeOutput" go
        JOIN "GradeBucket" gb ON gb."id" = go."gradeBucketId"
        JOIN "GradeSession" gs ON gs."id" = gb."gradeSessionId"
        JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
        WHERE go."tenantId" = $1
          AND gs."status" = 'CLOSED'
          ${start ? `AND gs."startTime" >= $2` : ``}
          ${end ? `AND gs."startTime" <= $3` : ``}
          ${filters.categoryId ? `AND co."categoryId" = $4` : ``}
          ${filters.gradeId ? `AND go."gradeId" = $5` : ``}
          ${filters.workerId ? `AND gs."workerId" = $6` : ``}
        GROUP BY co."categoryId", go."gradeId"
      ),
      totals AS (
        SELECT "categoryId", SUM("gradeWeightKg") AS "totalWeightKg"
        FROM base
        GROUP BY "categoryId"
      )
      SELECT
        base."categoryId",
        base."gradeId",
        base."gradeWeightKg",
        base."gradeCost",
        CASE WHEN totals."totalWeightKg" = 0 THEN 0 ELSE (base."gradeWeightKg" / totals."totalWeightKg") END AS "gradePct",
        CASE WHEN base."gradeWeightKg" = 0 THEN 0 ELSE (base."gradeCost" / base."gradeWeightKg") END AS "costPerKg"
      FROM base
      JOIN totals ON totals."categoryId" = base."categoryId"
      ORDER BY base."categoryId" ASC, base."gradeId" ASC
      `,
      tenantId,
      start ?? new Date(0),
      end ?? new Date(),
      filters.categoryId ?? null,
      filters.gradeId ?? null,
      filters.workerId ?? null,
    );

    return rows.map((r) => ({
      categoryId: r.categoryId,
      gradeId: r.gradeId,
      gradeWeightKg: new Decimal(r.gradeWeightKg as any).toString(),
      gradePct: new Decimal(r.gradePct as any).mul(100).toFixed(2),
      gradeCost: new Decimal(r.gradeCost as any).toString(),
      costPerKg: new Decimal(r.costPerKg as any).toString(),
    }));
  }

  async gradingLoss(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        categoryId: string;
        inputWeightKg: string;
        wasteWeightKg: string;
        wasteCost: string;
      }>
    >(
      `
      WITH session_out AS (
        SELECT
          co."categoryId" AS "categoryId",
          gs."id" AS "gradeSessionId",
          co."weightKg" AS "inputWeightKg",
          co."allocatedCost" AS "inputCost",
          COALESCE(SUM(go."weightKg"), 0) AS "outputWeightKg",
          COALESCE(SUM(go."allocatedCost"), 0) AS "outputCost"
        FROM "GradeSession" gs
        JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
        LEFT JOIN "GradeBucket" gb ON gb."gradeSessionId" = gs."id"
        LEFT JOIN "GradeOutput" go ON go."gradeBucketId" = gb."id"
        WHERE gs."tenantId" = $1
          AND gs."status" = 'CLOSED'
          ${start ? `AND gs."startTime" >= $2` : ``}
          ${end ? `AND gs."startTime" <= $3` : ``}
          ${filters.categoryId ? `AND co."categoryId" = $4` : ``}
          ${filters.workerId ? `AND gs."workerId" = $5` : ``}
        GROUP BY co."categoryId", gs."id", co."weightKg", co."allocatedCost"
      )
      SELECT
        "categoryId",
        COALESCE(SUM("inputWeightKg"), 0) AS "inputWeightKg",
        COALESCE(SUM(("inputWeightKg" - "outputWeightKg")), 0) AS "wasteWeightKg",
        COALESCE(SUM(("inputCost" - "outputCost")), 0) AS "wasteCost"
      FROM session_out
      GROUP BY "categoryId"
      ORDER BY "categoryId" ASC
      `,
      tenantId,
      start ?? new Date(0),
      end ?? new Date(),
      filters.categoryId ?? null,
      filters.workerId ?? null,
    );

    return rows.map((r) => {
      const input = new Decimal(r.inputWeightKg as any);
      const waste = new Decimal(r.wasteWeightKg as any);
      const pct = input.equals(new Decimal(0)) ? new Decimal(0) : waste.div(input).mul(100);
      return {
        categoryId: r.categoryId,
        inputWeightKg: input.toString(),
        wasteWeightKg: waste.toString(),
        wastePct: pct.toFixed(2),
        wasteCost: new Decimal(r.wasteCost as any).toString(),
      };
    });
  }
}


