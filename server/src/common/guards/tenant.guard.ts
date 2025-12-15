import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPER_ADMIN_KEY } from '../decorators/super-admin.decorator';
import { CurrentUserData } from '../decorators/current-user.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isSuperAdminRoute = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admin routes - only super admins can access
    if (isSuperAdminRoute) {
      if (!user.isSuperAdmin) {
        throw new ForbiddenException('Super Admin access required');
      }
      return true;
    }

    // Super Admin can access any tenant route (with impersonation)
    if (user.isSuperAdmin) {
      // If impersonating, use the impersonated tenant
      if (user.impersonatedTenantId) {
        request.tenantId = user.impersonatedTenantId;
      }
      return true;
    }

    // Regular users must have a tenant
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Set tenant context on request
    request.tenantId = user.tenantId;

    return true;
  }
}

