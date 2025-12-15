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
exports.WasteReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const waste_reports_service_1 = require("./waste-reports.service");
let WasteReportsController = class WasteReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async byStage(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'waste.byStage',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.wasteByStage(tenantId, filters) };
    }
    async byStageExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'waste.byStage',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.wasteByStage(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)([
            { stage: 'PROCUREMENT', wasteKg: data.procurementWasteKg },
            { stage: 'SORTING_STAGE_1', wasteKg: data.sortingStage1WasteKg },
            { stage: 'GRADING_STAGE_2', wasteKg: data.gradingStage2WasteKg },
        ], ['stage', 'wasteKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="waste-by-stage.csv"');
        return res.status(200).send(csv);
    }
    async costImpact(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'waste.costImpact',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.wasteCostImpact(tenantId, filters) };
    }
    async costImpactExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'waste.costImpact',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.wasteCostImpact(tenantId, filters);
        const rows = [
            { stage: 'PROCUREMENT', wasteKg: data.procurement.wasteKg, wasteCost: data.procurement.wasteCost },
            { stage: 'SORTING_STAGE_1', wasteKg: data.sortingStage1.wasteKg, wasteCost: data.sortingStage1.wasteCost },
            { stage: 'GRADING_STAGE_2', wasteKg: data.gradingStage2.wasteKg, wasteCost: data.gradingStage2.wasteCost },
        ];
        const csv = (0, report_utils_1.toCsv)(rows, ['stage', 'wasteKg', 'wasteCost']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="waste-cost-impact.csv"');
        return res.status(200).send(csv);
    }
};
exports.WasteReportsController = WasteReportsController;
__decorate([
    (0, common_1.Get)('by-stage'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteReportsController.prototype, "byStage", null);
__decorate([
    (0, common_1.Get)('by-stage/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteReportsController.prototype, "byStageExport", null);
__decorate([
    (0, common_1.Get)('cost-impact'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteReportsController.prototype, "costImpact", null);
__decorate([
    (0, common_1.Get)('cost-impact/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteReportsController.prototype, "costImpactExport", null);
exports.WasteReportsController = WasteReportsController = __decorate([
    (0, common_1.Controller)('reports/waste'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [waste_reports_service_1.WasteReportsService,
        reports_audit_service_1.ReportsAuditService])
], WasteReportsController);
//# sourceMappingURL=waste-reports.controller.js.map