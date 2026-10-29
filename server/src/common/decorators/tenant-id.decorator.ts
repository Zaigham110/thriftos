import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/** The tenant the request acts for: TenantGuard's resolved tenant (incl. impersonation), else the user's own. */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const tenantId = request.tenantId || request.user?.tenantId;
  if (!tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return tenantId;
});
