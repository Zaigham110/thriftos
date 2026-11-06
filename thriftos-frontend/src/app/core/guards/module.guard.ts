import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { TenantModule, TenantService } from '../tenant/tenant.service';

/** Keeps users out of modules the tenant has not enabled (the server enforces this too). */
export const moduleGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const tenantService = inject(TenantService);
  const router = inject(Router);
  const requiredModule = route.data?.['module'] as TenantModule | undefined;

  if (!requiredModule) return of(true);

  return tenantService.loadTenant().pipe(
    // Turned off: a page that says so (and how to turn it on), not a silent jump to Home.
    map((tenant) => (tenantService.isModuleEnabled(requiredModule, tenant) ? true : router.createUrlTree(['/unavailable'], { queryParams: { module: requiredModule } }))),
    catchError(() => of(router.createUrlTree(['/home']))),
  );
};
