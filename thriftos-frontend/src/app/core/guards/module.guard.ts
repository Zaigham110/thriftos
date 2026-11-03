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
    map((tenant) => (tenantService.isModuleEnabled(requiredModule, tenant) ? true : router.createUrlTree(['/home']))),
    catchError(() => of(router.createUrlTree(['/home']))),
  );
};
