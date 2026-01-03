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
const reports_consistency_service_1 = require("../common/reports-consistency.service");
let RepackReportsService = class RepackReportsService {
    constructor(prisma, consistency) {
        this.prisma = prisma;
        this.consistency = consistency;
    }
    async repackEfficiency(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const conditions = ['u."tenantId" = $1', 'rs."status" = \'CLOSED\''];
        const params = [tenantId];
        let paramIndex = 2;
        if (start) {
            conditions.push(`rs."startTime" >= $${paramIndex}`);
            params.push(start);
            paramIndex++;
        }
        if (end) {
            conditions.push(`rs."startTime" <= $${paramIndex}`);
            params.push(end);
            paramIndex++;
        }
        if (filters.categoryId) {
            conditions.push(`u."categoryId" = $${paramIndex}`);
            params.push(filters.categoryId);
            paramIndex++;
        }
        if (filters.gradeId) {
            conditions.push(`u."gradeId" = $${paramIndex}`);
            params.push(filters.gradeId);
            paramIndex++;
        }
        if (filters.workerId) {
            conditions.push(`rs."workerId" = $${paramIndex}`);
            params.push(filters.workerId);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH units AS (
        SELECT
          date_trunc('day', COALESCE(rs."endTime", rs."startTime")) AS "day",
          SUM(u."weightKg") AS "repackOutputWeightKg",
          COUNT(*)::int AS "unitsProduced",
          AVG(u."weightKg") AS "avgUnitWeightKg"
        FROM "RepackUnit" u
        JOIN "RepackSession" rs ON rs."id" = u."repackSessionId"
        WHERE ${whereClause}
        GROUP BY 1
      ),
      inputs AS (
        SELECT
          date_trunc('day', COALESCE(rs."endTime", rs."startTime")) AS "day",
          SUM(ri."weightKg") AS "gradeInputWeightKg"
        FROM "RepackItem" ri
        JOIN "RepackUnit" u ON u."id" = ri."repackUnitId"
        JOIN "RepackSession" rs ON rs."id" = u."repackSessionId"
        WHERE ${whereClause}
          AND ri."sourceType" = 'GRADE_OUTPUT'
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
      `, ...params);
        return rows.map((r) => ({
            day: r.day,
            gradeInputWeightKg: new library_1.Decimal(r.gradeInputWeightKg).toNumber(),
            repackOutputWeightKg: new library_1.Decimal(r.repackOutputWeightKg).toNumber(),
            unitsProduced: r.unitsProduced,
            avgUnitWeightKg: new library_1.Decimal(r.avgUnitWeightKg).toNumber(),
        }));
    }
    async repackSummary(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const conditions = ['u."tenantId" = $1'];
        const params = [tenantId];
        let idx = 2;
        if (start) {
            conditions.push(`u."createdAt" >= $${idx}`);
            params.push(start);
            idx++;
        }
        if (end) {
            conditions.push(`u."createdAt" <= $${idx}`);
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
        u."status"::text AS status,
        COUNT(*)::int AS units,
        COALESCE(SUM(u."weightKg"), 0)::float8 AS "totalWeightKg",
        COALESCE(SUM(u."pcsCount"), 0)::int AS "totalPcs",
        COALESCE(SUM(u."totalCost"), 0)::float8 AS "totalCost"
      FROM "RepackUnit" u
      WHERE ${whereClause}
      GROUP BY 1
      ORDER BY 1 ASC
      `, ...params);
        const data = rows.map((r) => ({
            status: r.status,
            units: Number(r.units ?? 0),
            totalWeightKg: Number(r.totalWeightKg ?? 0),
            totalPcs: Number(r.totalPcs ?? 0),
            totalCost: Number(r.totalCost ?? 0),
        }));
        return {
            data,
            summary: {
                totalUnits: data.reduce((sum, r) => sum + (r.units || 0), 0),
                totalWeightKg: data.reduce((sum, r) => sum + (r.totalWeightKg || 0), 0),
                totalPcs: data.reduce((sum, r) => sum + (r.totalPcs || 0), 0),
                totalCost: data.reduce((sum, r) => sum + (r.totalCost || 0), 0),
            },
        };
    }
    async skuProductionSummary(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
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
                weightKg: u.weightKg.toNumber(),
                pcsCount: u.pcsCount,
                totalCost: u.totalCost.toNumber(),
                createdAt: u.createdAt,
            })),
        };
    }
};
exports.RepackReportsService = RepackReportsService;
exports.RepackReportsService = RepackReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reports_consistency_service_1.ReportsConsistencyService])
], RepackReportsService);
//# sourceMappingURL=repack-reports.service.js.map