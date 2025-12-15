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
exports.ProcurementReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const report_utils_1 = require("../common/report-utils");
let ProcurementReportsService = class ProcurementReportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async containerCostBreakdown(tenantId, containerId) {
        const container = await this.prisma.container.findFirst({
            where: { id: containerId, purchaseOrder: { tenantId } },
            include: {
                containerCharges: true,
                rags: true,
                purchaseOrder: { select: { id: true, poNumber: true, vendorId: true } },
            },
        });
        if (!container)
            throw new common_1.NotFoundException('Container not found');
        const totalCharges = container.containerCharges.reduce((sum, c) => sum.add(c.amount), new library_1.Decimal(0));
        const costPerKg = container.netWeight && !container.netWeight.equals(new library_1.Decimal(0))
            ? totalCharges.div(container.netWeight)
            : new library_1.Decimal(0);
        const ragAllocations = container.rags.map((r) => ({
            ragId: r.id,
            ragCode: r.ragCode,
            weightKg: r.weightKg.toString(),
            allocatedCost: r.allocatedCost.toString(),
            costPerKg: r.weightKg.equals(new library_1.Decimal(0)) ? '0' : r.allocatedCost.div(r.weightKg).toString(),
        }));
        return {
            containerId: container.id,
            containerNumber: container.containerNumber,
            purchaseOrderId: container.purchaseOrderId,
            poNumber: container.purchaseOrder.poNumber,
            netWeightKg: container.netWeight?.toString() ?? null,
            totalCost: totalCharges.toString(),
            costPerKg: costPerKg.toString(),
            charges: container.containerCharges.map((c) => ({
                id: c.id,
                type: c.chargeType,
                description: c.description,
                amount: c.amount.toString(),
            })),
            ragAllocations,
        };
    }
    async vendorProcurementSummary(tenantId, filters) {
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH container_rags AS (
        SELECT
          po."vendorId" AS "vendorId",
          SUM(r."weightKg") AS "weightKg",
          SUM(r."allocatedCost") AS "cost"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        JOIN "Rag" r ON r."containerId" = c."id"
        WHERE po."tenantId" = $1
          AND po."vendorId" IS NOT NULL
          ${start ? `AND r."createdAt" >= $2` : ``}
          ${end ? `AND r."createdAt" <= $3` : ``}
        GROUP BY po."vendorId"
      ),
      loose_bales AS (
        SELECT
          b."vendorId" AS "vendorId",
          SUM(b."weightKg") AS "weightKg",
          SUM(b."cost") AS "cost"
        FROM "IncomingBale" b
        WHERE b."tenantId" = $1
          AND b."vendorId" IS NOT NULL
          AND b."containerId" IS NULL
          ${start ? `AND b."createdAt" >= $2` : ``}
          ${end ? `AND b."createdAt" <= $3` : ``}
        GROUP BY b."vendorId"
      ),
      combined AS (
        SELECT * FROM container_rags
        UNION ALL
        SELECT * FROM loose_bales
      )
      SELECT
        v."id" AS "vendorId",
        v."name" AS "vendorName",
        COALESCE(SUM(combined."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(combined."cost"), 0) AS "totalCost"
      FROM "Vendor" v
      LEFT JOIN combined ON combined."vendorId" = v."id"
      WHERE v."tenantId" = $1
      GROUP BY v."id", v."name"
      ORDER BY v."name" ASC
      `, tenantId, start ?? new Date(0), end ?? new Date());
        return rows.map((r) => {
            const weight = new library_1.Decimal(r.totalWeightKg);
            const cost = new library_1.Decimal(r.totalCost);
            const avg = weight.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : cost.div(weight);
            return {
                vendorId: r.vendorId,
                vendorName: r.vendorName,
                totalWeightKg: weight.toString(),
                totalCost: cost.toString(),
                avgCostPerKg: avg.toString(),
            };
        });
    }
};
exports.ProcurementReportsService = ProcurementReportsService;
exports.ProcurementReportsService = ProcurementReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProcurementReportsService);
//# sourceMappingURL=procurement-reports.service.js.map