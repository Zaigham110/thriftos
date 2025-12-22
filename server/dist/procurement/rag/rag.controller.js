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
exports.RagController = void 0;
const common_1 = require("@nestjs/common");
const rag_service_1 = require("./rag.service");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let RagController = class RagController {
    constructor(ragService) {
        this.ragService = ragService;
    }
    async createForContainer(containerId, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.ragService.create(tenantId, { ...dto, containerId }, user.userId);
    }
    async findAll(containerId, status, sortableOnly, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.ragService.findAll(tenantId, {
            containerId,
            status,
            sortableOnly: sortableOnly === 'true',
            page,
            limit,
        });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.ragService.findOne(tenantId, id);
    }
    async delete(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.ragService.delete(tenantId, id, user.userId);
    }
};
exports.RagController = RagController;
__decorate([
    (0, common_1.Post)('containers/:containerId/rags'),
    (0, permissions_decorator_1.RequirePermissions)('rag.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('containerId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "createForContainer", null);
__decorate([
    (0, common_1.Get)('rags'),
    (0, permissions_decorator_1.RequirePermissions)('rag.read'),
    __param(0, (0, common_1.Query)('containerId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('sortableOnly')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, current_user_decorator_1.CurrentUser)()),
    __param(6, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('rags/:id'),
    (0, permissions_decorator_1.RequirePermissions)('rag.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)('rags/:id'),
    (0, permissions_decorator_1.RequirePermissions)('rag.delete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "delete", null);
exports.RagController = RagController = __decorate([
    (0, common_1.Controller)('procurement'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [rag_service_1.RagService])
], RagController);
//# sourceMappingURL=rag.controller.js.map