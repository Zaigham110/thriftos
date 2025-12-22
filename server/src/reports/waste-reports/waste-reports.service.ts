import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRange } from '../common/report-utils';

@Injectable()
export class WasteReportsService {
  constructor(private prisma: PrismaService) {}

  async wasteByStage(tenantId: string, filters: { startDate?: string; endDate?: string }) {
    const { start, end } = parseDateRange(filters);

    // Build dynamic query with proper parameter positions for procurement
    const procConditions: string[] = ['po."tenantId" = $1'];
    const procParams: any[] = [tenantId];
    let procIdx = 2;
    if (start) {
      procConditions.push(`c."createdAt" >= $${procIdx}`);
      procParams.push(start);
      procIdx++;
    }
    if (end) {
      procConditions.push(`c."createdAt" <= $${procIdx}`);
      procParams.push(end);
      procIdx++;
    }
    const procWhere = procConditions.join(' AND ');

    // Procurement waste: container netWeight - sum(rag weights), only where both exist.
    const procurement = await this.prisma.$queryRawUnsafe<
      Array<{ wasteKg: string }>
    >(
      `
      WITH per_container AS (
        SELECT
          c."id" AS "containerId",
          COALESCE(c."netWeight", 0) AS "netWeight",
          COALESCE(SUM(r."weightKg"), 0) AS "ragWeight"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        LEFT JOIN "Rag" r ON r."containerId" = c."id"
        WHERE ${procWhere}
        GROUP BY c."id", c."netWeight"
      )
      SELECT COALESCE(SUM(("netWeight" - "ragWeight")), 0) AS "wasteKg"
      FROM per_container
      `,
      ...procParams,
    );

    const stage1 = await this.prisma.sortSession.aggregate({
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
      },
      _sum: { wasteWeight: true },
    });

    const stage2Conditions: string[] = ['gs."tenantId" = $1', 'gs."status" = \'CLOSED\''];
    const stage2Params: any[] = [tenantId];
    let stage2Idx = 2;
    if (start) {
      stage2Conditions.push(`gs."startTime" >= $${stage2Idx}`);
      stage2Params.push(start);
      stage2Idx++;
    }
    if (end) {
      stage2Conditions.push(`gs."startTime" <= $${stage2Idx}`);
      stage2Params.push(end);
      stage2Idx++;
    }
    const stage2Where = stage2Conditions.join(' AND ');

    const stage2 = await this.prisma.$queryRawUnsafe<Array<{ wasteKg: string }>>(
      `
      WITH session_out AS (
        SELECT
          gs."id" AS "gradeSessionId",
          co."weightKg" AS "inputWeight",
          COALESCE(SUM(go."weightKg"), 0) AS "outputWeight"
        FROM "GradeSession" gs
        JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
        LEFT JOIN "GradeBucket" gb ON gb."gradeSessionId" = gs."id"
        LEFT JOIN "GradeOutput" go ON go."gradeBucketId" = gb."id"
        WHERE ${stage2Where}
        GROUP BY gs."id", co."weightKg"
      )
      SELECT COALESCE(SUM(("inputWeight" - "outputWeight")), 0) AS "wasteKg"
      FROM session_out
      `,
      ...stage2Params,
    );

