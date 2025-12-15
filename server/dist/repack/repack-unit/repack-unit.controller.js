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
exports.RepackUnitController = void 0;
const common_1 = require("@nestjs/common");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const dto_1 = require("./dto");
const repack_unit_service_1 = require("./repack-unit.service");
let RepackUnitController = class RepackUnitController {
    constructor(service) {
        this.service = service;
    }
    async createForSession(sessionId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.createForSession(tenantId, sessionId, dto, user.userId);
    }
    async findAll(sessionId, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findAll(tenantId, { sessionId, page, limit });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.service.findOne(tenantId, id);
    }
};
exports.RepackUnitController = RepackUnitController;
__decorate([
    (0, common_1.Post)('sessions/:id/units'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_EDIT'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateRepackUnitDto, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "createForSession", null);
__decorate([
    (0, common_1.Get)('units'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Query)('sessionId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('units/:id'),
    (0, permissions_decorator_1.RequirePermissions)('REPACK_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RepackUnitController.prototype, "findOne", null);
exports.RepackUnitController = RepackUnitController = __decorate([
    (0, common_1.Controller)('repack'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [repack_unit_service_1.RepackUnitService])
], RepackUnitController);
//# sourceMappingURL=repack-unit.controller.js.map