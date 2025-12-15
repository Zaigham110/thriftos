import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class InventoryReportsService {
  constructor(private prisma: PrismaService) {}

  async inventorySnapshot(
    tenantId: string,
    filters: { warehouseId?: string; categoryId?: string; gradeId?: string; startDate?: string; endDate?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        warehouseId: string;
        categoryId: string;
        gradeId: string;
        status: string;
        items: number;
        weightKg: string;
        pcsCount: number;
        costLocked: string;
      }>
    >(
      `
      SELECT
        i."warehouseId" AS "warehouseId",
        i."categoryId" AS "categoryId",
        i."gradeId" AS "gradeId",
        i."status"::text AS "status",
        COUNT(*)::int AS "items",
        COALESCE(SUM(i."weightKg"), 0) AS "weightKg",
        COALESCE(SUM(i."pcsCount"), 0)::int AS "pcsCount",
        COALESCE(SUM(i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)), 0) AS "costLocked"
      FROM "InventoryItem" i
      WHERE i."tenantId" = $1
        ${start ? `AND i."createdAt" >= $2` : ``}
        ${end ? `AND i."createdAt" <= $3` : ``}
        ${filters.warehouseId ? `AND i."warehouseId" = $4` : ``}
        ${filters.categoryId ? `AND i."categoryId" = $5` : ``}
        ${filters.gradeId ? `AND i."gradeId" = $6` : ``}
      GROUP BY i."warehouseId", i."categoryId", i."gradeId", i."status"
      ORDER BY i."warehouseId" ASC, i."categoryId" ASC, i."gradeId" ASC, i."status" ASC
      `,
      tenantId,
      start ?? new Date(0),
      end ?? new Date(),
      filters.warehouseId ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    return rows.map((r) => ({
      warehouseId: r.warehouseId,
      categoryId: r.categoryId,
      gradeId: r.gradeId,
      status: r.status,
      items: r.items,
      weightKg: new Decimal(r.weightKg as any).toString(),
      pcsCount: r.pcsCount,
      costLocked: new Decimal(r.costLocked as any).toString(),
    }));
  }

  async inventoryAging(
    tenantId: string,
    filters: { warehouseId?: string; categoryId?: string; gradeId?: string; asOfDate?: string },
  ) {
    const asOf = filters.asOfDate ? new Date(filters.asOfDate) : new Date();
    if (isNaN(asOf.getTime())) throw new Error('Invalid asOfDate');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        bucket: string;
        items: number;
        weightKg: string;
        pcsCount: number;
        costLocked: string;
      }>
    >(
      `
      WITH base AS (
        SELECT
          i.*,
          EXTRACT(DAY FROM ($2::timestamptz - i."createdAt"))::int AS "ageDays",
          (i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)) AS "lockedCost"
        FROM "InventoryItem" i
        WHERE i."tenantId" = $1
          ${filters.warehouseId ? `AND i."warehouseId" = $3` : ``}
          ${filters.categoryId ? `AND i."categoryId" = $4` : ``}
          ${filters.gradeId ? `AND i."gradeId" = $5` : ``}
      )
      SELECT
        CASE
          WHEN "ageDays" <= 7 THEN '0-7'
          WHEN "ageDays" <= 30 THEN '8-30'
          WHEN "ageDays" <= 90 THEN '31-90'
          WHEN "ageDays" <= 180 THEN '91-180'
          ELSE '181+'
        END AS "bucket",
        COUNT(*)::int AS "items",
        COALESCE(SUM("weightKg"), 0) AS "weightKg",
        COALESCE(SUM("pcsCount"), 0)::int AS "pcsCount",
        COALESCE(SUM("lockedCost"), 0) AS "costLocked"
      FROM base
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      tenantId,
      asOf,
      filters.warehouseId ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    return rows.map((r) => ({
      bucket: r.bucket,
      items: r.items,
      weightKg: new Decimal(r.weightKg as any).toString(),
      pcsCount: r.pcsCount,
      costLocked: new Decimal(r.costLocked as any).toString(),
    }));
  }
}


