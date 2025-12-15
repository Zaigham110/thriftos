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
exports.GradingReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const grading_reports_service_1 = require("./grading-reports.service");
let GradingReportsController = class GradingReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async distribution(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'grading.distribution',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.gradeDistribution(tenantId, filters) };
    }
    async distributionExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'grading.distribution',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.gradeDistribution(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, ['categoryId', 'gradeId', 'gradeWeightKg', 'gradePct', 'gradeCost', 'costPerKg']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="grade-distribution.csv"');
        return res.status(200).send(csv);
    }
    async loss(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'grading.loss',
            exported: false,
            params: { ...filters },
        });
        return { data: await this.service.gradingLoss(tenantId, filters) };
    }
    async lossExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'grading.loss',
            exported: true,
            params: { ...filters },
        });
        const data = await this.service.gradingLoss(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(data, ['categoryId', 'inputWeightKg', 'wasteWeightKg', 'wastePct', 'wasteCost']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="grading-loss.csv"');
        return res.status(200).send(csv);
    }
};
exports.GradingReportsController = GradingReportsController;
__decorate([
    (0, common_1.Get)('distribution'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], GradingReportsController.prototype, "distribution", null);
__decorate([
    (0, common_1.Get)('distribution/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], GradingReportsController.prototype, "distributionExport", null);
__decorate([
    (0, common_1.Get)('loss'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], GradingReportsController.prototype, "loss", null);
__decorate([
    (0, common_1.Get)('loss/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], GradingReportsController.prototype, "lossExport", null);
exports.GradingReportsController = GradingReportsController = __decorate([
    (0, common_1.Controller)('reports/grading'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [grading_reports_service_1.GradingReportsService,
        reports_audit_service_1.ReportsAuditService])
], GradingReportsController);
//# sourceMappingURL=grading-reports.controller.js.map