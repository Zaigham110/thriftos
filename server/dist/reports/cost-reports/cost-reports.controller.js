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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const cost_reports_service_1 = require("./cost-reports.service");
let CostReportsController = class CostReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async cascade(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.cascade',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.costCascade(tenantId, filters) };
    }
    async cascadeExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.cascade',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.costCascade(tenantId, filters);
        const rows = [
            { stage: 'PROCUREMENT', totalCost: data.procurement.totalCost, totalWeightKg: data.procurement.weightKg, costPerKg: data.procurement.costPerKg },
            { stage: 'SORTING', totalCost: data.sorting.totalCost, totalWeightKg: data.sorting.weightKg, costPerKg: data.sorting.costPerKg },
            { stage: 'GRADING', totalCost: data.grading.totalCost, totalWeightKg: data.grading.weightKg, costPerKg: data.grading.costPerKg },
            { stage: 'REPACK', totalCost: data.repack.totalCost, totalWeightKg: data.repack.weightKg, costPerKg: data.repack.costPerKg },
            { stage: 'FINAL', totalCost: data.final.totalCost, totalWeightKg: data.final.weightKg, costPerKg: data.final.costPerKg },
        ];
        const csv = (0, report_utils_1.toCsv)(rows, ['stage', 'totalCost', 'totalWeightKg', 'costPerKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="cost-cascade.csv"');
        return res.status(200).send(csv);
    }
    async readiness(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.readiness',
            exported: false,
            params: { ...filters },
        });
        return await this.service.profitabilityReadiness(tenantId, filters);
    }
    async readinessExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.readiness',
            exported: true,
            params: { ...filters },
        });
        const result = await this.service.profitabilityReadiness(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(result.data, ['categoryName', 'gradeName', 'unitsReady', 'totalWeightKg', 'totalCost', 'avgCostPerKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="profitability-readiness.csv"');
        return res.status(200).send(csv);
    }
    async finalProducts(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.finalProducts',
            exported: false,
            params: { ...filters },
        });
        return await this.service.finalProductCostReport(tenantId, filters);
    }
    async finalProductsExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'cost.finalProducts',
            exported: true,
            params: { ...filters },
        });
        const result = await this.service.finalProductCostReport(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(result.data, [
            'dateSealed',
            'productCode',
            'unitType',
            'category',
            'grade',
            'totalWeightKg',
            'totalQty',
            'totalCost',
            'costPerKg',
            'costPerUnit',
            'sourceContainers',
            'sourceBales',
            'allocationsCount',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="final-product-cost.csv"');
        return res.status(200).send(csv);
    }
};
exports.CostReportsController = CostReportsController;
__decorate([
    (0, common_1.Get)('cascade'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "cascade", null);
__decorate([
    (0, common_1.Get)('cascade/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "cascadeExport", null);
__decorate([
    (0, common_1.Get)('readiness'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "readiness", null);
__decorate([
    (0, common_1.Get)('readiness/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "readinessExport", null);
__decorate([
    (0, common_1.Get)('final-products'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "finalProducts", null);
__decorate([
    (0, common_1.Get)('final-products/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CostReportsController.prototype, "finalProductsExport", null);
exports.CostReportsController = CostReportsController = __decorate([
    (0, common_1.Controller)('reports/cost'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [cost_reports_service_1.CostReportsService,
        reports_audit_service_1.ReportsAuditService])
], CostReportsController);
//# sourceMappingURL=cost-reports.controller.js.map