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
var TenantGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const super_admin_decorator_1 = require("../decorators/super-admin.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const audit_service_1 = require("../../audit/audit.service");
let TenantGuard = TenantGuard_1 = class TenantGuard {
    constructor(reflector, auditService) {
        this.reflector = reflector;
        this.auditService = auditService;
        this.logger = new common_1.Logger(TenantGuard_1.name);
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const isSuperAdminRoute = this.reflector.getAllAndOverride(super_admin_decorator_1.SUPER_ADMIN_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('User not authenticated');
        }
        if (isSuperAdminRoute) {
            if (!user.isSuperAdmin) {
                await this.logSecurityEvent(user.userId, user.tenantId, 'SUPER_ADMIN_ROUTE_DENIED', {
                    path: request.path,
                    method: request.method,
                    reason: 'Non-super-admin user attempted to access super admin route',
                }, request);
                throw new common_1.ForbiddenException('Super Admin access required');
            }
            await this.logSecurityEvent(user.userId, null, 'SUPER_ADMIN_ROUTE_ACCESS', {
                path: request.path,
                method: request.method,
            }, request);
            return true;
        }
        if (user.isSuperAdmin) {
            if (!user.impersonatedTenantId) {
                await this.logSecurityEvent(user.userId, null, 'SUPER_ADMIN_NO_IMPERSONATION', {
                    path: request.path,
                    method: request.method,
                    reason: 'Super admin attempted tenant route without impersonation',
                }, request);
                throw new common_1.ForbiddenException('Super Admin must impersonate a tenant to access tenant routes. Use POST /superadmin/tenants/:id/impersonate first.');
            }
            request.tenantId = user.impersonatedTenantId;
            await this.logSecurityEvent(user.userId, user.impersonatedTenantId, 'SUPER_ADMIN_IMPERSONATED_ACCESS', {
                path: request.path,
                method: request.method,
                impersonatedTenantId: user.impersonatedTenantId,
            }, request);
            return true;
        }
        if (!user.tenantId) {
            await this.logSecurityEvent(user.userId, null, 'TENANT_CONTEXT_MISSING', {
                path: request.path,
                method: request.method,
                reason: 'User has no tenant context',
            }, request);
            throw new common_1.ForbiddenException('Tenant context required');
        }
        request.tenantId = user.tenantId;
        return true;
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
exports.TenantGuard = TenantGuard;
exports.TenantGuard = TenantGuard = TenantGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        audit_service_1.AuditService])
], TenantGuard);
//# sourceMappingURL=tenant.guard.js.map