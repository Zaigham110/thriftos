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
exports.WasteController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permission_guard_1 = require("../common/guards/permission.guard");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const waste_service_1 = require("./waste.service");
const waste_category_dto_1 = require("./dto/waste-category.dto");
let WasteController = class WasteController {
    constructor(waste) {
        this.waste = waste;
    }
    async listActive(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.waste.listCategories(tenantId);
    }
    async listAll(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.waste.listAllCategories(tenantId);
    }
    async create(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.waste.createCategory(tenantId, dto);
    }
    async update(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.waste.updateCategory(tenantId, id, dto);
    }
    async remove(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.waste.updateCategory(tenantId, id, { isActive: false });
    }
};
exports.WasteController = WasteController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WasteController.prototype, "listActive", null);
__decorate([
    (0, common_1.Get)('all'),
    (0, permissions_decorator_1.RequirePermissions)('category.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WasteController.prototype, "listAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermissions)('category.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [waste_category_dto_1.CreateWasteCategoryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('category.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, waste_category_dto_1.UpdateWasteCategoryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('category.delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WasteController.prototype, "remove", null);
exports.WasteController = WasteController = __decorate([
    (0, common_1.Controller)('tenant/waste-categories'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [waste_service_1.WasteService])
], WasteController);
//# sourceMappingURL=waste.controller.js.map