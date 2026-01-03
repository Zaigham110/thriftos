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
exports.ReportsConsistencyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ReportsConsistencyService = class ReportsConsistencyService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertTenantIsReportable(tenantId) {
        const checks = [
            {
                name: 'sortSession.closed_negative_weights',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "SortSession" s
					WHERE s."tenantId" = $1
						AND s."status" = 'CLOSED'
						AND (s."totalInputWeight" < 0 OR s."totalOutputWeight" < 0 OR s."wasteWeight" < 0)
				`,
                params: [tenantId],
            },
            {
                name: 'sortSession.closed_output_plus_waste_gt_input',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "SortSession" s
					WHERE s."tenantId" = $1
						AND s."status" = 'CLOSED'
						AND (s."totalOutputWeight" + s."wasteWeight") > (s."totalInputWeight" + 0.01)
				`,
                params: [tenantId],
            },
            {
                name: 'sortSession.closed_waste_unaccounted',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "SortSession" s
					WHERE s."tenantId" = $1
						AND s."status" = 'CLOSED'
						AND s."wasteWeight" > 0
						AND NOT EXISTS (
							SELECT 1 FROM "SortingWaste" sw
							WHERE sw."tenantId" = s."tenantId" AND sw."sortSessionId" = s."id"
						)
						AND NOT EXISTS (
							SELECT 1 FROM "WasteLineItem" wli
							WHERE wli."tenantId" = s."tenantId" AND wli."sortSessionId" = s."id" AND wli."stage" = 'STAGE_1'
						)
				`,
                params: [tenantId],
            },
            {
                name: 'gradeOutput.remainingAmount_mismatch_total_minus_used',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "GradeOutput" go
					WHERE go."tenantId" = $1
						AND ABS((go."remainingAmount" - (go."totalAmount" - go."usedAmount"))::numeric) > 0.0001
				`,
                params: [tenantId],
            },
            {
                name: 'gradeOutput.usedAmount_mismatch_allocations',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "GradeOutput" go
					LEFT JOIN (
						SELECT ria."gradingOutputId" AS id, COALESCE(SUM(ria."amountUsed"),0) AS used
						FROM "RepackInputAllocation" ria
						WHERE ria."tenantId" = $1
						GROUP BY ria."gradingOutputId"
					) a ON a.id = go."id"
					WHERE go."tenantId" = $1
						AND ABS((go."usedAmount" - a.used)::numeric) > 0.0001
				`,
                params: [tenantId],
            },
            {
                name: 'gradeOutput.status_incompatible_with_amounts',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "GradeOutput" go
					WHERE go."tenantId" = $1
						AND (
							(go."remainingAmount" <= 0.0001 AND go."status" <> 'DEPLETED') OR
							(go."usedAmount" > 0 AND go."remainingAmount" > 0.0001 AND go."status" <> 'PARTIALLY_USED') OR
							(go."usedAmount" = 0 AND go."remainingAmount" = go."totalAmount" AND go."status" NOT IN ('AVAILABLE','READY_FOR_REPACK'))
						)
				`,
                params: [tenantId],
            },
            {
                name: 'repackUnit.totalCost_mismatch_allocations',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "RepackUnit" u
					LEFT JOIN (
						SELECT ria."repackUnitId" AS id, COALESCE(SUM(ria."allocatedCost"),0) AS cost
						FROM "RepackInputAllocation" ria
						WHERE ria."tenantId" = $1
						GROUP BY ria."repackUnitId"
					) a ON a.id = u."id"
					WHERE u."tenantId" = $1
						AND ABS((u."totalCost" - a.cost)::numeric) > 0.01
				`,
                params: [tenantId],
            },
            {
                name: 'inventoryItem.negative_avgCost_or_amount',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "InventoryItem" i
					WHERE i."tenantId" = $1
						AND (i."avgCost" < 0 OR i."weightKg" < 0 OR i."pcsCount" < 0)
				`,
                params: [tenantId],
            },
            {
                name: 'inventoryItem.non_positive_cost_with_quantity',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "InventoryItem" i
					WHERE i."tenantId" = $1
						AND (i."weightKg" > 0 OR i."pcsCount" > 0)
						AND i."avgCost" <= 0
				`,
                params: [tenantId],
            },
            {
                name: 'repackUnit.sealed_without_inventory',
                sql: `
					SELECT COUNT(*)::int AS count
					FROM "RepackUnit" u
					WHERE u."tenantId" = $1
						AND u."status" = 'SEALED'
						AND NOT EXISTS (
							SELECT 1 FROM "InventoryItem" i WHERE i."repackUnitId" = u."id"
						)
				`,
                params: [tenantId],
            },
        ];
        const results = [];
        for (const c of checks) {
            const rows = await this.prisma.$queryRawUnsafe(c.sql, ...c.params);
            results.push({ check: c.name, count: Number(rows?.[0]?.count ?? 0) });
        }
        const failing = results.filter((r) => r.count > 0);
        if (failing.length === 0)
            return;
        throw new common_1.ConflictException({
            message: 'Reporting blocked due to data integrity violations.',
            failingChecks: failing,
        });
    }
};
exports.ReportsConsistencyService = ReportsConsistencyService;
exports.ReportsConsistencyService = ReportsConsistencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsConsistencyService);
//# sourceMappingURL=reports-consistency.service.js.map