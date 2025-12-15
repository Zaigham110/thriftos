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
exports.GradingReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let GradingReportsService = class GradingReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async gradeDistribution(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
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
      `, tenantId, start ?? new Date(0), end ?? new Date(), filters.categoryId ?? null, filters.gradeId ?? null, filters.workerId ?? null);
        return rows.map((r) => ({
            categoryId: r.categoryId,
            gradeId: r.gradeId,
            gradeWeightKg: new library_1.Decimal(r.gradeWeightKg).toString(),
            gradePct: new library_1.Decimal(r.gradePct).mul(100).toFixed(2),
            gradeCost: new library_1.Decimal(r.gradeCost).toString(),
            costPerKg: new library_1.Decimal(r.costPerKg).toString(),
        }));
    }
    async gradingLoss(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
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
      `, tenantId, start ?? new Date(0), end ?? new Date(), filters.categoryId ?? null, filters.workerId ?? null);
        return rows.map((r) => {
            const input = new library_1.Decimal(r.inputWeightKg);
            const waste = new library_1.Decimal(r.wasteWeightKg);
            const pct = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : waste.div(input).mul(100);
            return {
                categoryId: r.categoryId,
                inputWeightKg: input.toString(),
                wasteWeightKg: waste.toString(),
                wastePct: pct.toFixed(2),
                wasteCost: new library_1.Decimal(r.wasteCost).toString(),
            };
        });
    }
};
exports.GradingReportsService = GradingReportsService;
exports.GradingReportsService = GradingReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradingReportsService);
//# sourceMappingURL=grading-reports.service.js.map