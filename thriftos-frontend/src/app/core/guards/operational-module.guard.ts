import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { OperationalModule, TenantService } from '../tenant/tenant.service';

/** Keeps users out of modules the tenant has not enabled (the server enforces this too). */
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
        : router.createUrlTree(['/home']);
    }),
    catchError(() => of(router.createUrlTree(['/home']))),
  );
};
