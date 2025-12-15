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
exports.SortingReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let SortingReportsService = class SortingReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async categoryYieldReport(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH buckets AS (
        SELECT
          b."categoryId" AS "categoryId",
          b."outputWeightKg" AS "bucketOutput",
          s."totalInputWeight" AS "input",
          s."wasteWeight" AS "waste",
          s."totalOutputWeight" AS "totalOutput"
        FROM "SortCategoryBucket" b
        JOIN "SortSession" s ON s."id" = b."sortSessionId"
        WHERE s."tenantId" = $1
          AND s."status" = 'CLOSED'
          ${start ? `AND s."startTime" >= $2` : ``}
          ${end ? `AND s."startTime" <= $3` : ``}
          ${filters.categoryId ? `AND b."categoryId" = $4` : ``}
          ${filters.workerId ? `AND s."workerId" = $5` : ``}
      )
      SELECT
        "categoryId",
        COALESCE(SUM("bucketOutput"), 0) AS "outputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "input" * ("bucketOutput" / "totalOutput") END), 0) AS "inputWeightKg",
        COALESCE(SUM(CASE WHEN "totalOutput" = 0 THEN 0 ELSE "waste" * ("bucketOutput" / "totalOutput") END), 0) AS "wasteWeightKg"
      FROM buckets
      GROUP BY "categoryId"
      ORDER BY "categoryId" ASC
      `, tenantId, start ?? new Date(0), end ?? new Date(), filters.categoryId ?? null, filters.workerId ?? null);
        return rows.map((r) => {
            const input = new library_1.Decimal(r.inputWeightKg);
            const output = new library_1.Decimal(r.outputWeightKg);
            const waste = new library_1.Decimal(r.wasteWeightKg);
            const yieldPct = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : output.div(input).mul(100);
            return {
                categoryId: r.categoryId,
                inputWeightKg: input.toString(),
                outputWeightKg: output.toString(),
                wasteWeightKg: waste.toString(),
                yieldPct: yieldPct.toFixed(2),
            };
        });
    }
    async sortingEfficiency(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
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
            const input = g._sum.totalInputWeight ?? new library_1.Decimal(0);
            const output = g._sum.totalOutputWeight ?? new library_1.Decimal(0);
            const waste = g._sum.wasteWeight ?? new library_1.Decimal(0);
            const avgYield = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : output.div(input).mul(100);
            const avgWastePct = input.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : waste.div(input).mul(100);
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
};
exports.SortingReportsService = SortingReportsService;
exports.SortingReportsService = SortingReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SortingReportsService);
//# sourceMappingURL=sorting-reports.service.js.map