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
exports.RepackReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let RepackReportsService = class RepackReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async repackEfficiency(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
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
      `, tenantId, start ?? new Date(0), end ?? new Date(), filters.categoryId ?? null, filters.gradeId ?? null, filters.workerId ?? null);
        return rows.map((r) => ({
            day: r.day,
            gradeInputWeightKg: new library_1.Decimal(r.gradeInputWeightKg).toString(),
            repackOutputWeightKg: new library_1.Decimal(r.repackOutputWeightKg).toString(),
            unitsProduced: r.unitsProduced,
            avgUnitWeightKg: new library_1.Decimal(r.avgUnitWeightKg).toString(),
        }));
    }
    async skuProductionSummary(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 50, 200);
        const skip = (page - 1) * limit;
        const where = {
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
};
exports.RepackReportsService = RepackReportsService;
exports.RepackReportsService = RepackReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RepackReportsService);
//# sourceMappingURL=repack-reports.service.js.map