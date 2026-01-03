"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
const reports_consistency_service_1 = require("../common/reports-consistency.service");
let CostReportsService = class CostReportsService {
    constructor(prisma, consistency) {
        this.prisma = prisma;
        this.consistency = consistency;
    }
    async costCascade(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const procurement = await this.prisma.$queryRawUnsafe(`
      WITH rags AS (
        SELECT
          COALESCE(SUM(r."allocatedCost"), 0) AS "totalCost",
          COALESCE(SUM(r."weightKg"), 0) AS "totalWeightKg"
        FROM "Rag" r
        JOIN "Container" c ON c."id" = r."containerId"
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        WHERE po."tenantId" = $1
          AND ($2::timestamptz IS NULL OR r."createdAt" >= $2)
          AND ($3::timestamptz IS NULL OR r."createdAt" <= $3)
      ),
      bales AS (
        SELECT
          COALESCE(SUM(b."cost"), 0) AS "totalCost",
          COALESCE(SUM(b."weightKg"), 0) AS "totalWeightKg"
        FROM "IncomingBale" b
        WHERE b."tenantId" = $1
          AND b."containerId" IS NULL
          AND ($2::timestamptz IS NULL OR b."createdAt" >= $2)
          AND ($3::timestamptz IS NULL OR b."createdAt" <= $3)
      )
      SELECT
        (rags."totalCost" + bales."totalCost") AS "totalCost",
        (rags."totalWeightKg" + bales."totalWeightKg") AS "totalWeightKg"
      FROM rags, bales
      `, tenantId, start ?? null, end ?? null);
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
        const inventoryAgg = await this.prisma.$queryRawUnsafe(`
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
      `, tenantId, start ?? null, end ?? null, filters.warehouseId ?? null, filters.categoryId ?? null, filters.gradeId ?? null);
        const procurementCost = new library_1.Decimal(procurement?.[0]?.totalCost);
        const procurementWeight = new library_1.Decimal(procurement?.[0]?.totalWeightKg);
        const catCost = categoryAgg._sum.allocatedCost ?? new library_1.Decimal(0);
        const catWeight = categoryAgg._sum.weightKg ?? new library_1.Decimal(0);
        const gradeCost = gradeAgg._sum.allocatedCost ?? new library_1.Decimal(0);
        const gradeWeight = gradeAgg._sum.weightKg ?? new library_1.Decimal(0);
        const repackCost = repackAgg._sum.totalCost ?? new library_1.Decimal(0);
        const repackWeight = repackAgg._sum.weightKg ?? new library_1.Decimal(0);
        const repackPcs = repackAgg._sum.pcsCount ?? 0;
        const invLockedCost = new library_1.Decimal(inventoryAgg?.[0]?.lockedCost);
        const invKg = new library_1.Decimal(inventoryAgg?.[0]?.denomKg);
        const invPcs = Number(inventoryAgg?.[0]?.denomPcs ?? 0);
        const avg = (cost, denom) => (denom.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : cost.div(denom));
        return {
            procurement: {
                totalCost: procurementCost.toNumber(),
                weightKg: procurementWeight.toNumber(),
                costPerKg: avg(procurementCost, procurementWeight).toNumber(),
            },
            sorting: {
                totalCost: catCost.toNumber(),
                weightKg: catWeight.toNumber(),
                costPerKg: avg(catCost, catWeight).toNumber(),
            },
            grading: {
                totalCost: gradeCost.toNumber(),
                weightKg: gradeWeight.toNumber(),
                costPerKg: avg(gradeCost, gradeWeight).toNumber(),
            },
            repack: {
                totalCost: repackCost.toNumber(),
                weightKg: repackWeight.toNumber(),
                costPerKg: avg(repackCost, repackWeight).toNumber(),
            },
            final: {
                totalCost: invLockedCost.toNumber(),
                weightKg: invKg.toNumber(),
                costPerKg: avg(invLockedCost, invKg).toNumber(),
            },
        };
    }
    async profitabilityReadiness(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
      SELECT
        i."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        i."gradeId" AS "gradeId",
        g."name" AS "gradeName",
        COUNT(*)::int AS "unitsReady",
        COALESCE(SUM(i."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(i."avgCost" * i."weightKg"), 0) AS "totalCost",
        CASE WHEN COALESCE(SUM(i."weightKg"), 0) = 0 THEN 0 ELSE (COALESCE(SUM(i."avgCost" * i."weightKg"), 0) / COALESCE(SUM(i."weightKg"), 0)) END AS "avgCostPerKg"
      FROM "InventoryItem" i
      JOIN "Category" c ON c."id" = i."categoryId"
      JOIN "Grade" g ON g."id" = i."gradeId"
      WHERE i."tenantId" = $1
        AND i."status" = 'AVAILABLE'
        AND i."pcsCount" = 0
        AND ($2::timestamptz IS NULL OR i."createdAt" >= $2)
        AND ($3::timestamptz IS NULL OR i."createdAt" <= $3)
        AND ($4::text IS NULL OR i."warehouseId" = $4)
        AND ($5::text IS NULL OR i."categoryId" = $5)
        AND ($6::text IS NULL OR i."gradeId" = $6)
      GROUP BY i."categoryId", c."name", i."gradeId", g."name"
      ORDER BY c."name" ASC, g."name" ASC
      `, tenantId, start ?? null, end ?? null, filters.warehouseId ?? null, filters.categoryId ?? null, filters.gradeId ?? null);
        return {
            data: rows.map((r) => ({
                categoryId: r.categoryId,
                categoryName: r.categoryName,
                gradeId: r.gradeId,
                gradeName: r.gradeName,
                unitsReady: Number(r.unitsReady ?? 0),
                totalWeightKg: new library_1.Decimal(r.totalWeightKg).toNumber(),
                totalCost: new library_1.Decimal(r.totalCost).toNumber(),
                avgCostPerKg: new library_1.Decimal(r.avgCostPerKg).toNumber(),
            })),
        };
    }
    async finalProductCostReport(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const conditions = ['u."tenantId" = $1', 'u."status" = \'SEALED\''];
        const params = [tenantId];
        let idx = 2;
        if (start) {
            conditions.push(`u."updatedAt" >= $${idx}`);
            params.push(start);
            idx++;
        }
        if (end) {
            conditions.push(`u."updatedAt" <= $${idx}`);
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
        const rows = await this.prisma.$queryRawUnsafe(`
      SELECT
        u."id" AS "repackUnitId",
        u."unitCode" AS "productCode",
        u."unitType"::text AS "unitType",
        u."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        u."gradeId" AS "gradeId",
        g."name" AS "gradeName",
        COALESCE(u."weightKg", 0)::float8 AS "weightKg",
        COALESCE(u."pcsCount", 0)::int AS "pcsCount",
        COALESCE(u."totalCost", 0) AS "totalCost",
        COALESCE(SUM(ria."allocatedCost"), 0) AS "allocationsCost",
        COUNT(ria."id")::int AS "allocationsCount",
        COUNT(DISTINCT ria."containerId") FILTER (WHERE ria."containerId" IS NOT NULL)::int AS "sourceContainers",
        COUNT(DISTINCT ria."ragBaleId") FILTER (WHERE r."sourceType" = 'LOOSE_BALE')::int AS "sourceBales",
        u."updatedAt" AS "sealedAt"
      FROM "RepackUnit" u
      LEFT JOIN "Category" c ON c."id" = u."categoryId"
      LEFT JOIN "Grade" g ON g."id" = u."gradeId"
      LEFT JOIN "RepackInputAllocation" ria ON ria."repackUnitId" = u."id"
      LEFT JOIN "Rag" r ON r."id" = ria."ragBaleId"
      WHERE ${whereClause}
      GROUP BY u."id", c."name", g."name"
      ORDER BY u."updatedAt" DESC
      LIMIT 5000
      `, ...params);
        const data = rows.map((r) => {
            const allocCost = new library_1.Decimal(r.allocationsCost);
            const cost = new library_1.Decimal(r.totalCost);
            const weight = new library_1.Decimal(r.weightKg);
            const pcs = Number(r.pcsCount ?? 0);
            const costPerKg = weight.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : allocCost.div(weight);
            const costPerUnit = pcs <= 0 ? new library_1.Decimal(0) : allocCost.div(new library_1.Decimal(pcs));
            return {
                repackUnitId: r.repackUnitId,
                productCode: r.productCode,
                unitType: r.unitType,
                categoryId: r.categoryId,
                category: r.categoryName,
                gradeId: r.gradeId,
                grade: r.gradeName,
                totalWeightKg: weight.toNumber(),
                totalQty: pcs,
                totalCost: allocCost.toNumber(),
                repackUnitTotalCost: cost.toNumber(),
                costPerKg: costPerKg.toNumber(),
                costPerUnit: costPerUnit.toNumber(),
                sourceContainers: Number(r.sourceContainers ?? 0),
                sourceBales: Number(r.sourceBales ?? 0),
                allocationsCount: Number(r.allocationsCount ?? 0),
                dateSealed: r.sealedAt.toISOString(),
            };
        });
        return {
            data,
            summary: {
                totalUnits: data.length,
                totalWeightKg: data.reduce((sum, r) => sum + (r.totalWeightKg || 0), 0),
                totalCost: data.reduce((sum, r) => sum + (r.totalCost || 0), 0),
            },
        };
    }
};
exports.CostReportsService = CostReportsService;
exports.CostReportsService = CostReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reports_consistency_service_1.ReportsConsistencyService])
], CostReportsService);
//# sourceMappingURL=cost-reports.service.js.map