import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { TenantModule, TenantService } from '../tenant/tenant.service';

/** Keeps users out of modules the tenant has not enabled (the server enforces this too). */
export const moduleGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const tenantService = inject(TenantService);
  const router = inject(Router);
  const requiredModule = route.data?.['module'] as TenantModule | undefined;

  if (!requiredModule) return of(true);

  const off = () => router.createUrlTree(['/unavailable'], { queryParams: { module: requiredModule } });
  return tenantService.loadTenant().pipe(
    // The business as saved on this device may be old (the owner just turned the module on): before saying
    // "turned off", ask the server once. Turned off: a page that says so, not a silent jump to Home.
    switchMap((tenant) =>
      tenantService.isModuleEnabled(requiredModule, tenant)
        ? of(true)
        : tenantService.loadTenant(true).pipe(
            map((fresh) => (tenantService.isModuleEnabled(requiredModule, fresh) ? true : off())),
            catchError(() => of(off())),
          ),
    ),
    catchError(() => of(router.createUrlTree(['/home']))),
  );
};
