import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../common/report-utils';
import { ReportsConsistencyService } from '../common/reports-consistency.service';

@Injectable()
export class InventoryReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consistency: ReportsConsistencyService,
  ) {}

  async inventorySnapshot(
    tenantId: string,
    filters: { warehouseId?: string; categoryId?: string; gradeId?: string; startDate?: string; endDate?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    // Build dynamic query with proper parameter positions
    const conditions: string[] = ['i."tenantId" = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (start) {
      conditions.push(`i."createdAt" >= $${paramIndex}`);
      params.push(start);
      paramIndex++;
    }
    if (end) {
      conditions.push(`i."createdAt" <= $${paramIndex}`);
      params.push(end);
      paramIndex++;
    }
    if (filters.warehouseId) {
      conditions.push(`i."warehouseId" = $${paramIndex}`);
      params.push(filters.warehouseId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(`i."categoryId" = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.gradeId) {
      conditions.push(`i."gradeId" = $${paramIndex}`);
      params.push(filters.gradeId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        warehouseId: string | null;
        warehouseName: string | null;
        categoryId: string;
        categoryName: string | null;
        gradeId: string;
        gradeName: string | null;
        status: string;
        totalUnits: number;
        totalWeightKg: number;
        totalPcs: number;
        totalValue: number;
        denom: number;
      }>
    >(
      `
      SELECT
        i."warehouseId" AS "warehouseId",
        w."name" AS "warehouseName",
        i."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        i."gradeId" AS "gradeId",
        g."name" AS "gradeName",
        i."status"::text AS "status",
        COUNT(*)::int AS "totalUnits",
        COALESCE(SUM(i."weightKg"), 0)::float8 AS "totalWeightKg",
        COALESCE(SUM(i."pcsCount"), 0)::int AS "totalPcs",
        COALESCE(SUM(i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)), 0)::float8 AS "totalValue",
        COALESCE(SUM((CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)), 0)::float8 AS "denom"
      FROM "InventoryItem" i
      LEFT JOIN "Warehouse" w ON w."id" = i."warehouseId"
      JOIN "Category" c ON c."id" = i."categoryId"
      JOIN "Grade" g ON g."id" = i."gradeId"
      WHERE ${whereClause}
      GROUP BY i."warehouseId", w."name", i."categoryId", c."name", i."gradeId", g."name", i."status"
      ORDER BY w."name" ASC NULLS LAST, c."name" ASC, g."name" ASC, i."status" ASC
      `,
      ...params,
    );

    const data = rows.map((r) => {
      const denom = Number(r.denom ?? 0);
      const totalValue = Number(r.totalValue ?? 0);
      return {
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        gradeId: r.gradeId,
        gradeName: r.gradeName,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        status: r.status,
        totalUnits: Number(r.totalUnits ?? 0),
        totalWeightKg: Number(r.totalWeightKg ?? 0),
        totalPcs: Number(r.totalPcs ?? 0),
        avgCost: denom > 0 ? totalValue / denom : 0,
      };
    });

    return {
      data,
      summary: {
        totalUnits: data.reduce((sum, r) => sum + (r.totalUnits || 0), 0),
        totalWeightKg: data.reduce((sum, r) => sum + (r.totalWeightKg || 0), 0),
        totalPcs: data.reduce((sum, r) => sum + (r.totalPcs || 0), 0),
      },
    };
  }

  async inventoryAging(
    tenantId: string,
    filters: { warehouseId?: string; categoryId?: string; gradeId?: string; asOfDate?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const asOf = filters.asOfDate ? new Date(filters.asOfDate) : new Date();
    if (isNaN(asOf.getTime())) throw new Error('Invalid asOfDate');

    // Build dynamic query with proper parameter positions
    const conditions: string[] = ['i."tenantId" = $1'];
    const params: any[] = [tenantId, asOf]; // $2 is always asOf
    let paramIndex = 3;

    if (filters.warehouseId) {
      conditions.push(`i."warehouseId" = $${paramIndex}`);
      params.push(filters.warehouseId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(`i."categoryId" = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.gradeId) {
      conditions.push(`i."gradeId" = $${paramIndex}`);
      params.push(filters.gradeId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        ageRangeDays: string;
        unitsCount: number;
        totalWeightKg: number;
        totalValue: number;
      }>
    >(
      `
      WITH base AS (
        SELECT
          i.*,
          EXTRACT(DAY FROM ($2::timestamptz - i."createdAt"))::int AS "ageDays",
          (i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)) AS "lockedCost"
        FROM "InventoryItem" i
        WHERE ${whereClause}
      )
      SELECT
        CASE
          WHEN "ageDays" <= 7 THEN '0-7'
          WHEN "ageDays" <= 30 THEN '8-30'
          WHEN "ageDays" <= 90 THEN '31-90'
          WHEN "ageDays" <= 180 THEN '91-180'
          ELSE '181+'
        END AS "ageRangeDays",
        COUNT(*)::int AS "unitsCount",
        COALESCE(SUM("weightKg"), 0)::float8 AS "totalWeightKg",
        COALESCE(SUM("lockedCost"), 0)::float8 AS "totalValue"
      FROM base
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      ...params,
    );

    return { data: rows.map((r) => ({
      ageRangeDays: r.ageRangeDays,
      unitsCount: Number(r.unitsCount ?? 0),
      totalWeightKg: Number(r.totalWeightKg ?? 0),
      totalValue: Number(r.totalValue ?? 0),
    })) };
  }

  async inventoryMovements(
    tenantId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      warehouseId?: string;
      categoryId?: string;
      gradeId?: string;
      movementType?: string;
    },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    const conditions: string[] = ['i."tenantId" = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (start) {
      conditions.push(`m."createdAt" >= $${paramIndex}`);
      params.push(start);
      paramIndex++;
    }
    if (end) {
      conditions.push(`m."createdAt" <= $${paramIndex}`);
      params.push(end);
      paramIndex++;
    }
    if (filters.warehouseId) {
      conditions.push(`i."warehouseId" = $${paramIndex}`);
      params.push(filters.warehouseId);
      paramIndex++;
    }
    if (filters.categoryId) {
      conditions.push(`i."categoryId" = $${paramIndex}`);
      params.push(filters.categoryId);
      paramIndex++;
    }
    if (filters.gradeId) {
      conditions.push(`i."gradeId" = $${paramIndex}`);
      params.push(filters.gradeId);
      paramIndex++;
    }
    if (filters.movementType) {
      conditions.push(`m."movementType"::text = $${paramIndex}`);
      params.push(filters.movementType);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        movementId: string;
        createdAt: Date;
        movementType: string;
        quantityKg: number;
        quantityPcs: number;
        referenceId: string | null;
        inventoryItemId: string;
        inventoryStatus: string;
        avgCost: number;
        warehouseId: string | null;
        warehouseName: string | null;
        categoryId: string;
        categoryName: string;
        gradeId: string;
        gradeName: string;
        repackUnitId: string;
        unitCode: string;
        unitType: string;
      }>
    >(
      `
      SELECT
        m."id" AS "movementId",
        m."createdAt" AS "createdAt",
        m."movementType"::text AS "movementType",
        COALESCE(m."quantityKg", 0)::float8 AS "quantityKg",
        COALESCE(m."quantityPcs", 0)::int AS "quantityPcs",
        m."referenceId" AS "referenceId",
        i."id" AS "inventoryItemId",
        i."status"::text AS "inventoryStatus",
        COALESCE(i."avgCost", 0)::float8 AS "avgCost",
        i."warehouseId" AS "warehouseId",
        w."name" AS "warehouseName",
        i."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        i."gradeId" AS "gradeId",
        g."name" AS "gradeName",
        i."repackUnitId" AS "repackUnitId",
        u."unitCode" AS "unitCode",
        u."unitType"::text AS "unitType"
      FROM "StockMovement" m
      JOIN "InventoryItem" i ON i."id" = m."inventoryItemId"
      JOIN "RepackUnit" u ON u."id" = i."repackUnitId"
      JOIN "Category" c ON c."id" = i."categoryId"
      JOIN "Grade" g ON g."id" = i."gradeId"
      LEFT JOIN "Warehouse" w ON w."id" = i."warehouseId"
      WHERE ${whereClause}
      ORDER BY m."createdAt" DESC
      LIMIT 5000
      `,
      ...params,
    );

    const data = rows.map((r) => ({
      movementId: r.movementId,
      createdAt: r.createdAt,
      movementType: r.movementType,
      quantityKg: Number(r.quantityKg ?? 0),
      quantityPcs: Number(r.quantityPcs ?? 0),
      referenceId: r.referenceId,
      inventoryItemId: r.inventoryItemId,
      inventoryStatus: r.inventoryStatus,
      avgCost: Number(r.avgCost ?? 0),
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      gradeId: r.gradeId,
      gradeName: r.gradeName,
      repackUnitId: r.repackUnitId,
      unitCode: r.unitCode,
      unitType: r.unitType,
    }));

    return {
      data,
      summary: {
        totalMovements: data.length,
        totalKg: data.reduce((sum, r) => sum + (r.quantityKg || 0), 0),
        totalPcs: data.reduce((sum, r) => sum + (r.quantityPcs || 0), 0),
      },
    };
  }
}


