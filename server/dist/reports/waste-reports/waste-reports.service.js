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
exports.WasteReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let WasteReportsService = class WasteReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async wasteByStage(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const procurement = await this.prisma.$queryRawUnsafe(`
      WITH per_container AS (
        SELECT
          c."id" AS "containerId",
          COALESCE(c."netWeight", 0) AS "netWeight",
          COALESCE(SUM(r."weightKg"), 0) AS "ragWeight"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        LEFT JOIN "Rag" r ON r."containerId" = c."id"
        WHERE po."tenantId" = $1
          ${start ? `AND c."createdAt" >= $2` : ``}
          ${end ? `AND c."createdAt" <= $3` : ``}
        GROUP BY c."id", c."netWeight"
      )
      SELECT COALESCE(SUM(("netWeight" - "ragWeight")), 0) AS "wasteKg"
      FROM per_container
      `, tenantId, start ?? new Date(0), end ?? new Date());
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
        const stage2 = await this.prisma.$queryRawUnsafe(`
      WITH session_out AS (
        SELECT
          gs."id" AS "gradeSessionId",
          co."weightKg" AS "inputWeight",
          COALESCE(SUM(go."weightKg"), 0) AS "outputWeight"
        FROM "GradeSession" gs
        JOIN "CategoryOutput" co ON co."id" = gs."categoryOutputId"
        LEFT JOIN "GradeBucket" gb ON gb."gradeSessionId" = gs."id"
        LEFT JOIN "GradeOutput" go ON go."gradeBucketId" = gb."id"
        WHERE gs."tenantId" = $1
          AND gs."status" = 'CLOSED'
          ${start ? `AND gs."startTime" >= $2` : ``}
          ${end ? `AND gs."startTime" <= $3` : ``}
        GROUP BY gs."id", co."weightKg"
      )
      SELECT COALESCE(SUM(("inputWeight" - "outputWeight")), 0) AS "wasteKg"
      FROM session_out
      `, tenantId, start ?? new Date(0), end ?? new Date());
        return {
            procurementWasteKg: new library_1.Decimal(procurement?.[0]?.wasteKg).toString(),
            sortingStage1WasteKg: (stage1._sum.wasteWeight ?? new library_1.Decimal(0)).toString(),
            gradingStage2WasteKg: new library_1.Decimal(stage2?.[0]?.wasteKg).toString(),
        };
    }
    async wasteCostImpact(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const procurement = await this.prisma.$queryRawUnsafe(`
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
        WHERE po."tenantId" = $1
          ${start ? `AND c."createdAt" >= $2` : ``}
          ${end ? `AND c."createdAt" <= $3` : ``}
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
      `, tenantId, start ?? new Date(0), end ?? new Date());
        const stage1 = await this.prisma.$queryRawUnsafe(`
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
        WHERE s."tenantId" = $1
          AND s."status" = 'CLOSED'
          ${start ? `AND s."startTime" >= $2` : ``}
          ${end ? `AND s."startTime" <= $3` : ``}
        GROUP BY s."id", s."wasteWeight", s."ragId", s."incomingBaleId", r."allocatedCost", b."cost"
      )
      SELECT
        COALESCE(SUM("wasteKg"), 0) AS "wasteKg",
        COALESCE(SUM(("inputCost" - "outputCost")), 0) AS "wasteCost"
      FROM per_session
      `, tenantId, start ?? new Date(0), end ?? new Date());
        const stage2 = await this.prisma.$queryRawUnsafe(`
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
        WHERE gs."tenantId" = $1
          AND gs."status" = 'CLOSED'
          ${start ? `AND gs."startTime" >= $2` : ``}
          ${end ? `AND gs."startTime" <= $3` : ``}
        GROUP BY gs."id", co."weightKg", co."allocatedCost"
      )
      SELECT
        COALESCE(SUM(("inputWeightKg" - "outputWeightKg")), 0) AS "wasteKg",
        COALESCE(SUM(("inputCost" - "outputCost")), 0) AS "wasteCost"
      FROM per_session
      `, tenantId, start ?? new Date(0), end ?? new Date());
        return {
            procurement: {
                wasteKg: new library_1.Decimal(procurement?.[0]?.wasteKg).toString(),
                wasteCost: new library_1.Decimal(procurement?.[0]?.wasteCost).toString(),
            },
            sortingStage1: {
                wasteKg: new library_1.Decimal(stage1?.[0]?.wasteKg).toString(),
                wasteCost: new library_1.Decimal(stage1?.[0]?.wasteCost).toString(),
            },
            gradingStage2: {
                wasteKg: new library_1.Decimal(stage2?.[0]?.wasteKg).toString(),
                wasteCost: new library_1.Decimal(stage2?.[0]?.wasteCost).toString(),
            },
        };
    }
};
exports.WasteReportsService = WasteReportsService;
exports.WasteReportsService = WasteReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WasteReportsService);
//# sourceMappingURL=waste-reports.service.js.map