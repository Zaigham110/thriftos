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
exports.ProcurementDashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../../reports/common/report-utils");
function toIsoDate(d) {
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return utc.toISOString().slice(0, 10);
}
function startOfTodayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function addDays(d, days) {
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() + days);
    return out;
}
let ProcurementDashboardService = class ProcurementDashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    resolveRange(filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const effectiveEnd = end ?? startOfTodayUtc();
        const effectiveStart = start ?? addDays(effectiveEnd, -29);
        return { start: effectiveStart, end: effectiveEnd, startDate: toIsoDate(effectiveStart), endDate: toIsoDate(effectiveEnd) };
    }
    async summary(tenantId, filters) {
        const range = this.resolveRange(filters);
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { currency: true },
        });
        const [activePos, inTransitContainers, looseBalesReceived] = await Promise.all([
            this.prisma.purchaseOrder.count({ where: { tenantId, status: 'OPEN' } }),
            this.prisma.container.count({ where: { tenantId, status: 'IN_TRANSIT' } }),
            this.prisma.incomingBale.count({
                where: {
                    tenantId,
                    containerId: null,
                    createdAt: { gte: range.start, lte: range.end },
                },
            }),
        ]);
        const budgetAgg = await this.prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(po."budgetCap"), 0) AS "totalBudgetCap",
        COALESCE(SUM(po."totalCost"), 0) AS "totalSpent"
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = $1
        AND po."status" = 'OPEN'
      `, tenantId);
        const totalBudgetCap = new library_1.Decimal(budgetAgg?.[0]?.totalBudgetCap ?? 0);
        const totalSpent = new library_1.Decimal(budgetAgg?.[0]?.totalSpent ?? 0);
        const remainingBudget = totalBudgetCap.sub(totalSpent);
        const activePoRows = await this.prisma.$queryRawUnsafe(`
      SELECT
        po."poNumber" AS "poNumber",
        po."totalCost" AS "totalCost",
        po."budgetCap" AS "budgetCap"
      FROM "PurchaseOrder" po
      WHERE po."tenantId" = $1
        AND po."status" = 'OPEN'
        AND po."budgetCap" IS NOT NULL
      ORDER BY po."createdAt" DESC
      LIMIT 10
      `, tenantId);
        const poUtilization = activePoRows.map((po) => {
            const cap = new library_1.Decimal(po.budgetCap ?? 0);
            const spent = new library_1.Decimal(po.totalCost ?? 0);
            const pct = cap.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : spent.div(cap).mul(100);
            return { label: po.poNumber, value: Number(pct.toFixed(2)) };
        });
        const vendorSpend = await this.prisma.$queryRawUnsafe(`
      SELECT
        v."id" AS "vendorId",
        v."name" AS "vendorName",
        COALESCE(SUM(po."totalCost"), 0) AS "totalCost"
      FROM "PurchaseOrder" po
      LEFT JOIN "Vendor" v ON v."id" = po."vendorId"
      WHERE po."tenantId" = $1
        AND po."createdAt" >= $2
        AND po."createdAt" <= $3
      GROUP BY v."id", v."name"
      ORDER BY COALESCE(SUM(po."totalCost"), 0) DESC
      LIMIT 8
      `, tenantId, range.start, range.end);
        const vendorTotal = vendorSpend.reduce((sum, r) => sum.add(new library_1.Decimal(r.totalCost)), new library_1.Decimal(0));
        const vendorDistribution = vendorSpend.map((r) => {
            const cost = new library_1.Decimal(r.totalCost);
            const sharePct = vendorTotal.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : cost.div(vendorTotal).mul(100);
            return {
                vendorId: r.vendorId,
                vendorName: r.vendorName ?? 'Unassigned',
                totalCost: cost.toString(),
                sharePct: Number(sharePct.toFixed(2)),
            };
        });
        return {
            range: { startDate: range.startDate, endDate: range.endDate },
            currency: tenant?.currency ?? 'USD',
            kpis: {
                activePos,
                remainingBudget: remainingBudget.toString(),
                containersInTransit: inTransitContainers,
                looseBalesReceived,
            },
            charts: {
                poSpendVsAllocated: poUtilization,
                vendorDistribution,
            },
            generatedAt: new Date().toISOString(),
        };
    }
};
exports.ProcurementDashboardService = ProcurementDashboardService;
exports.ProcurementDashboardService = ProcurementDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProcurementDashboardService);
//# sourceMappingURL=procurement-dashboard.service.js.map