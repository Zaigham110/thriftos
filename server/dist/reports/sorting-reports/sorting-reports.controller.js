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
exports.SortingReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const sorting_reports_service_1 = require("./sorting-reports.service");
let SortingReportsController = class SortingReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async categoryYield(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.categoryYield',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.categoryYieldReport(tenantId, filters) };
    }
    async categoryYieldExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.categoryYield',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.categoryYieldReport(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, ['categoryId', 'inputWeightKg', 'outputWeightKg', 'wasteWeightKg', 'yieldPct']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="category-yield.csv"');
        return res.status(200).send(csv);
    }
    async outputs(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.outputs',
            exported: false,
            params: { ...filters },
        });
        return await this.service.sortingOutputs(tenantId, filters);
    }
    async outputsExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.outputs',
            exported: true,
            params: { ...filters },
        });
        const result = await this.service.sortingOutputs(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)((result.stage1?.data ?? []), [
            'createdAt',
            'poNumber',
            'containerNumber',
            'ragCode',
            'categoryName',
            'weightKg',
            'allocatedCost',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sorting-stage1-outputs.csv"');
        return res.status(200).send(csv);
    }
    async waste(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.waste',
            exported: false,
            params: { ...filters },
        });
        return await this.service.sortingWaste(tenantId, filters);
    }
    async wasteExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.waste',
            exported: true,
            params: { ...filters },
        });
        const result = await this.service.sortingWaste(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(result.data, ['createdAt', 'poNumber', 'containerNumber', 'ragCode', 'wasteWeightKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sorting-waste.csv"');
        return res.status(200).send(csv);
    }
    async efficiency(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.efficiency',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.sortingEfficiency(tenantId, filters) };
    }
    async volumeTrend(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.volumeTrend',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.sortingVolumeTrend(tenantId, filters) };
    }
    async yieldWasteTrend(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.yieldWasteTrend',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.sortingYieldWasteTrend(tenantId, filters) };
    }
    async efficiencyExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'sorting.efficiency',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.sortingEfficiency(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, [
            'workerId',
            'sessionsHandled',
            'inputWeightKg',
            'outputWeightKg',
            'wasteWeightKg',
            'avgYieldPct',
            'avgWastePct',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sorting-efficiency.csv"');
        return res.status(200).send(csv);
    }
};
exports.SortingReportsController = SortingReportsController;
__decorate([
    (0, common_1.Get)('category-yield'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "categoryYield", null);
__decorate([
    (0, common_1.Get)('category-yield/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "categoryYieldExport", null);
__decorate([
    (0, common_1.Get)('outputs'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "outputs", null);
__decorate([
    (0, common_1.Get)('outputs/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "outputsExport", null);
__decorate([
    (0, common_1.Get)('waste'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "waste", null);
__decorate([
    (0, common_1.Get)('waste/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "wasteExport", null);
__decorate([
    (0, common_1.Get)('efficiency'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "efficiency", null);
__decorate([
    (0, common_1.Get)('volume-trend'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "volumeTrend", null);
__decorate([
    (0, common_1.Get)('yield-waste-trend'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortingReportsController.prototype, "yieldWasteTrend", null);
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
], SortingReportsController.prototype, "efficiencyExport", null);
exports.SortingReportsController = SortingReportsController = __decorate([
    (0, common_1.Controller)('reports/sorting'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [sorting_reports_service_1.SortingReportsService,
        reports_audit_service_1.ReportsAuditService])
], SortingReportsController);
//# sourceMappingURL=sorting-reports.controller.js.map