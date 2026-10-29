import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';
import { ReportsConsistencyService } from '../common/reports-consistency.service';

type TrendPoint = { bucket: string; value: string };
type YieldWasteTrendPoint = { bucket: string; yieldPct: string; wastePct: string };

@Injectable()
export class SortingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consistency: ReportsConsistencyService,
  ) {}

  async categoryYieldReport(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
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
        categoryName: string;
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
        buckets."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        COALESCE(SUM("bucketOutput"), 0) AS "outputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "input" * ("bucketOutput" / "totalOutput") END), 0) AS "inputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "waste" * ("bucketOutput" / "totalOutput") END), 0) AS "wasteWeightKg"
      FROM buckets
      JOIN "Category" c ON c."id" = buckets."categoryId"
      GROUP BY buckets."categoryId", c."name"
      ORDER BY c."name" ASC
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
        categoryName: r.categoryName,
        inputWeightKg: input.toNumber(),
        outputWeightKg: output.toNumber(),
        wasteWeightKg: waste.toNumber(),
        yieldPct: Number(yieldPct.toFixed(2)),
      };
    });
  }

  async sortingOutputs(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; gradeId?: string; workerId?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    // Stage 1 outputs (CategoryOutput)
    const stage1Conditions: string[] = ['co."tenantId" = $1'];
    const stage1Params: any[] = [tenantId];
    let s1 = 2;

    if (start) {
      stage1Conditions.push(`co."createdAt" >= $${s1}`);
      stage1Params.push(start);
      s1++;
    }
    if (end) {
      stage1Conditions.push(`co."createdAt" <= $${s1}`);
      stage1Params.push(end);
      s1++;
    }
    if (filters.categoryId) {
      stage1Conditions.push(`co."categoryId" = $${s1}`);
      stage1Params.push(filters.categoryId);
      s1++;
    }
    if (filters.workerId) {
      stage1Conditions.push(`ss."workerId" = $${s1}`);
      stage1Params.push(filters.workerId);
      s1++;
    }

    const stage1Where = stage1Conditions.join(' AND ');

    const stage1Rows = await this.prisma.$queryRawUnsafe<
      Array<{
        categoryOutputId: string;
        createdAt: Date;
        categoryId: string;
        categoryName: string;
        weightKg: number;
        allocatedCost: number;
        sortSessionId: string;
        sortStatus: string;
        workerId: string;
        ragId: string;
        ragCode: string;
        containerId: string | null;
        containerNumber: string | null;
        purchaseOrderId: string | null;
        poNumber: string | null;
      }>
    >(
      `
      SELECT
        co."id" AS "categoryOutputId",
        co."createdAt" AS "createdAt",
        co."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        COALESCE(co."weightKg", 0)::float8 AS "weightKg",
        COALESCE(co."allocatedCost", 0)::float8 AS "allocatedCost",
        co."sortSessionId" AS "sortSessionId",
        ss."status"::text AS "sortStatus",
        ss."workerId" AS "workerId",
        co."ragId" AS "ragId",
        r."ragCode" AS "ragCode",
        co."containerId" AS "containerId",
        ct."containerNumber" AS "containerNumber",
        po."id" AS "purchaseOrderId",
        po."poNumber" AS "poNumber"
      FROM "CategoryOutput" co
      JOIN "Category" c ON c."id" = co."categoryId"
      JOIN "SortSession" ss ON ss."id" = co."sortSessionId"
      JOIN "Rag" r ON r."id" = co."ragId"
      LEFT JOIN "Container" ct ON ct."id" = co."containerId"
      LEFT JOIN "PurchaseOrder" po ON po."id" = ct."purchaseOrderId"
      WHERE ${stage1Where}
      ORDER BY co."createdAt" DESC
      LIMIT 5000
      `,
      ...stage1Params,
    );

    // Stage 2 outputs (GradeOutput)
    const stage2Conditions: string[] = ['go."tenantId" = $1'];
    const stage2Params: any[] = [tenantId];
    let s2 = 2;

    if (start) {
      stage2Conditions.push(`go."createdAt" >= $${s2}`);
      stage2Params.push(start);
      s2++;
    }
    if (end) {
      stage2Conditions.push(`go."createdAt" <= $${s2}`);
      stage2Params.push(end);
      s2++;
    }
    if (filters.gradeId) {
      stage2Conditions.push(`go."gradeId" = $${s2}`);
      stage2Params.push(filters.gradeId);
      s2++;
    }
    if (filters.workerId) {
      stage2Conditions.push(`gs."workerId" = $${s2}`);
      stage2Params.push(filters.workerId);
      s2++;
    }

    const stage2Where = stage2Conditions.join(' AND ');

    const stage2Rows = await this.prisma.$queryRawUnsafe<
      Array<{
        gradingOutputId: string;
        createdAt: Date;
        gradeId: string;
        gradeName: string;
        categoryId: string;
        categoryName: string;
        weightKg: number;
        allocatedCost: number;
        totalAmount: number;
        usedAmount: number;
        remainingAmount: number;
        measurementType: string;
        status: string;
        gradeSessionId: string;
        gradeStatus: string;
        workerId: string;
        categoryOutputId: string;
        sortSessionId: string;
        ragId: string;
        ragCode: string;
        containerId: string | null;
        containerNumber: string | null;
        purchaseOrderId: string | null;
        poNumber: string | null;
      }>
    >(
      `
      SELECT
        go."id" AS "gradingOutputId",
        go."createdAt" AS "createdAt",
        go."gradeId" AS "gradeId",
        gr."name" AS "gradeName",
        co."categoryId" AS "categoryId",
        cat."name" AS "categoryName",
        COALESCE(go."weightKg", 0)::float8 AS "weightKg",
        COALESCE(go."allocatedCost", 0)::float8 AS "allocatedCost",
        COALESCE(go."totalAmount", 0)::float8 AS "totalAmount",
        COALESCE(go."usedAmount", 0)::float8 AS "usedAmount",
        COALESCE(go."remainingAmount", 0)::float8 AS "remainingAmount",
        go."measurementType"::text AS "measurementType",
        go."status"::text AS "status",
        gs."id" AS "gradeSessionId",
        gs."status"::text AS "gradeStatus",
        gs."workerId" AS "workerId",
        co."id" AS "categoryOutputId",
        co."sortSessionId" AS "sortSessionId",
        co."ragId" AS "ragId",
        r."ragCode" AS "ragCode",
        co."containerId" AS "containerId",
        ct."containerNumber" AS "containerNumber",
        po."id" AS "purchaseOrderId",
        po."poNumber" AS "poNumber"
      FROM "GradeOutput" go
      JOIN "Grade" gr ON gr."id" = go."gradeId"
      JOIN "GradeBucket" gb ON gb."id" = go."gradeBucketId"
      JOIN "GradeSession" gs ON gs."id" = gb."gradeSessionId"
      JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
      JOIN "Category" cat ON cat."id" = co."categoryId"
      JOIN "Rag" r ON r."id" = co."ragId"
      LEFT JOIN "Container" ct ON ct."id" = co."containerId"
      LEFT JOIN "PurchaseOrder" po ON po."id" = ct."purchaseOrderId"
      WHERE ${stage2Where}
      ORDER BY go."createdAt" DESC
      LIMIT 5000
      `,
      ...stage2Params,
    );

    const stage1 = stage1Rows.map((r) => ({
      categoryOutputId: r.categoryOutputId,
      createdAt: r.createdAt,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      weightKg: Number(r.weightKg ?? 0),
      allocatedCost: Number(r.allocatedCost ?? 0),
      sortSessionId: r.sortSessionId,
      sortStatus: r.sortStatus,
      workerId: r.workerId,
      ragId: r.ragId,
      ragCode: r.ragCode,
      containerId: r.containerId,
      containerNumber: r.containerNumber,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.poNumber,
    }));

    const stage2 = stage2Rows.map((r) => ({
      gradingOutputId: r.gradingOutputId,
      createdAt: r.createdAt,
      gradeId: r.gradeId,
      gradeName: r.gradeName,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      weightKg: Number(r.weightKg ?? 0),
      allocatedCost: Number(r.allocatedCost ?? 0),
      totalAmount: Number(r.totalAmount ?? 0),
      usedAmount: Number(r.usedAmount ?? 0),
      remainingAmount: Number(r.remainingAmount ?? 0),
      measurementType: r.measurementType,
      status: r.status,
      gradeSessionId: r.gradeSessionId,
      gradeStatus: r.gradeStatus,
      workerId: r.workerId,
      categoryOutputId: r.categoryOutputId,
      sortSessionId: r.sortSessionId,
      ragId: r.ragId,
      ragCode: r.ragCode,
      containerId: r.containerId,
      containerNumber: r.containerNumber,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.poNumber,
    }));

    return {
      stage1: {
        data: stage1,
        summary: {
          totalOutputs: stage1.length,
          totalWeightKg: stage1.reduce((sum, r) => sum + (r.weightKg || 0), 0),
          totalAllocatedCost: stage1.reduce((sum, r) => sum + (r.allocatedCost || 0), 0),
        },
      },
      stage2: {
        data: stage2,
        summary: {
          totalOutputs: stage2.length,
          totalWeightKg: stage2.reduce((sum, r) => sum + (r.weightKg || 0), 0),
          totalAllocatedCost: stage2.reduce((sum, r) => sum + (r.allocatedCost || 0), 0),
        },
      },
    };
  }

  async sortingWaste(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; workerId?: string },
  ) {
    await this.consistency.assertTenantIsReportable(tenantId);
    const { start, end } = parseDateRange(filters);

    // Categorized waste: WasteLineItem (STAGE_1 + STAGE_2) with WasteCategory config.
    const wasteConditions: string[] = ['wli."tenantId" = $1'];
    const wasteParams: any[] = [tenantId];
    let wIdx = 2;

    if (start) {
      wasteConditions.push(`wli."createdAt" >= $${wIdx}`);
      wasteParams.push(start);
      wIdx++;
    }
    if (end) {
      wasteConditions.push(`wli."createdAt" <= $${wIdx}`);
      wasteParams.push(end);
      wIdx++;
    }
    if (filters.workerId) {
      // Worker could be recorded on SortSession (stage 1) or GradeSession (stage 2).
      wasteConditions.push(`(ss."workerId" = $${wIdx} OR gs."workerId" = $${wIdx})`);
      wasteParams.push(filters.workerId);
      wIdx++;
    }

    const wasteWhereClause = wasteConditions.join(' AND ');

    const categorizedRows = await this.prisma.$queryRawUnsafe<
      Array<{
        wasteLineItemId: string;
        createdAt: Date;
        stage: 'STAGE_1' | 'STAGE_2';
        amount: number;
        unitType: 'KG' | 'PCS';
        estimatedValue: number;
        wasteCategoryId: string;
        wasteCategoryName: string;
        sortSessionId: string | null;
        gradeSessionId: string | null;
        ragId: string | null;
        ragCode: string | null;
        containerId: string | null;
        containerNumber: string | null;
        purchaseOrderId: string | null;
        poNumber: string | null;
        workerId: string | null;
      }>
    >(
      `
      SELECT
        wli."id" AS "wasteLineItemId",
        wli."createdAt" AS "createdAt",
        wli."stage" AS "stage",
        COALESCE(wli."amount", 0)::float8 AS "amount",
        wli."unitType" AS "unitType",
        COALESCE(wli."estimatedValue", 0)::float8 AS "estimatedValue",
        wc."id" AS "wasteCategoryId",
        wc."name" AS "wasteCategoryName",
        wli."sortSessionId" AS "sortSessionId",
        wli."gradeSessionId" AS "gradeSessionId",
        wli."ragId" AS "ragId",
        r."ragCode" AS "ragCode",
        wli."containerId" AS "containerId",
        ct."containerNumber" AS "containerNumber",
        po."id" AS "purchaseOrderId",
        po."poNumber" AS "poNumber",
        COALESCE(ss."workerId", gs."workerId") AS "workerId"
      FROM "WasteLineItem" wli
      JOIN "WasteCategory" wc ON wc."id" = wli."wasteCategoryId"
      LEFT JOIN "SortSession" ss ON ss."id" = wli."sortSessionId"
      LEFT JOIN "GradeSession" gs ON gs."id" = wli."gradeSessionId"
      LEFT JOIN "Rag" r ON r."id" = wli."ragId"
      LEFT JOIN "Container" ct ON ct."id" = wli."containerId"
      LEFT JOIN "PurchaseOrder" po ON po."id" = ct."purchaseOrderId"
      WHERE ${wasteWhereClause}
      ORDER BY wli."createdAt" DESC
      LIMIT 5000
      `,
      ...wasteParams,
    );

    const categorizedData = categorizedRows.map((r) => ({
      wasteLineItemId: r.wasteLineItemId,
      createdAt: r.createdAt,
      stage: r.stage,
      amount: Number(r.amount ?? 0),
      unitType: r.unitType,
      estimatedValue: Number(r.estimatedValue ?? 0),
      wasteCategoryId: r.wasteCategoryId,
      wasteCategoryName: r.wasteCategoryName,
      sortSessionId: r.sortSessionId,
      gradeSessionId: r.gradeSessionId,
      workerId: r.workerId,
      ragId: r.ragId,
      ragCode: r.ragCode,
      containerId: r.containerId,
      containerNumber: r.containerNumber,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.poNumber,
    }));

    const categorizedByCategoryRows = await this.prisma.$queryRawUnsafe<
      Array<{
        stage: 'STAGE_1' | 'STAGE_2';
        wasteCategoryId: string;
        wasteCategoryName: string;
        unitType: 'KG' | 'PCS';
        totalAmount: number;
        totalEstimatedValue: number;
        totalRecords: number;
      }>
    >(
      `
      SELECT
        wli."stage" AS "stage",
        wc."id" AS "wasteCategoryId",
        wc."name" AS "wasteCategoryName",
        wli."unitType" AS "unitType",
        COALESCE(SUM(wli."amount"), 0)::float8 AS "totalAmount",
        COALESCE(SUM(wli."estimatedValue"), 0)::float8 AS "totalEstimatedValue",
        COUNT(*)::int AS "totalRecords"
      FROM "WasteLineItem" wli
      JOIN "WasteCategory" wc ON wc."id" = wli."wasteCategoryId"
      LEFT JOIN "SortSession" ss ON ss."id" = wli."sortSessionId"
      LEFT JOIN "GradeSession" gs ON gs."id" = wli."gradeSessionId"
      WHERE ${wasteWhereClause}
      GROUP BY wli."stage", wc."id", wc."name", wli."unitType"
      ORDER BY wli."stage" ASC, wc."name" ASC
      `,
      ...wasteParams,
    );

    const categorizedByCategory = categorizedByCategoryRows.map((r) => ({
      stage: r.stage,
      wasteCategoryId: r.wasteCategoryId,
      wasteCategoryName: r.wasteCategoryName,
      unitType: r.unitType,
      totalAmount: Number(r.totalAmount ?? 0),
      totalEstimatedValue: Number(r.totalEstimatedValue ?? 0),
      totalRecords: Number(r.totalRecords ?? 0),
    }));

    const categorizedSummary = {
      totalKg: categorizedData
        .filter((r) => r.unitType === 'KG')
        .reduce((sum, r) => sum + (r.amount || 0), 0),
      totalPcs: categorizedData
        .filter((r) => r.unitType === 'PCS')
        .reduce((sum, r) => sum + (r.amount || 0), 0),
      totalEstimatedValue: categorizedData.reduce((sum, r) => sum + (r.estimatedValue || 0), 0),
      totalRecords: categorizedData.length,
    };

    return {
      categorized: {
        data: categorizedData,
        byCategory: categorizedByCategory,
        summary: categorizedSummary,
      },
    };
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

  async sortingVolumeTrend(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string },
  ): Promise<TrendPoint[]> {
    const { start, end } = parseDateRange(filters);

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
    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }
    if (filters.categoryId) {
      // Filter sessions that have at least one bucket matching category.
      conditions.push(
        `EXISTS (SELECT 1 FROM "SortCategoryBucket" b WHERE b."sortSessionId" = s."id" AND b."categoryId" = $${paramIndex})`,
      );
      params.push(filters.categoryId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ bucket: string; value: string }>
    >(
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

  async sortingYieldWasteTrend(
    tenantId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string; workerId?: string },
  ): Promise<YieldWasteTrendPoint[]> {
    const { start, end } = parseDateRange(filters);

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
    if (filters.workerId) {
      conditions.push(`s."workerId" = $${paramIndex}`);
      params.push(filters.workerId);
      paramIndex++;
    }
    if (filters.categoryId) {
      // Restrict to sessions with bucket activity in the category.
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
      return {
        bucket: r.bucket,
        yieldPct: yieldPct.toFixed(2),
        wastePct: wastePct.toFixed(2),
      };
    });
  }
}


