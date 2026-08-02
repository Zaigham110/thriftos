import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { OperationalModule, TenantService } from '../tenant/tenant.service';

/** Prevents stale Lite bookmarks from bypassing a tenant's enabled-module profile. */
export const operationalModuleGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const tenantService = inject(TenantService);
  const router = inject(Router);
  const requiredModule = route.data?.['operationalModule'] as OperationalModule | undefined;

  if (!requiredModule) return of(true);

  return tenantService.loadTenant().pipe(
    map((tenant) => {
      const enabledModules = tenant.operationalModules;
      return !enabledModules?.length || enabledModules.includes(requiredModule)
        ? true
        : router.createUrlTree(['/app/lite/home']);
    }),
    catchError(() => of(router.createUrlTree(['/app/lite/home']))),
  );
};
