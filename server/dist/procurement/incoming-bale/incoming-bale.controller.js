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
exports.IncomingBaleController = void 0;
const common_1 = require("@nestjs/common");
const incoming_bale_service_1 = require("./incoming-bale.service");
const create_incoming_bale_dto_1 = require("./dto/create-incoming-bale.dto");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permission_guard_1 = require("../../common/guards/permission.guard");
const permissions_decorator_1 = require("../../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let IncomingBaleController = class IncomingBaleController {
    constructor(incomingBaleService) {
        this.incomingBaleService = incomingBaleService;
    }
    async create(dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.incomingBaleService.create(tenantId, dto, user.userId);
    }
    async findAll(containerId, vendorId, purchaseOrderId, standalone, page, limit, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.incomingBaleService.findAll(tenantId, {
            containerId,
            vendorId,
            purchaseOrderId,
            standalone,
            page,
            limit,
        });
    }
    async findOne(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.incomingBaleService.findOne(tenantId, id);
    }
    async update(id, dto, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.incomingBaleService.update(tenantId, id, dto, user.userId);
    }
    async delete(id, user, req) {
        const tenantId = req.tenantId || user.tenantId;
        return this.incomingBaleService.delete(tenantId, id, user.userId);
    }
};
exports.IncomingBaleController = IncomingBaleController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermissions)('po.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_incoming_bale_dto_1.CreateIncomingBaleDto, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomingBaleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermissions)('po.read'),
    __param(0, (0, common_1.Query)('containerId')),
    __param(1, (0, common_1.Query)('vendorId')),
    __param(2, (0, common_1.Query)('purchaseOrderId')),
    __param(3, (0, common_1.Query)('standalone')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __param(6, (0, current_user_decorator_1.CurrentUser)()),
    __param(7, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Boolean, Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomingBaleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('po.read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomingBaleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('po.update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomingBaleController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermissions)('po.delete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], IncomingBaleController.prototype, "delete", null);
exports.IncomingBaleController = IncomingBaleController = __decorate([
    (0, common_1.Controller)('procurement/incoming-bales'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [incoming_bale_service_1.IncomingBaleService])
], IncomingBaleController);
//# sourceMappingURL=incoming-bale.controller.js.map