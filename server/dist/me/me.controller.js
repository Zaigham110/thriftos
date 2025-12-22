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
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permission_guard_1 = require("../common/guards/permission.guard");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
let MeController = class MeController {
    constructor(prisma, usersService) {
        this.prisma = prisma;
        this.usersService = usersService;
    }
    async getMe(currentUser) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.userId },
            select: {
                id: true,
                email: true,
                name: true,
                tenantId: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('User not found or inactive');
        }
        const permissions = currentUser.isSuperAdmin
            ? []
            : await this.usersService.getUserPermissions(currentUser.userId);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenantId: currentUser.isSuperAdmin ? null : user.tenantId,
                isSuperAdmin: currentUser.isSuperAdmin,
                impersonatedTenantId: currentUser.impersonatedTenantId ?? null,
            },
            permissions,
        };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.SkipPermissionCheck)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile', description: 'Returns authenticated user data and permissions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User profile retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "getMe", null);
exports.MeController = MeController = __decorate([
    (0, swagger_1.ApiTags)('Me'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('me'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService])
], MeController);
//# sourceMappingURL=me.controller.js.map