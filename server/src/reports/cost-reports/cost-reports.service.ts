import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class CostReportsService {
  constructor(private prisma: PrismaService) {}

  async costCascade(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; warehouseId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const container = await this.prisma.$queryRawUnsafe<Array<{ totalCost: string; totalWeightKg: string }>>(
      `
      SELECT
        COALESCE(SUM(ch."amount"), 0) AS "totalCost",
        COALESCE(SUM(c."netWeight"), 0) AS "totalWeightKg"
      FROM "Container" c
      JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
      LEFT JOIN "ContainerCharge" ch ON ch."containerId" = c."id"
      WHERE po."tenantId" = $1
        AND ($2::timestamptz IS NULL OR c."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR c."createdAt" <= $3)
      `,
      tenantId,
      start ?? null,
      end ?? null,
    );

    const ragAgg = await this.prisma.rag.aggregate({
      where: {
        container: { purchaseOrder: { tenantId } },
        ...(start || end
          ? {
              createdAt: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      _sum: { weightKg: true, allocatedCost: true },
    });

    const categoryAgg = await this.prisma.categoryOutput.aggregate({
      where: {
        tenantId,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(start || end
          ? {
              createdAt: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      _sum: { weightKg: true, allocatedCost: true },
    });

    const gradeAgg = await this.prisma.gradeOutput.aggregate({
      where: {
        tenantId,
        ...(filters.gradeId ? { gradeId: filters.gradeId } : {}),
        ...(start || end
          ? {
              createdAt: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      _sum: { weightKg: true, allocatedCost: true },
    });

    const repackAgg = await this.prisma.repackUnit.aggregate({
      where: {
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
      },
      _sum: { weightKg: true, pcsCount: true, totalCost: true },
    });

    const inventoryAgg = await this.prisma.$queryRawUnsafe<
      Array<{ lockedCost: string; denomKg: string; denomPcs: string }>
    >(
      `
      SELECT
        COALESCE(SUM(i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)), 0) AS "lockedCost",
        COALESCE(SUM(CASE WHEN i."pcsCount" = 0 THEN i."weightKg" ELSE 0 END), 0) AS "denomKg",
        COALESCE(SUM(CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE 0 END), 0)::int AS "denomPcs"
      FROM "InventoryItem" i
      WHERE i."tenantId" = $1
        AND ($2::timestamptz IS NULL OR i."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR i."createdAt" <= $3)
        AND ($4::text IS NULL OR i."warehouseId" = $4)
        AND ($5::text IS NULL OR i."categoryId" = $5)
        AND ($6::text IS NULL OR i."gradeId" = $6)
      `,
      tenantId,
      start ?? null,
      end ?? null,
      filters.warehouseId ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    const containerCost = new Decimal(container?.[0]?.totalCost as any);
    const containerWeight = new Decimal(container?.[0]?.totalWeightKg as any);
    const ragCost = ragAgg._sum.allocatedCost ?? new Decimal(0);
    const ragWeight = ragAgg._sum.weightKg ?? new Decimal(0);
    const catCost = categoryAgg._sum.allocatedCost ?? new Decimal(0);
    const catWeight = categoryAgg._sum.weightKg ?? new Decimal(0);
    const gradeCost = gradeAgg._sum.allocatedCost ?? new Decimal(0);
    const gradeWeight = gradeAgg._sum.weightKg ?? new Decimal(0);
    const repackCost = repackAgg._sum.totalCost ?? new Decimal(0);
    const repackWeight = repackAgg._sum.weightKg ?? new Decimal(0);
    const repackPcs = repackAgg._sum.pcsCount ?? 0;

    const invLockedCost = new Decimal(inventoryAgg?.[0]?.lockedCost as any);
    const invKg = new Decimal(inventoryAgg?.[0]?.denomKg as any);
    const invPcs = Number(inventoryAgg?.[0]?.denomPcs ?? 0);

    const avg = (cost: Decimal, denom: Decimal) => (denom.equals(new Decimal(0)) ? new Decimal(0) : cost.div(denom));

    return {
      steps: [
        {
          stage: 'CONTAINER',
          totalCost: containerCost.toString(),
          totalWeightKg: containerWeight.toString(),
          avgCostPerKg: avg(containerCost, containerWeight).toString(),
        },
        {
          stage: 'RAG',
          totalCost: ragCost.toString(),
          totalWeightKg: ragWeight.toString(),
          avgCostPerKg: avg(ragCost, ragWeight).toString(),
        },
        {
          stage: 'CATEGORY',
          totalCost: catCost.toString(),
          totalWeightKg: catWeight.toString(),
          avgCostPerKg: avg(catCost, catWeight).toString(),
        },
        {
          stage: 'GRADE',
          totalCost: gradeCost.toString(),
          totalWeightKg: gradeWeight.toString(),
          avgCostPerKg: avg(gradeCost, gradeWeight).toString(),
        },
        {
          stage: 'REPACK',
          totalCost: repackCost.toString(),
          totalWeightKg: repackWeight.toString(),
          totalPcs: repackPcs,
          avgCostPerKg: avg(repackCost, repackWeight).toString(),
        },
        {
          stage: 'INVENTORY',
          lockedCost: invLockedCost.toString(),
          totalKg: invKg.toString(),
          totalPcs: invPcs,
        },
      ],
    };
  }

  async profitabilityReadiness(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; warehouseId?: string },
  ) {
    const { start, end } = parseDateRange(filters);

    const perKg = await this.prisma.$queryRawUnsafe<
      Array<{ categoryId: string; gradeId: string; totalKg: string; totalCost: string; avgCostPerKg: string }>
    >(
      `
      SELECT
        i."categoryId" AS "categoryId",
        i."gradeId" AS "gradeId",
        COALESCE(SUM(i."weightKg"), 0) AS "totalKg",
        COALESCE(SUM(i."avgCost" * i."weightKg"), 0) AS "totalCost",
        CASE WHEN COALESCE(SUM(i."weightKg"), 0) = 0 THEN 0 ELSE (COALESCE(SUM(i."avgCost" * i."weightKg"), 0) / COALESCE(SUM(i."weightKg"), 0)) END AS "avgCostPerKg"
      FROM "InventoryItem" i
      WHERE i."tenantId" = $1
        AND i."pcsCount" = 0
        AND ($2::timestamptz IS NULL OR i."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR i."createdAt" <= $3)
        AND ($4::text IS NULL OR i."warehouseId" = $4)
        AND ($5::text IS NULL OR i."categoryId" = $5)
        AND ($6::text IS NULL OR i."gradeId" = $6)
      GROUP BY i."categoryId", i."gradeId"
      ORDER BY i."categoryId" ASC, i."gradeId" ASC
      `,
      tenantId,
      start ?? null,
      end ?? null,
      filters.warehouseId ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    const perPcs = await this.prisma.$queryRawUnsafe<
      Array<{ categoryId: string; gradeId: string; totalPcs: number; totalCost: string; avgCostPerPcs: string }>
    >(
      `
      SELECT
        i."categoryId" AS "categoryId",
        i."gradeId" AS "gradeId",
        COALESCE(SUM(i."pcsCount"), 0)::int AS "totalPcs",
        COALESCE(SUM(i."avgCost" * i."pcsCount"), 0) AS "totalCost",
        CASE WHEN COALESCE(SUM(i."pcsCount"), 0) = 0 THEN 0 ELSE (COALESCE(SUM(i."avgCost" * i."pcsCount"), 0) / COALESCE(SUM(i."pcsCount"), 0)) END AS "avgCostPerPcs"
      FROM "InventoryItem" i
      WHERE i."tenantId" = $1
        AND i."pcsCount" > 0
        AND ($2::timestamptz IS NULL OR i."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR i."createdAt" <= $3)
        AND ($4::text IS NULL OR i."warehouseId" = $4)
        AND ($5::text IS NULL OR i."categoryId" = $5)
        AND ($6::text IS NULL OR i."gradeId" = $6)
      GROUP BY i."categoryId", i."gradeId"
      ORDER BY i."categoryId" ASC, i."gradeId" ASC
      `,
      tenantId,
      start ?? null,
      end ?? null,
      filters.warehouseId ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    const sku = await this.prisma.$queryRawUnsafe<
      Array<{ skuKey: string; unitType: string; categoryId: string; gradeId: string; units: number; totalCost: string; totalWeightKg: string; totalPcs: number }>
    >(
      `
      SELECT
        (u."unitType"::text || ':' || COALESCE(u."categoryId",'') || ':' || COALESCE(u."gradeId",'')) AS "skuKey",
        u."unitType"::text AS "unitType",
        COALESCE(u."categoryId",'') AS "categoryId",
        COALESCE(u."gradeId",'') AS "gradeId",
        COUNT(*)::int AS "units",
        COALESCE(SUM(u."totalCost"), 0) AS "totalCost",
        COALESCE(SUM(u."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(u."pcsCount"), 0)::int AS "totalPcs"
      FROM "RepackUnit" u
      WHERE u."tenantId" = $1
        AND ($2::timestamptz IS NULL OR u."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR u."createdAt" <= $3)
        AND ($4::text IS NULL OR u."categoryId" = $4)
        AND ($5::text IS NULL OR u."gradeId" = $5)
      GROUP BY 1, u."unitType", u."categoryId", u."gradeId"
      ORDER BY "skuKey" ASC
      `,
      tenantId,
      start ?? null,
      end ?? null,
      filters.categoryId ?? null,
      filters.gradeId ?? null,
    );

    return { perKg, perPcs, perSku: sku };
  }
}


