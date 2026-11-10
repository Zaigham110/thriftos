import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import type { TenantModule } from '../../tenant/dto/tenant-settings.dto';
import { ModuleGuard, REQUIRED_MODULE_KEY } from '../guards/module.guard';

export { REQUIRED_MODULE_KEY };

/**
 * The route (or every route of the controller) works only when the business has this module in
 * `Tenant.enabledModules` (with several, any one of them); otherwise 403. For super admin routes it is the SYSTEM business's list.
 */
export const RequireModule = (...modules: TenantModule[]) =>
  applyDecorators(SetMetadata(REQUIRED_MODULE_KEY, modules.length === 1 ? modules[0] : modules), UseGuards(ModuleGuard));
