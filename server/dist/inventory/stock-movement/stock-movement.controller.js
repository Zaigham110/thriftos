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
exports.StockMovementController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const stock_movement_service_1 = require("./stock-movement.service");
let StockMovementController = class StockMovementController {
    constructor(service) {
        this.service = service;
    }
    async findAll(inventoryItemId, movementType, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findAll(tenantId, { inventoryItemId, movementType, page, limit });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findOne(tenantId, id);
    }
};
exports.StockMovementController = StockMovementController;
__decorate([
    (0, common_1.Get)('movements'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_VIEW'),
    __param(0, (0, common_1.Query)('inventoryItemId')),
    __param(1, (0, common_1.Query)('movementType')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], StockMovementController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('movements/:id'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StockMovementController.prototype, "findOne", null);
exports.StockMovementController = StockMovementController = __decorate([
    (0, common_1.Controller)('inventory'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [stock_movement_service_1.StockMovementService])
], StockMovementController);
//# sourceMappingURL=stock-movement.controller.js.map