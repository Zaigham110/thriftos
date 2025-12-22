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
exports.TenantController = void 0;
const common_1 = require("@nestjs/common");
const tenant_service_1 = require("./tenant.service");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permission_guard_1 = require("../common/guards/permission.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const client_1 = require("@prisma/client");
const raw_category_dto_1 = require("./dto/raw-category.dto");
let TenantController = class TenantController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async getCurrentTenant(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.findOne(tenantId);
    }
    async getCategories(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.getCategories(tenantId);
    }
    async getRawCategories(user, req, type) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.getRawCategories(tenantId, type);
    }
    async createRawCategory(user, req, dto) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.createRawCategory(tenantId, dto);
    }
    async updateRawCategory(user, req, id, dto) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.updateRawCategory(tenantId, id, dto);
    }
    async deleteRawCategory(user, req, id) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.deleteRawCategory(tenantId, id);
    }
    async getGrades(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.getGrades(tenantId);
    }
    async getWarehouses(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.getWarehouses(tenantId);
    }
    async getStats(user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.tenantService.getStats(tenantId);
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getCurrentTenant", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('raw-categories'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getRawCategories", null);
__decorate([
    (0, common_1.Post)('raw-categories'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, raw_category_dto_1.CreateRawCategoryDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createRawCategory", null);
__decorate([
    (0, common_1.Put)('raw-categories/:id'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, raw_category_dto_1.UpdateRawCategoryDto]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateRawCategory", null);
__decorate([
    (0, common_1.Delete)('raw-categories/:id'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteRawCategory", null);
__decorate([
    (0, common_1.Get)('grades'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getGrades", null);
__decorate([
    (0, common_1.Get)('warehouses'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getWarehouses", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getStats", null);
exports.TenantController = TenantController = __decorate([
    (0, common_1.Controller)('tenant'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], TenantController);
//# sourceMappingURL=tenant.controller.js.map