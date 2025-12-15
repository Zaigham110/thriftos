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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const super_admin_decorator_1 = require("../decorators/super-admin.decorator");
let TenantGuard = class TenantGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
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
                throw new common_1.ForbiddenException('Super Admin access required');
            }
            return true;
        }
        if (user.isSuperAdmin) {
            if (user.impersonatedTenantId) {
                request.tenantId = user.impersonatedTenantId;
            }
            return true;
        }
        if (!user.tenantId) {
            throw new common_1.ForbiddenException('Tenant context required');
        }
        request.tenantId = user.tenantId;
        return true;
    }
};
exports.TenantGuard = TenantGuard;
exports.TenantGuard = TenantGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], TenantGuard);
//# sourceMappingURL=tenant.guard.js.map