import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import type { TenantModule } from '../../tenant/dto/tenant-settings.dto';
import { ModuleGuard, REQUIRED_MODULE_KEY } from '../guards/module.guard';

export { REQUIRED_MODULE_KEY };

/**
 * The route (or every route of the controller) works only when the business has this module in
 * `Tenant.enabledModules`; otherwise 403. For super admin routes it is the SYSTEM business's list.
 */
export const RequireModule = (module: TenantModule) => applyDecorators(SetMetadata(REQUIRED_MODULE_KEY, module), UseGuards(ModuleGuard));
