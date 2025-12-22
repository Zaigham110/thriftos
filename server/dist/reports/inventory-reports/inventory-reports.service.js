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
exports.InventoryReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let InventoryReportsService = class InventoryReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async inventorySnapshot(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const conditions = ['i."tenantId" = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (start) {
            conditions.push(`i."createdAt" >= $${paramIndex}`);
            params.push(start);
            paramIndex++;
        }
        if (end) {
            conditions.push(`i."createdAt" <= $${paramIndex}`);
            params.push(end);
            paramIndex++;
        }
        if (filters.warehouseId) {
            conditions.push(`i."warehouseId" = $${paramIndex}`);
            params.push(filters.warehouseId);
            paramIndex++;
        }
        if (filters.categoryId) {
            conditions.push(`i."categoryId" = $${paramIndex}`);
            params.push(filters.categoryId);
            paramIndex++;
        }
        if (filters.gradeId) {
            conditions.push(`i."gradeId" = $${paramIndex}`);
            params.push(filters.gradeId);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe(`
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
      WHERE ${whereClause}
      GROUP BY i."warehouseId", i."categoryId", i."gradeId", i."status"
      ORDER BY i."warehouseId" ASC, i."categoryId" ASC, i."gradeId" ASC, i."status" ASC
      `, ...params);
        return rows.map((r) => ({
            warehouseId: r.warehouseId,
            categoryId: r.categoryId,
            gradeId: r.gradeId,
            status: r.status,
            items: r.items,
            weightKg: new library_1.Decimal(r.weightKg).toString(),
            pcsCount: r.pcsCount,
            costLocked: new library_1.Decimal(r.costLocked).toString(),
        }));
    }
    async inventoryAging(tenantId, filters) {
        const asOf = filters.asOfDate ? new Date(filters.asOfDate) : new Date();
        if (isNaN(asOf.getTime()))
            throw new Error('Invalid asOfDate');
        const conditions = ['i."tenantId" = $1'];
        const params = [tenantId, asOf];
        let paramIndex = 3;
        if (filters.warehouseId) {
            conditions.push(`i."warehouseId" = $${paramIndex}`);
            params.push(filters.warehouseId);
            paramIndex++;
        }
        if (filters.categoryId) {
            conditions.push(`i."categoryId" = $${paramIndex}`);
            params.push(filters.categoryId);
            paramIndex++;
        }
        if (filters.gradeId) {
            conditions.push(`i."gradeId" = $${paramIndex}`);
            params.push(filters.gradeId);
            paramIndex++;
        }
        const whereClause = conditions.join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          i.*,
          EXTRACT(DAY FROM ($2::timestamptz - i."createdAt"))::int AS "ageDays",
          (i."avgCost" * (CASE WHEN i."pcsCount" > 0 THEN i."pcsCount" ELSE i."weightKg" END)) AS "lockedCost"
        FROM "InventoryItem" i
        WHERE ${whereClause}
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
      `, ...params);
        return rows.map((r) => ({
            bucket: r.bucket,
            items: r.items,
            weightKg: new library_1.Decimal(r.weightKg).toString(),
            pcsCount: r.pcsCount,
            costLocked: new library_1.Decimal(r.costLocked).toString(),
        }));
    }
};
exports.InventoryReportsService = InventoryReportsService;
exports.InventoryReportsService = InventoryReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryReportsService);
//# sourceMappingURL=inventory-reports.service.js.map