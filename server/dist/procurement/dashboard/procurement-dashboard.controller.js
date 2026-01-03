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
exports.ProcurementDashboardController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../../reports/common/dto/report-filters.dto");
const procurement_dashboard_service_1 = require("./procurement-dashboard.service");
let ProcurementDashboardController = class ProcurementDashboardController {
    constructor(service) {
        this.service = service;
    }
    async summary(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return { data: await this.service.summary(tenantId, filters) };
    }
};
exports.ProcurementDashboardController = ProcurementDashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, permissions_decorator_1.RequirePermissions)('po.read'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProcurementDashboardController.prototype, "summary", null);
exports.ProcurementDashboardController = ProcurementDashboardController = __decorate([
    (0, common_1.Controller)('procurement/dashboard'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [procurement_dashboard_service_1.ProcurementDashboardService])
], ProcurementDashboardController);
//# sourceMappingURL=procurement-dashboard.controller.js.map