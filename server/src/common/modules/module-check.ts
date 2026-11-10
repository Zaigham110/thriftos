import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ModuleKey } from './modules';

/** For checks a route decorator cannot make (a loose lot vs a container lot, a credit sale): 403 when it is off. */
export async function assertModule(prisma: Pick<PrismaService, 'tenant'>, tenantId: string, module: ModuleKey): Promise<void> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { enabledModules: true } });
  if (!t?.enabledModules.includes(module)) {
    throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'MODULE_DISABLED', module, message: `${module} is not turned on for this business` });
  }
}
