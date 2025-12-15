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
exports.InventoryItemController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const inventory_item_service_1 = require("./inventory-item.service");
const dto_1 = require("./dto");
let InventoryItemController = class InventoryItemController {
    constructor(service) {
        this.service = service;
    }
    async intake(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.intake(tenantId, dto, user.userId);
    }
    async findAll(categoryId, gradeId, warehouseId, status, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findAll(tenantId, { categoryId, gradeId, warehouseId, status, page, limit });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findOne(tenantId, id);
    }
    async adjust(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.adjust(tenantId, id, dto, user.userId);
    }
    async reserve(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.reserve(tenantId, id, user.userId);
    }
    async release(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.release(tenantId, id, user.userId);
    }
};
exports.InventoryItemController = InventoryItemController;
__decorate([
    (0, common_1.Post)('intake'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_INTAKE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IntakeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "intake", null);
__decorate([
    (0, common_1.Get)('items'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_VIEW'),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('gradeId')),
    __param(2, (0, common_1.Query)('warehouseId')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __param(6, (0, current_user_decorator_1.CurrentUser)()),
    __param(7, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('items/:id'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('items/:id/adjust'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_ADJUST'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AdjustInventoryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "adjust", null);
__decorate([
    (0, common_1.Post)('items/:id/reserve'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_RESERVE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "reserve", null);
__decorate([
    (0, common_1.Post)('items/:id/release'),
    (0, permissions_decorator_1.RequirePermissions)('INVENTORY_RESERVE'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryItemController.prototype, "release", null);
exports.InventoryItemController = InventoryItemController = __decorate([
    (0, common_1.Controller)('inventory'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [inventory_item_service_1.InventoryItemService])
], InventoryItemController);
//# sourceMappingURL=inventory-item.controller.js.map