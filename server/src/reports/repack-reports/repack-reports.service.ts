import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class RepackReportsService {
  constructor(private prisma: PrismaService) {}

  async repackEfficiency(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

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
        WHERE u."tenantId" = $1
          AND rs."status" = 'CLOSED'
          ${start ? `AND rs."startTime" >= $2` : ``}
          ${end ? `AND rs."startTime" <= $3` : ``}
          ${filters.categoryId ? `AND u."categoryId" = $4` : ``}
          ${filters.gradeId ? `AND u."gradeId" = $5` : ``}
          ${filters.workerId ? `AND rs."workerId" = $6` : ``}
        GROUP BY 1
      ),
      inputs AS (
        SELECT
          date_trunc('day', COALESCE(rs."endTime", rs."startTime")) AS "day",
          SUM(ri."weightKg") AS "gradeInputWeightKg"
        FROM "RepackItem" ri
        JOIN "RepackUnit" u ON u."id" = ri."repackUnitId"
        JOIN "RepackSession" rs ON rs."id" = u."repackSessionId"
        WHERE u."tenantId" = $1
          AND rs."status" = 'CLOSED'
          AND ri."sourceType" = 'GRADE_OUTPUT'
          ${start ? `AND rs."startTime" >= $2` : ``}
          ${end ? `AND rs."startTime" <= $3` : ``}
          ${filters.categoryId ? `AND u."categoryId" = $4` : ``}
          ${filters.gradeId ? `AND u."gradeId" = $5` : ``}
          ${filters.workerId ? `AND rs."workerId" = $6` : ``}
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
      tenantId,
      start ?? new Date(0),
      end ?? new Date(),
      filters.categoryId ?? null,
      filters.gradeId ?? null,
      filters.workerId ?? null,
    );

    return rows.map((r) => ({
      day: r.day,
      gradeInputWeightKg: new Decimal(r.gradeInputWeightKg as any).toString(),
      repackOutputWeightKg: new Decimal(r.repackOutputWeightKg as any).toString(),
      unitsProduced: r.unitsProduced,
      avgUnitWeightKg: new Decimal(r.avgUnitWeightKg as any).toString(),
    }));
  }

  async skuProductionSummary(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string; page?: number; limit?: number },
  ) {
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
        weightKg: u.weightKg.toString(),
        pcsCount: u.pcsCount,
        totalCost: u.totalCost.toString(),
        createdAt: u.createdAt,
      })),
    };
  }
}


