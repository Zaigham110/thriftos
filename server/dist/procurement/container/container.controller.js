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
exports.ContainerController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const container_service_1 = require("./container.service");
const create_container_dto_1 = require("./dto/create-container.dto");
const update_container_dto_1 = require("./dto/update-container.dto");
const update_container_status_dto_1 = require("./dto/update-container-status.dto");
const create_container_charge_dto_1 = require("./dto/create-container-charge.dto");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let ContainerController = class ContainerController {
    constructor(containerService) {
        this.containerService = containerService;
    }
    async create(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.create(tenantId, dto, user.userId);
    }
    async findAll(purchaseOrderId, status, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.findAll(tenantId, { purchaseOrderId, status, page, limit });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.findOne(tenantId, id);
    }
    async update(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.update(tenantId, id, dto, user.userId);
    }
    async updateStatus(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.updateStatus(tenantId, id, dto, user.userId);
    }
    async getCostBreakdown(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.getCostBreakdown(tenantId, id);
    }
    async addCharge(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.addCharge(tenantId, id, dto, user.userId);
    }
    async getCharges(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.getCharges(tenantId, id);
    }
    async deleteCharge(id, chargeId, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.containerService.deleteCharge(tenantId, id, chargeId, user.userId);
    }
};
exports.ContainerController = ContainerController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermissions)('container.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_container_dto_1.CreateContainerDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermissions)('container.read'),
    __param(0, (0, common_1.Query)('purchaseOrderId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('container.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('container.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_container_dto_1.UpdateContainerDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, permissions_decorator_1.RequirePermissions)('container.update'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_container_status_dto_1.UpdateContainerStatusDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Get)(':id/cost-breakdown'),
    (0, permissions_decorator_1.RequirePermissions)('container.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "getCostBreakdown", null);
__decorate([
    (0, common_1.Post)(':id/charges'),
    (0, permissions_decorator_1.RequirePermissions)('container.update'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_container_charge_dto_1.CreateContainerChargeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "addCharge", null);
__decorate([
    (0, common_1.Get)(':id/charges'),
    (0, permissions_decorator_1.RequirePermissions)('container.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "getCharges", null);
__decorate([
    (0, common_1.Delete)(':id/charges/:chargeId'),
    (0, permissions_decorator_1.RequirePermissions)('container.update'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('chargeId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ContainerController.prototype, "deleteCharge", null);
exports.ContainerController = ContainerController = __decorate([
    (0, common_1.Controller)('procurement/containers'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [container_service_1.ContainerService])
], ContainerController);
//# sourceMappingURL=container.controller.js.map