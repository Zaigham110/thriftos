import { ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuditService } from '../../audit/audit.service';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private audit: AuditService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser, info: any, context?: ExecutionContext): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    if (context) this.supportViewIsReadOnly(user as any, context);
    return user;
  }

  /**
   * v2 6.5: a super admin inside a business (support view) may look but not change anything. Signing out and leaving
   * the business (`/auth/*`) still work. Every blocked attempt is in the audit log.
   */
  private supportViewIsReadOnly(user: { userId?: string; isSuperAdmin?: boolean; impersonatedTenantId?: string | null }, context: ExecutionContext): void {
    if (!user.isSuperAdmin || !user.impersonatedTenantId) return;
    const req = context.switchToHttp().getRequest();
    const path: string = req.originalUrl || req.url || '';
    if (READS.has(req.method) || /\/auth\//.test(path.split('?')[0])) return;
    this.audit
      .log({
        userId: user.userId ?? null,
        tenantId: user.impersonatedTenantId,
        action: 'SUPPORT_VIEW_WRITE_BLOCKED',
        entityType: 'Security',
        entityId: path.split('?')[0],
        metadataJson: { method: req.method, path: path.split('?')[0] },
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      })
      .catch((e: unknown) => this.logger.error('Failed to log blocked support-view write', e as Error));
    throw new ForbiddenException('Support view is read-only. Ask the owner to make this change.');
  }
}
