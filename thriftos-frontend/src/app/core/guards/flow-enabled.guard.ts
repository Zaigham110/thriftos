import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TenantService } from '../tenant/tenant.service';

/** Keeps Flow rollout tenant-controlled while legacy Lite remains available. */
export const flowEnabledGuard: CanActivateFn = () => {
  const tenantService = inject(TenantService);
  const router = inject(Router);
  return tenantService.loadTenant().pipe(
    map((tenant) => tenant.flowEnabled ? true : router.createUrlTree(['/app/lite/home'])),
    catchError(() => of(router.createUrlTree(['/app/lite/home']))),
  );
};