    return {
      procurementWasteKg: new Decimal(procurement?.[0]?.wasteKg as any).toString(),
      sortingStage1WasteKg: (stage1._sum.wasteWeight ?? new Decimal(0)).toString(),
      gradingStage2WasteKg: new Decimal(stage2?.[0]?.wasteKg as any).toString(),
    };
  }

  async wasteCostImpact(tenantId: string, filters: { startDate?: string; endDate?: string }) {
    const { start, end } = parseDateRange(filters);

    // Build dynamic params for procurement
    const procConditions: string[] = ['po."tenantId" = $1'];
    const procParams: any[] = [tenantId];
    let procIdx = 2;
    if (start) {
      procConditions.push(`c."createdAt" >= $${procIdx}`);
      procParams.push(start);
      procIdx++;
    }
    if (end) {
      procConditions.push(`c."createdAt" <= $${procIdx}`);
      procParams.push(end);
      procIdx++;
    }
    const procWhere = procConditions.join(' AND ');

    // Procurement waste cost: per container wasteKg * (totalCharges / netWeight)
    const procurement = await this.prisma.$queryRawUnsafe<
      Array<{ wasteKg: string; wasteCost: string }>
    >(
      `
      WITH per_container AS (
        SELECT
          c."id" AS "containerId",
          COALESCE(c."netWeight", 0) AS "netWeight",
          COALESCE(SUM(r."weightKg"), 0) AS "ragWeight",
          COALESCE(SUM(ch."amount"), 0) AS "totalCharges"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        LEFT JOIN "Rag" r ON r."containerId" = c."id"
        LEFT JOIN "ContainerCharge" ch ON ch."containerId" = c."id"
        WHERE ${procWhere}
        GROUP BY c."id", c."netWeight"
      ),
      calc AS (
        SELECT
          ("netWeight" - "ragWeight") AS "wasteKg",
          CASE WHEN "netWeight" = 0 THEN 0 ELSE ("totalCharges" / "netWeight") END AS "costPerKg"
        FROM per_container
      )
      SELECT
        COALESCE(SUM("wasteKg"), 0) AS "wasteKg",
        COALESCE(SUM("wasteKg" * "costPerKg"), 0) AS "wasteCost"
      FROM calc
      `,
      ...procParams,
    );

    // Build dynamic params for stage1
    const s1Conditions: string[] = ['s."tenantId" = $1', 's."status" = \'CLOSED\''];
    const s1Params: any[] = [tenantId];
    let s1Idx = 2;
    if (start) {
      s1Conditions.push(`s."startTime" >= $${s1Idx}`);
      s1Params.push(start);
      s1Idx++;
    }
    if (end) {
      s1Conditions.push(`s."startTime" <= $${s1Idx}`);
      s1Params.push(end);
      s1Idx++;
    }
    const s1Where = s1Conditions.join(' AND ');

    // Stage 1 waste cost: inputCost (rag allocatedCost or incoming bale cost) - sum(categoryOutput allocatedCost)
    const stage1 = await this.prisma.$queryRawUnsafe<
      Array<{ wasteKg: string; wasteCost: string }>
    >(
      `
      WITH per_session AS (
        SELECT
          s."id" AS "sortSessionId",
          s."wasteWeight" AS "wasteKg",
          CASE
            WHEN s."ragId" IS NOT NULL THEN COALESCE(r."allocatedCost", 0)
            WHEN s."incomingBaleId" IS NOT NULL THEN COALESCE(b."cost", 0)
            ELSE 0
          END AS "inputCost",
          COALESCE(SUM(co."allocatedCost"), 0) AS "outputCost"
        FROM "SortSession" s
        LEFT JOIN "Rag" r ON r."id" = s."ragId"
        LEFT JOIN "IncomingBale" b ON b."id" = s."incomingBaleId"
        LEFT JOIN "SortCategoryBucket" scb ON scb."sortSessionId" = s."id"
        LEFT JOIN "CategoryOutput" co ON co."sortCategoryBucketId" = scb."id"
        WHERE ${s1Where}
        GROUP BY s."id", s."wasteWeight", s."ragId", s."incomingBaleId", r."allocatedCost", b."cost"
      )
      SELECT
        COALESCE(SUM("wasteKg"), 0) AS "wasteKg",
        COALESCE(SUM(("inputCost" - "outputCost")), 0) AS "wasteCost"
      FROM per_session
      `,
      ...s1Params,
    );

    // Build dynamic params for stage2
    const s2Conditions: string[] = ['gs."tenantId" = $1', 'gs."status" = \'CLOSED\''];
    const s2Params: any[] = [tenantId];
    let s2Idx = 2;
    if (start) {
      s2Conditions.push(`gs."startTime" >= $${s2Idx}`);
      s2Params.push(start);
      s2Idx++;
    }
    if (end) {
      s2Conditions.push(`gs."startTime" <= $${s2Idx}`);
      s2Params.push(end);
      s2Idx++;
    }
    const s2Where = s2Conditions.join(' AND ');

    // Stage 2 waste cost: categoryOutput allocatedCost - sum(gradeOutput allocatedCost)
    const stage2 = await this.prisma.$queryRawUnsafe<
      Array<{ wasteKg: string; wasteCost: string }>
    >(
      `
      WITH per_session AS (
        SELECT
          gs."id" AS "gradeSessionId",
          co."weightKg" AS "inputWeightKg",
          co."allocatedCost" AS "inputCost",
          COALESCE(SUM(go."weightKg"), 0) AS "outputWeightKg",
          COALESCE(SUM(go."allocatedCost"), 0) AS "outputCost"
        FROM "GradeSession" gs
        JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
        LEFT JOIN "GradeBucket" gb ON gb."gradeSessionId" = gs."id"
        LEFT JOIN "GradeOutput" go ON go."gradeBucketId" = gb."id"
        WHERE ${s2Where}
        GROUP BY gs."id", co."weightKg", co."allocatedCost"
      )
      SELECT
        COALESCE(SUM(("inputWeightKg" - "outputWeightKg")), 0) AS "wasteKg",
        COALESCE(SUM(("inputCost" - "outputCost")), 0) AS "wasteCost"
      FROM per_session
      `,
      ...s2Params,
    );

    return {
      procurement: {
        wasteKg: new Decimal(procurement?.[0]?.wasteKg as any).toString(),
        wasteCost: new Decimal(procurement?.[0]?.wasteCost as any).toString(),
      },
      sortingStage1: {
        wasteKg: new Decimal(stage1?.[0]?.wasteKg as any).toString(),
        wasteCost: new Decimal(stage1?.[0]?.wasteCost as any).toString(),
      },
      gradingStage2: {
        wasteKg: new Decimal(stage2?.[0]?.wasteKg as any).toString(),
        wasteCost: new Decimal(stage2?.[0]?.wasteCost as any).toString(),
      },
    };
  }
}


