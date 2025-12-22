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
exports.SuperAdminController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const superadmin_service_1 = require("./superadmin.service");
const auth_service_1 = require("../auth/auth.service");
const create_tenant_dto_1 = require("./dto/create-tenant.dto");
const update_tenant_dto_1 = require("./dto/update-tenant.dto");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const super_admin_decorator_1 = require("../common/decorators/super-admin.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let SuperAdminController = class SuperAdminController {
    constructor(superAdminService, authService) {
        this.superAdminService = superAdminService;
        this.authService = authService;
    }
    async create(dto, user) {
        try {
            const result = await this.superAdminService.createTenant(dto, user.userId);
            console.log('Tenant created successfully:', result);
            return result;
        }
        catch (error) {
            console.error('Error creating tenant:', error);
            throw error;
        }
    }
    async findAll(page, limit, status) {
        return this.superAdminService.findAll(page || 1, limit || 20, status);
    }
    async findOne(id) {
        return this.superAdminService.findOne(id);
    }
    async update(id, dto, user) {
        return this.superAdminService.update(id, dto, user.userId);
    }
    async deactivate(id, user) {
        return this.superAdminService.deactivate(id, user.userId);
    }
    async activate(id, user) {
        return this.superAdminService.activate(id, user.userId);
    }
    async impersonate(id, user, req) {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        return this.authService.createImpersonationToken(user.userId, id, ipAddress, userAgent);
    }
};
exports.SuperAdminController = SuperAdminController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tenant_dto_1.CreateTenantDto, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_tenant_dto_1.UpdateTenantDto, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':id/impersonate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SuperAdminController.prototype, "impersonate", null);
exports.SuperAdminController = SuperAdminController = __decorate([
    (0, common_1.Controller)('superadmin/tenants'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard),
    (0, super_admin_decorator_1.SuperAdminOnly)(),
    __metadata("design:paramtypes", [superadmin_service_1.SuperAdminService,
        auth_service_1.AuthService])
], SuperAdminController);
//# sourceMappingURL=superadmin.controller.js.map