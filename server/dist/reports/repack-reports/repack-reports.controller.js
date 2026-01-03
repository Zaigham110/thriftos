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
exports.RepackReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const repack_reports_service_1 = require("./repack-reports.service");
let RepackReportsController = class RepackReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async efficiency(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.efficiency',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.repackEfficiency(tenantId, filters) };
    }
    async summary(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.summary',
            exported: false,
            params: { ...filters },
        });
        return await this.service.repackSummary(tenantId, filters);
    }
    async summaryExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.summary',
            exported: true,
            params: { ...filters },
        });
        const result = await this.service.repackSummary(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(result.data, ['status', 'units', 'totalWeightKg', 'totalPcs', 'totalCost']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="repack-summary.csv"');
        return res.status(200).send(csv);
    }
    async efficiencyExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.efficiency',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.repackEfficiency(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, ['day', 'gradeInputWeightKg', 'repackOutputWeightKg', 'unitsProduced', 'avgUnitWeightKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="repack-efficiency.csv"');
        return res.status(200).send(csv);
    }
    async skuSummary(query, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.skuSummary',
            exported: false,
            params: { ...query },
        });
        return this.service.skuProductionSummary(tenantId, query);
    }
    async skuSummaryExport(query, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'repack.skuSummary',
            exported: true,
            params: { ...query },
        });
        const result = await this.service.skuProductionSummary(tenantId, { ...query, page: 1, limit: 2000 });
        const csv = (0, report_utils_1.toCsv)(result.data, [
            'unitCode',
            'unitType',
            'categoryId',
            'categoryName',
            'gradeId',
            'gradeName',
            'weightKg',
            'pcsCount',
            'totalCost',
            'createdAt',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sku-production-summary.csv"');
        return res.status(200).send(csv);
    }
};
exports.RepackReportsController = RepackReportsController;
__decorate([
    (0, common_1.Get)('efficiency'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "efficiency", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('summary/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "summaryExport", null);
__decorate([
    (0, common_1.Get)('efficiency/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "efficiencyExport", null);
__decorate([
    (0, common_1.Get)('sku-summary'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "skuSummary", null);
__decorate([
    (0, common_1.Get)('sku-summary/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackReportsController.prototype, "skuSummaryExport", null);
exports.RepackReportsController = RepackReportsController = __decorate([
    (0, common_1.Controller)('reports/repack'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [repack_reports_service_1.RepackReportsService,
        reports_audit_service_1.ReportsAuditService])
], RepackReportsController);
//# sourceMappingURL=repack-reports.controller.js.map