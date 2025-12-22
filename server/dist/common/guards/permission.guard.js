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
var PermissionGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
let PermissionGuard = PermissionGuard_1 = class PermissionGuard {
    constructor(reflector, prisma, auditService) {
        this.reflector = reflector;
        this.prisma = prisma;
        this.auditService = auditService;
        this.logger = new common_1.Logger(PermissionGuard_1.name);
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const skipPermission = this.reflector.getAllAndOverride(permissions_decorator_1.SKIP_PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!skipPermission && (!requiredPermissions || requiredPermissions.length === 0)) {
            const handler = context.getHandler().name;
            const controller = context.getClass().name;
            this.logger.warn(`DENY BY DEFAULT: No permissions declared for ${controller}.${handler}`);
            await this.logSecurityEvent(user?.userId, user?.tenantId || request.tenantId, 'PERMISSION_DENIED_NO_DECLARATION', {
                controller,
                handler,
                path: request.path,
                method: request.method,
            }, request);
            throw new common_1.ForbiddenException('Access denied: endpoint requires explicit permission declaration');
        }
        if (skipPermission) {
            return true;
        }
        if (!user) {
            throw new common_1.ForbiddenException('User not authenticated');
        }
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.userId },
            select: { isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
            await this.logSecurityEvent(user.userId, user.tenantId || request.tenantId, 'PERMISSION_DENIED_INACTIVE_USER', {
                path: request.path,
                method: request.method,
            }, request);
            throw new common_1.ForbiddenException('User account is inactive');
        }
        if (user.isSuperAdmin) {
            return true;
        }
        const userPermissions = await this.getUserPermissions(user.userId);
        const missingPermissions = requiredPermissions.filter((permission) => !userPermissions.includes(permission));
        if (missingPermissions.length > 0) {
            await this.logSecurityEvent(user.userId, user.tenantId || request.tenantId, 'PERMISSION_DENIED', {
                path: request.path,
                method: request.method,
                required: requiredPermissions,
                missing: missingPermissions,
                userPermissions: userPermissions,
            }, request);
            throw new common_1.ForbiddenException(`Missing required permissions: ${missingPermissions.join(', ')}`);
        }
        return true;
    }
    async getUserPermissions(userId) {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });
        const permissions = new Set();
        for (const userRole of userRoles) {
            for (const rolePermission of userRole.role.rolePermissions) {
                permissions.add(rolePermission.permission.code);
            }
        }
        return Array.from(permissions);
    }
    async logSecurityEvent(userId, tenantId, action, metadata, request) {
        try {
            await this.auditService.log({
                tenantId: tenantId || null,
                userId: userId || null,
                action,
                entityType: 'Security',
                entityId: request.path,
                metadataJson: metadata,
                ipAddress: request.ip || request.socket?.remoteAddress,
                userAgent: request.headers?.['user-agent'],
            });
        }
        catch (error) {
            this.logger.error('Failed to log security event', error);
        }
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = PermissionGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map