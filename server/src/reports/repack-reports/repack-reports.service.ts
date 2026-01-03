import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';
import { ReportsConsistencyService } from '../common/reports-consistency.service';

@Injectable()
export class RepackReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consistency: ReportsConsistencyService,
  ) {}

  async repackEfficiency(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    // Build dynamic query with proper parameter positions
    const conditions: string[] = ['u."tenantId" = $1', 'rs."status" = \'CLOSED\''];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (start) {
      conditions.push(`rs."startTime" >= $${paramIndex}`);
      params.push(start);
      paramIndex++;
    }
    if (end) {
      conditions.push(`rs."startTime" <= $${paramIndex}`);
      params.push(end);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(`u."categoryId" = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.gradeId) {
      conditions.push(`u."gradeId" = $${paramIndex}`);
      params.push(filters.gradeId);
      paramIndex++;
    }
    if (filters.workerId) {
      conditions.push(`rs."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        day: string;
        gradeInputWeightKg: string;
        repackOutputWeightKg: string;
        unitsProduced: number;
        avgUnitWeightKg: string;
      }>
    >(
      `
      WITH units AS (
        SELECT
          date_trunc('day', COALESCE(rs."endTime", rs."startTime")) AS "day",
          SUM(u."weightKg") AS "repackOutputWeightKg",
          COUNT(*)::int AS "unitsProduced",
          AVG(u."weightKg") AS "avgUnitWeightKg"
        FROM "RepackUnit" u
        JOIN "RepackSession" rs ON rs."id" = u."repackSessionId"
        WHERE ${whereClause}
        GROUP BY 1
      ),
      inputs AS (
        SELECT
          date_trunc('day', COALESCE(rs."endTime", rs."startTime")) AS "day",
          SUM(ri."weightKg") AS "gradeInputWeightKg"
        FROM "RepackItem" ri
        JOIN "RepackUnit" u ON u."id" = ri."repackUnitId"
        JOIN "RepackSession" rs ON rs."id" = u."repackSessionId"
        WHERE ${whereClause}
          AND ri."sourceType" = 'GRADE_OUTPUT'
        GROUP BY 1
      )
      SELECT
        COALESCE(units."day", inputs."day")::text AS "day",
        COALESCE(inputs."gradeInputWeightKg", 0) AS "gradeInputWeightKg",
        COALESCE(units."repackOutputWeightKg", 0) AS "repackOutputWeightKg",
        COALESCE(units."unitsProduced", 0) AS "unitsProduced",
        COALESCE(units."avgUnitWeightKg", 0) AS "avgUnitWeightKg"
      FROM units
      FULL OUTER JOIN inputs ON inputs."day" = units."day"
      ORDER BY "day" ASC
      `,
      ...params,
    );

    return rows.map((r) => ({
      day: r.day,
      gradeInputWeightKg: new Decimal(r.gradeInputWeightKg as any).toNumber(),
      repackOutputWeightKg: new Decimal(r.repackOutputWeightKg as any).toNumber(),
      unitsProduced: r.unitsProduced,
      avgUnitWeightKg: new Decimal(r.avgUnitWeightKg as any).toNumber(),
    }));
  }

  async repackSummary(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    const conditions: string[] = ['u."tenantId" = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (start) {
      conditions.push(`u."createdAt" >= $${idx}`);
      params.push(start);
      idx++;
    }
    if (end) {
      conditions.push(`u."createdAt" <= $${idx}`);
      params.push(end);
      idx++;
    }
    if (filters.categoryId) {
      conditions.push(`u."categoryId" = $${idx}`);
      params.push(filters.categoryId);
      idx++;
    }
    if (filters.gradeId) {
      conditions.push(`u."gradeId" = $${idx}`);
      params.push(filters.gradeId);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ status: string; units: number; totalWeightKg: number; totalPcs: number; totalCost: number }>
    >(
      `
      SELECT
        u."status"::text AS status,
        COUNT(*)::int AS units,
        COALESCE(SUM(u."weightKg"), 0)::float8 AS "totalWeightKg",
        COALESCE(SUM(u."pcsCount"), 0)::int AS "totalPcs",
        COALESCE(SUM(u."totalCost"), 0)::float8 AS "totalCost"
      FROM "RepackUnit" u
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      ...params,
    );

    const data = rows.map((r) => ({
      status: r.status,
      units: Number(r.units ?? 0),
      totalWeightKg: Number(r.totalWeightKg ?? 0),
      totalPcs: Number(r.totalPcs ?? 0),
      totalCost: Number(r.totalCost ?? 0),
    }));

    return {
      data,
      summary: {
        totalUnits: data.reduce((sum, r) => sum + (r.units || 0), 0),
        totalWeightKg: data.reduce((sum, r) => sum + (r.totalWeightKg || 0), 0),
        totalPcs: data.reduce((sum, r) => sum + (r.totalPcs || 0), 0),
        totalCost: data.reduce((sum, r) => sum + (r.totalCost || 0), 0),
      },
    };
  }

  async skuProductionSummary(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string; page?: number; limit?: number },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.gradeId ? { gradeId: filters.gradeId } : {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      repackSession: {
        status: 'CLOSED',
        ...(filters.workerId ? { workerId: filters.workerId } : {}),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.repackUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
          repackSession: { select: { id: true, workerId: true, supervisorId: true, status: true, startTime: true, endTime: true } },
        },
      }),
      this.prisma.repackUnit.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      data: data.map((u) => ({
        unitId: u.id,
        unitCode: u.unitCode,
        unitType: u.unitType,
        categoryId: u.categoryId,
        categoryName: u.category?.name ?? null,
        gradeId: u.gradeId,
        gradeName: u.grade?.name ?? null,
        weightKg: u.weightKg.toNumber(),
        pcsCount: u.pcsCount,
        totalCost: u.totalCost.toNumber(),
        createdAt: u.createdAt,
      })),
    };
  }
}


