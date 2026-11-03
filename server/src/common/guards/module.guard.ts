import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantModule } from '../../tenant/dto/tenant-settings.dto';
import type { CurrentUserData } from '../decorators/current-user.decorator';

export const REQUIRED_MODULE_KEY = 'requiredModule';
export const SYSTEM_COMPANY_CODE = 'SYSTEM';

/**
 * Refuses (403) a route whose module the business has not turned on. Works on its own, whatever order it runs in
 * with TenantGuard: the business is the user's own, the one a super admin is impersonating, or — on super admin
 * routes without impersonation — the SYSTEM business.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<TenantModule | undefined>(REQUIRED_MODULE_KEY, [context.getHandler(), context.getClass()]);
    if (!module) return true;
    const user = context.switchToHttp().getRequest().user as CurrentUserData | undefined;
    if (!user) throw new ForbiddenException('User not authenticated');

    const tenantId = user.isSuperAdmin ? user.impersonatedTenantId : user.tenantId;
    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { enabledModules: true } })
      : user.isSuperAdmin
        ? await this.prisma.tenant.findUnique({ where: { companyCode: SYSTEM_COMPANY_CODE }, select: { enabledModules: true } })
        : null;
    if (!tenant?.enabledModules.includes(module)) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'MODULE_DISABLED', module, message: `${module} is not turned on for this business` });
    }
    return true;
  }
}
