import { inject } from '@angular/core';
import { TenantModule, TenantService } from './tenant.service';

/**
 * For templates: `protected readonly on = moduleOn();` then `@if (on('KHATA'))`. Reads the business signal, so a
 * module the super admin turns on or off shows or hides without a reload once the business is fetched again.
 */
export function moduleOn(): (module: TenantModule | readonly TenantModule[]) => boolean {
  const tenants = inject(TenantService);
  return (module) => tenants.isModuleEnabled(module, tenants.tenant());
}
