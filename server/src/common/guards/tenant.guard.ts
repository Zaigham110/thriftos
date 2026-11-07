import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPER_ADMIN_KEY } from '../decorators/super-admin.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CurrentUserData } from '../decorators/current-user.decorator';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public (skip tenant check)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
        await this.logSecurityEvent(
          user.userId,
          user.tenantId,
          'SUPER_ADMIN_ROUTE_DENIED',
          {
            path: request.path,
            method: request.method,
            reason: 'Non-super-admin user attempted to access super admin route',
          },
          request,
        );
        throw new ForbiddenException('Super Admin access required');
      }
      
      // Log super admin changes for the audit trail. Reading console pages (GET) is not logged: it filled the trail
      // with two rows per page view and hid what mattered (v2 review). Each change also writes its own entry.
      if (request.method !== 'GET') await this.logSecurityEvent(
        user.userId,
        null,
        'SUPER_ADMIN_ROUTE_ACCESS',
        {
          path: request.path,
          method: request.method,
        },
        request,
      );
      return true;
    }

    // Super Admin accessing tenant routes
    if (user.isSuperAdmin) {
      // Super Admin MUST impersonate to access tenant routes
      if (!user.impersonatedTenantId) {
        await this.logSecurityEvent(
          user.userId,
          null,
          'SUPER_ADMIN_NO_IMPERSONATION',
          {
            path: request.path,
            method: request.method,
            reason: 'Super admin attempted tenant route without impersonation',
          },
          request,
        );
        throw new ForbiddenException(
          'Super Admin must impersonate a tenant to access tenant routes. Use POST /superadmin/tenants/:id/impersonate first.',
        );
      }
      
      // Use the impersonated tenant context
      request.tenantId = user.impersonatedTenantId;
      
      // Support view: opening and closing are logged by the auth service; only changes are logged here, not every
      // screen loaded (v2 review: page loads flooded the business's activity).
      if (request.method !== 'GET') await this.logSecurityEvent(
        user.userId,
        user.impersonatedTenantId,
        'SUPER_ADMIN_IMPERSONATED_ACCESS',
        {
          path: request.path,
          method: request.method,
          impersonatedTenantId: user.impersonatedTenantId,
        },
        request,
      );
      return true;
    }

    // Regular users must have a tenant
    if (!user.tenantId) {
      await this.logSecurityEvent(
        user.userId,
        null,
        'TENANT_CONTEXT_MISSING',
        {
          path: request.path,
          method: request.method,
          reason: 'User has no tenant context',
        },
        request,
      );
      throw new ForbiddenException('Tenant context required');
    }

    // Set tenant context on request
    request.tenantId = user.tenantId;

    return true;
  }

  private async logSecurityEvent(
    userId: string | undefined,
    tenantId: string | null | undefined,
    action: string,
    metadata: Record<string, any>,
    request: any,
  ): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to log security event', error);
    }
  }
}

