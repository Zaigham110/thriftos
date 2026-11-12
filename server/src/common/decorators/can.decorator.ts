import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Whether the signed-in person holds a permission, for routes that answer differently with it (cost and profit
 * need cost.view). Only on routes behind PermissionGuard with a declared permission: the guard reads the roles.
 */
export const Can = createParamDecorator((permission: string, ctx: ExecutionContext): boolean => {
  const request = ctx.switchToHttp().getRequest();
  return request.seesEverything === true || (Array.isArray(request.permissionCodes) && request.permissionCodes.includes(permission));
});
