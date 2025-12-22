import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, SKIP_PERMISSION_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CurrentUserData } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    // Check if route is public (skip permission check)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Check if permission check should be skipped (e.g., for /me endpoint)
    const skipPermission = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // DENY BY DEFAULT: If no permissions declared and not explicitly skipped, deny access
    if (!skipPermission && (!requiredPermissions || requiredPermissions.length === 0)) {
      const handler = context.getHandler().name;
      const controller = context.getClass().name;
      this.logger.warn(
        `DENY BY DEFAULT: No permissions declared for ${controller}.${handler}`,
      );
      
      // Log security event
      await this.logSecurityEvent(
        user?.userId,
        user?.tenantId || (request as any).tenantId,
        'PERMISSION_DENIED_NO_DECLARATION',
        {
          controller,
          handler,
          path: request.path,
          method: request.method,
        },
        request,
      );
      
      throw new ForbiddenException('Access denied: endpoint requires explicit permission declaration');
    }

    // If explicitly skipped, allow access
    if (skipPermission) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is active
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      await this.logSecurityEvent(
        user.userId,
        user.tenantId || (request as any).tenantId,
        'PERMISSION_DENIED_INACTIVE_USER',
        {
          path: request.path,
          method: request.method,
        },
        request,
      );
      throw new ForbiddenException('User account is inactive');
    }

    // Super Admin bypasses permission checks (but still logged)
    if (user.isSuperAdmin) {
      return true;
    }

    // Get user's permissions through roles
    const userPermissions = await this.getUserPermissions(user.userId);

    // Check if user has all required permissions
    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      // Log permission denied attempt
      await this.logSecurityEvent(
        user.userId,
        user.tenantId || (request as any).tenantId,
        'PERMISSION_DENIED',
        {
          path: request.path,
          method: request.method,
          required: requiredPermissions,
          missing: missingPermissions,
          userPermissions: userPermissions,
        },
        request,
      );

      throw new ForbiddenException(
        `Missing required permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
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

    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return Array.from(permissions);
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

