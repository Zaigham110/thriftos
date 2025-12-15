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
exports.SortCategoryBucketController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const dto_1 = require("./dto");
const sort_category_bucket_service_1 = require("./sort-category-bucket.service");
let SortCategoryBucketController = class SortCategoryBucketController {
    constructor(service) {
        this.service = service;
    }
    async createForSession(sessionId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.createForSession(tenantId, sessionId, dto, user.userId);
    }
    async update(bucketId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.update(tenantId, bucketId, dto, user.userId);
    }
    async delete(bucketId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.delete(tenantId, bucketId, user.userId);
    }
};
exports.SortCategoryBucketController = SortCategoryBucketController;
__decorate([
    (0, common_1.Post)('sessions/:id/buckets'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateSortCategoryBucketDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortCategoryBucketController.prototype, "createForSession", null);
__decorate([
    (0, common_1.Patch)('buckets/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateSortCategoryBucketDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SortCategoryBucketController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('buckets/:id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE1_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SortCategoryBucketController.prototype, "delete", null);
exports.SortCategoryBucketController = SortCategoryBucketController = __decorate([
    (0, common_1.Controller)('sorting/stage1'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [sort_category_bucket_service_1.SortCategoryBucketService])
], SortCategoryBucketController);
//# sourceMappingURL=sort-category-bucket.controller.js.map