import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { fail } from './util';

export interface Actor {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  /** The branch this request works in: the person's own branch, or the one the owner picked. */
  branchId: string;
  /** Cost and profit: the owner always, a manager when the owner allowed it, a cashier never. */
  seesCost: boolean;
}

/** No sign-in needed (setup, login, health). */
export const Public = () => SetMetadata('public', true);
/** Only the owner: shipments, costs, staff, branches, settings. */
export const OwnerOnly = () => SetMetadata('minRole', UserRole.OWNER);
/** Owner or a branch manager: cancelling, returns, closing a shift, expenses, reports. */
export const ManagerUp = () => SetMetadata('minRole', UserRole.MANAGER);

export const Me = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().actor);

const RANK: Record<UserRole, number> = { CASHIER: 1, MANAGER: 2, OWNER: 3 };
export const isManager = (me: Actor) => RANK[me.role] >= RANK.MANAGER;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let userId = '';
    try {
      userId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      fail('SIGN_IN', 'Please sign in again.', 401);
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { shop: { select: { managerSeesCost: true } } } });
    if (!user || !user.active) fail('SIGN_IN', 'Please sign in again.', 401);

    const need = this.reflector.getAllAndOverride<UserRole>('minRole', targets);
    if (need && RANK[user.role] < RANK[need]) {
      fail(need === UserRole.OWNER ? 'OWNER_ONLY' : 'MANAGER_ONLY', need === UserRole.OWNER ? 'Only the shop owner can do this.' : 'Only a manager or the owner can do this.', 403);
    }

    // Staff work in their own branch. The owner works in the branch the screen names (or the first one).
    let branchId = user.branchId;
    if (!branchId || user.role === UserRole.OWNER) {
      const asked = String(req.headers['x-branch'] ?? '');
      const branch =
        (asked ? await this.prisma.branch.findFirst({ where: { id: asked, tenantId: user.tenantId } }) : null) ??
        (await this.prisma.branch.findFirst({ where: { tenantId: user.tenantId, active: true }, orderBy: { createdAt: 'asc' } }));
      if (!branch) fail('NO_BRANCH', 'This shop has no branch yet.', 409);
      branchId = branch.id;
    }
    req.actor = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      branchId,
      seesCost: user.role === UserRole.OWNER || (user.role === UserRole.MANAGER && user.shop.managerSeesCost),
    } satisfies Actor;
    return true;
  }
}
