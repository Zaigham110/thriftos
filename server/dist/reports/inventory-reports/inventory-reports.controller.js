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
exports.InventoryReportsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const permission_guard_1 = require("../../common/guards/permission.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const report_filters_dto_1 = require("../common/dto/report-filters.dto");
const reports_audit_service_1 = require("../common/reports-audit.service");
const report_utils_1 = require("../common/report-utils");
const inventory_reports_service_1 = require("./inventory-reports.service");
let InventoryReportsController = class InventoryReportsController {
    constructor(service, audit) {
        this.service = service;
        this.audit = audit;
    }
    async snapshot(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.snapshot',
            exported: false,
            params: { ...filters },
        });
        return await this.service.inventorySnapshot(tenantId, filters);
    }
    async stock(filters, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.stock',
            exported: false,
            params: { ...filters },
        });
        return await this.service.inventorySnapshot(tenantId, filters);
    }
    async snapshotExport(filters, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.snapshot',
            exported: true,
            params: { ...filters },
        });
        const snapshot = await this.service.inventorySnapshot(tenantId, filters);
        const csv = (0, report_utils_1.toCsv)(snapshot.data, [
            'categoryName',
            'gradeName',
            'warehouseName',
            'status',
            'totalUnits',
            'totalWeightKg',
            'totalPcs',
            'avgCost',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-snapshot.csv"');
        return res.status(200).send(csv);
    }
    async aging(query, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.aging',
            exported: false,
            params: { ...query },
        });
        return await this.service.inventoryAging(tenantId, query);
    }
    async agingExport(query, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.aging',
            exported: true,
            params: { ...query },
        });
        const aging = await this.service.inventoryAging(tenantId, query);
        const csv = (0, report_utils_1.toCsv)(aging.data, ['ageRangeDays', 'unitsCount', 'totalWeightKg', 'totalValue']);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-aging.csv"');
        return res.status(200).send(csv);
    }
    async movements(query, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.movements',
            exported: false,
            params: { ...query },
        });
        return await this.service.inventoryMovements(tenantId, query);
    }
    async movementsExport(query, user, req, res) {
        const tenantId = req.tenantId || user.tenantId;
        await this.audit.logAccess({
            tenantId,
            userId: user.userId,
            report: 'inventory.movements',
            exported: true,
            params: { ...query },
        });
        const result = await this.service.inventoryMovements(tenantId, query);
        const csv = (0, report_utils_1.toCsv)(result.data, [
            'createdAt',
            'movementType',
            'quantityKg',
            'quantityPcs',
            'unitCode',
            'unitType',
            'warehouseName',
            'categoryName',
            'gradeName',
            'inventoryStatus',
            'avgCost',
            'referenceId',
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-movements.csv"');
        return res.status(200).send(csv);
    }
};
exports.InventoryReportsController = InventoryReportsController;
__decorate([
    (0, common_1.Get)('snapshot'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "snapshot", null);
__decorate([
    (0, common_1.Get)('stock'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "stock", null);
__decorate([
    (0, common_1.Get)('snapshot/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_filters_dto_1.ReportFiltersDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "snapshotExport", null);
__decorate([
    (0, common_1.Get)('aging'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "aging", null);
__decorate([
    (0, common_1.Get)('aging/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "agingExport", null);
__decorate([
    (0, common_1.Get)('movements'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_VIEW'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "movements", null);
__decorate([
    (0, common_1.Get)('movements/export'),
    (0, permissions_decorator_1.RequirePermissions)('REPORTS_EXPORT'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryReportsController.prototype, "movementsExport", null);
exports.InventoryReportsController = InventoryReportsController = __decorate([
    (0, common_1.Controller)('reports/inventory'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [inventory_reports_service_1.InventoryReportsService,
        reports_audit_service_1.ReportsAuditService])
], InventoryReportsController);
//# sourceMappingURL=inventory-reports.controller.js.map