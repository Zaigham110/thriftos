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
exports.ProcurementReportsController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const procurement_reports_service_1 = require("./procurement-reports.service");
let ProcurementReportsController = class ProcurementReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async containerCostBreakdown(containerId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'procurement.containerCostBreakdown',
            exported: false,
            params: { containerId },
        });
        return this.service.containerCostBreakdown(tenantId, containerId);
    }
    async vendorSummaryJson(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'procurement.vendorProcurementSummary',
            exported: false,
            params: { startDate: filters.startDate, endDate: filters.endDate },
        });
        const data = await this.service.vendorProcurementSummary(tenantId, filters);
        return { data };
    }
    async vendorSummaryExportCsv(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'procurement.vendorProcurementSummary',
            exported: true,
            params: { startDate: filters.startDate, endDate: filters.endDate },
        });
        const data = await this.service.vendorProcurementSummary(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, ['vendorId', 'vendorName', 'totalWeightKg', 'totalCost', 'avgCostPerKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="vendor-procurement-summary.csv"');
        return res.status(200).send(csv);
    }
};
exports.ProcurementReportsController = ProcurementReportsController;
__decorate([
    (0, common_1.Get)('containers/:id/cost-breakdown'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProcurementReportsController.prototype, "containerCostBreakdown", null);
__decorate([
    (0, common_1.Get)('vendors/summary'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProcurementReportsController.prototype, "vendorSummaryJson", null);
__decorate([
    (0, common_1.Get)('vendors/summary/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProcurementReportsController.prototype, "vendorSummaryExportCsv", null);
exports.ProcurementReportsController = ProcurementReportsController = __decorate([
    (0, common_1.Controller)('reports/procurement'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [procurement_reports_service_1.ProcurementReportsService,
        reports_audit_service_1.ReportsAuditService])
], ProcurementReportsController);
//# sourceMappingURL=procurement-reports.controller.js.map