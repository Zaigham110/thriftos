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
exports.GradeOutputController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const grade_output_service_1 = require("./grade-output.service");
let GradeOutputController = class GradeOutputController {
    constructor(service) {
        this.service = service;
    }
    async findAll(gradeSessionId, gradeId, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findAll(tenantId, { gradeSessionId, gradeId, page, limit });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findOne(tenantId, id);
    }
};
exports.GradeOutputController = GradeOutputController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_VIEW'),
    __param(0, (0, common_1.Query)('gradeSessionId')),
    __param(1, (0, common_1.Query)('gradeId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], GradeOutputController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('SORTING_STAGE2_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GradeOutputController.prototype, "findOne", null);
exports.GradeOutputController = GradeOutputController = __decorate([
    (0, common_1.Controller)('sorting/stage2/grade-outputs'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [grade_output_service_1.GradeOutputService])
], GradeOutputController);
//# sourceMappingURL=grade-output.controller.js.map