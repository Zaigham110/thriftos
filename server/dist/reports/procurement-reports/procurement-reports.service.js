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
const reports_consistency_service_1 = require("../common/reports-consistency.service");
let ProcurementReportsService = class ProcurementReportsService {
    constructor(prisma, consistency) {
        this.prisma = prisma;
        this.consistency = consistency;
    }
    async containerCostBreakdown(tenantId, containerId) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const container = await this.prisma.container.findFirst({
            where: { id: containerId, purchaseOrder: { tenantId } },
            include: {
                containerCharges: true,
                purchaseOrder: { include: { vendor: { select: { id: true, name: true } } } },
            },
        });
        if (!container)
            throw new common_1.NotFoundException('Container not found');
        const sumBy = (types) => container.containerCharges
            .filter((c) => types.includes(c.chargeType))
            .reduce((acc, c) => acc.add(c.amount), new library_1.Decimal(0));
        const purchaseCost = sumBy(['CIF']);
        const shippingCost = sumBy(['FREIGHT', 'PORT_HANDLING']);
        const dutiesCost = sumBy(['DUTY', 'TAX']);
        const otherCosts = sumBy(['MISC']);
        const totalCost = container.containerCharges.reduce((acc, c) => acc.add(c.amount), new library_1.Decimal(0));
        const totalWeightKg = container.netWeight ?? new library_1.Decimal(0);
        const costPerKg = totalWeightKg.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : totalCost.div(totalWeightKg);
        return {
            containerId: container.id,
            containerCode: container.containerNumber,
            vendorName: container.purchaseOrder.vendor?.name ?? '—',
            landingDate: (container.clearedAt ?? container.arrivedAt ?? container.releasedAt ?? container.createdAt).toISOString(),
            purchaseCost: purchaseCost.toNumber(),
            shippingCost: shippingCost.toNumber(),
            dutiesCost: dutiesCost.toNumber(),
            otherCosts: otherCosts.toNumber(),
            totalCost: totalCost.toNumber(),
            totalWeightKg: totalWeightKg.toNumber(),
            costPerKg: costPerKg.toNumber(),
        };
    }
    async vendorProcurementSummary(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const ragConditions = ['po."tenantId" = $1', 'po."vendorId" IS NOT NULL'];
        const looseConditions = ['b."tenantId" = $1', 'b."vendorId" IS NOT NULL', 'b."containerId" IS NULL'];
        const ragParams = [tenantId];
        const looseParams = [tenantId];
        let ragIdx = 2;
        let looseIdx = 2;
        if (start) {
            ragConditions.push(`r."createdAt" >= $${ragIdx}`);
            ragParams.push(start);
            ragIdx++;
            looseConditions.push(`b."createdAt" >= $${looseIdx}`);
            looseParams.push(start);
            looseIdx++;
        }
        if (end) {
            ragConditions.push(`r."createdAt" <= $${ragIdx}`);
            ragParams.push(end);
            ragIdx++;
            looseConditions.push(`b."createdAt" <= $${looseIdx}`);
            looseParams.push(end);
            looseIdx++;
        }
        const ragWhere = ragConditions.join(' AND ');
        const looseWhere = looseConditions.join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH container_rags AS (
        SELECT
          po."vendorId" AS "vendorId",
          COUNT(DISTINCT c."id")::int AS "containers",
          SUM(r."weightKg") AS "weightKg",
          SUM(r."allocatedCost") AS "cost"
        FROM "Container" c
        JOIN "PurchaseOrder" po ON po."id" = c."purchaseOrderId"
        JOIN "Rag" r ON r."containerId" = c."id"
        WHERE ${ragWhere}
        GROUP BY po."vendorId"
      ),
      loose_bales AS (
        SELECT
          b."vendorId" AS "vendorId",
          0::int AS "containers",
          SUM(b."weightKg") AS "weightKg",
          SUM(b."cost") AS "cost"
        FROM "IncomingBale" b
        WHERE ${looseWhere}
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
        COALESCE(SUM(combined."containers"), 0)::int AS "totalContainers",
        COALESCE(SUM(combined."weightKg"), 0) AS "totalWeightKg",
        COALESCE(SUM(combined."cost"), 0) AS "totalCost"
      FROM "Vendor" v
      LEFT JOIN combined ON combined."vendorId" = v."id"
      WHERE v."tenantId" = $1
      GROUP BY v."id", v."name"
      ORDER BY v."name" ASC
      `, ...ragParams);
        return rows.map((r) => {
            const weight = new library_1.Decimal(r.totalWeightKg);
            const cost = new library_1.Decimal(r.totalCost);
            const avg = weight.equals(new library_1.Decimal(0)) ? new library_1.Decimal(0) : cost.div(weight);
            return {
                vendorId: r.vendorId,
                vendorName: r.vendorName,
                totalContainers: Number(r.totalContainers ?? 0),
                totalWeightKg: weight.toNumber(),
                totalCost: cost.toNumber(),
                avgCostPerKg: avg.toNumber(),
            };
        });
    }
    async procurementSummary(tenantId, filters) {
        await this.consistency.assertTenantIsReportable(tenantId);
        const { start, end } = (0, report_utils_1.parseDateRange)(filters);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
        const tenantCurrency = tenant?.currency ?? 'USD';
        const poConditions = ['po."tenantId" = $1'];
        const params = [tenantId];
        let idx = 2;
        if (start) {
            poConditions.push(`po."createdAt" >= $${idx}`);
            params.push(start);
            idx++;
        }
        if (end) {
            poConditions.push(`po."createdAt" <= $${idx}`);
            params.push(end);
            idx++;
        }
        const poWhere = poConditions.join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe(`
      WITH po_base AS (
        SELECT
          po."id" AS "purchaseOrderId",
          po."poNumber" AS "poNumber",
          po."poType" AS "poType",
          po."status" AS "status",
          po."currency" AS "currency",
          po."totalCost" AS "poTotalCost",
          po."createdAt" AS "createdAt",
          v."id" AS "vendorId",
          v."name" AS "vendorName"
        FROM "PurchaseOrder" po
        LEFT JOIN "Vendor" v ON v."id" = po."vendorId"
        WHERE ${poWhere}
      ),
      container_stats AS (
        SELECT
          c."purchaseOrderId" AS "purchaseOrderId",
          COUNT(*)::int AS "containerCount",
          COALESCE(SUM(c."netWeight"), 0) AS "containerWeightKg"
        FROM "Container" c
        JOIN po_base p ON p."purchaseOrderId" = c."purchaseOrderId"
        GROUP BY c."purchaseOrderId"
      ),
      container_cost AS (
        SELECT
          c."purchaseOrderId" AS "purchaseOrderId",
          COALESCE(SUM(ch."amount"), 0) AS "containerCost"
        FROM "Container" c
        JOIN po_base p ON p."purchaseOrderId" = c."purchaseOrderId"
        LEFT JOIN "ContainerCharge" ch ON ch."containerId" = c."id"
        GROUP BY c."purchaseOrderId"
      ),
      loose_bales AS (
        SELECT
          b."purchaseOrderId" AS "purchaseOrderId",
          COUNT(*)::int AS "looseBaleCount",
          COALESCE(SUM(b."weightKg"), 0) AS "looseBaleWeightKg",
          COALESCE(SUM(b."cost"), 0) AS "looseBaleCost"
        FROM "IncomingBale" b
        JOIN po_base p ON p."purchaseOrderId" = b."purchaseOrderId"
        WHERE b."tenantId" = $1
          AND b."purchaseOrderId" IS NOT NULL
          AND b."containerId" IS NULL
        GROUP BY b."purchaseOrderId"
      )
      SELECT
        p."purchaseOrderId",
        p."poNumber",
        p."poType",
        p."status",
        p."currency",
        p."poTotalCost",
        p."createdAt",
        p."vendorId",
        p."vendorName",
        COALESCE(cs."containerCount", 0)::int AS "containerCount",
        COALESCE(cs."containerWeightKg", 0) AS "containerWeightKg",
        COALESCE(cc."containerCost", 0) AS "containerCost",
        COALESCE(lb."looseBaleCount", 0)::int AS "looseBaleCount",
        COALESCE(lb."looseBaleWeightKg", 0) AS "looseBaleWeightKg",
        COALESCE(lb."looseBaleCost", 0) AS "looseBaleCost"
      FROM po_base p
      LEFT JOIN container_stats cs ON cs."purchaseOrderId" = p."purchaseOrderId"
      LEFT JOIN container_cost cc ON cc."purchaseOrderId" = p."purchaseOrderId"
      LEFT JOIN loose_bales lb ON lb."purchaseOrderId" = p."purchaseOrderId"
      ORDER BY p."createdAt" DESC
      `, ...params);
        const data = rows.map((r) => {
            const poTotalCost = new library_1.Decimal(r.poTotalCost);
            const containerCost = new library_1.Decimal(r.containerCost);
            const looseBaleCost = new library_1.Decimal(r.looseBaleCost);
            const computedCost = containerCost.add(looseBaleCost);
            const delta = poTotalCost.sub(computedCost);
            return {
                purchaseOrderId: r.purchaseOrderId,
                poNumber: r.poNumber,
                poType: r.poType,
                status: r.status,
                currency: r.currency,
                vendorId: r.vendorId,
                vendorName: r.vendorName ?? '—',
                createdAt: new Date(r.createdAt).toISOString(),
                containers: {
                    count: Number(r.containerCount ?? 0),
                    weightKg: new library_1.Decimal(r.containerWeightKg).toNumber(),
                    cost: containerCost.toNumber(),
                },
                looseBales: {
                    count: Number(r.looseBaleCount ?? 0),
                    weightKg: new library_1.Decimal(r.looseBaleWeightKg).toNumber(),
                    cost: looseBaleCost.toNumber(),
                },
                poTotalCost: poTotalCost.toNumber(),
                computedProcurementCost: computedCost.toNumber(),
                costDelta: delta.toNumber(),
                matchesPoTotal: delta.abs().lte(new library_1.Decimal(0.01)),
            };
        });
        const currencyMismatches = data.filter((r) => r.currency !== tenantCurrency);
        if (currencyMismatches.length > 0) {
            throw new common_1.ConflictException({
                message: 'Reporting blocked: purchase order currency mismatch with tenant currency.',
                tenantCurrency,
                mismatchedPurchaseOrders: currencyMismatches.map((r) => ({
                    purchaseOrderId: r.purchaseOrderId,
                    poNumber: r.poNumber,
                    poCurrency: r.currency,
                })),
            });
        }
        const poMismatches = data.filter((r) => !r.matchesPoTotal);
        if (poMismatches.length > 0) {
            throw new common_1.ConflictException({
                message: 'Reporting blocked: PO totalCost does not reconcile to containers + loose bales.',
                failingPurchaseOrders: poMismatches.map((r) => ({
                    purchaseOrderId: r.purchaseOrderId,
                    poNumber: r.poNumber,
                    poTotalCost: r.poTotalCost,
                    computedProcurementCost: r.computedProcurementCost,
                    costDelta: r.costDelta,
                })),
            });
        }
        const summary = data.reduce((acc, r) => {
            acc.totalPurchaseOrders += 1;
            acc.totalPoCost += r.poTotalCost;
            acc.totalContainers += r.containers.count;
            acc.totalContainerWeightKg += r.containers.weightKg;
            acc.totalContainerCost += r.containers.cost;
            acc.totalLooseBales += r.looseBales.count;
            acc.totalLooseBaleWeightKg += r.looseBales.weightKg;
            acc.totalLooseBaleCost += r.looseBales.cost;
            acc.totalComputedProcurementCost += r.computedProcurementCost;
            return acc;
        }, {
            currency: tenantCurrency,
            totalPurchaseOrders: 0,
            totalPoCost: 0,
            totalContainers: 0,
            totalContainerWeightKg: 0,
            totalContainerCost: 0,
            totalLooseBales: 0,
            totalLooseBaleWeightKg: 0,
            totalLooseBaleCost: 0,
            totalComputedProcurementCost: 0,
        });
        const avgCostPerKg = summary.totalContainerWeightKg + summary.totalLooseBaleWeightKg > 0
            ? summary.totalComputedProcurementCost / (summary.totalContainerWeightKg + summary.totalLooseBaleWeightKg)
            : 0;
        return {
            data,
            summary: {
                ...summary,
                avgCostPerKg,
            },
        };
    }
};
exports.ProcurementReportsService = ProcurementReportsService;
exports.ProcurementReportsService = ProcurementReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reports_consistency_service_1.ReportsConsistencyService])
], ProcurementReportsService);
//# sourceMappingURL=procurement-reports.service.js.map