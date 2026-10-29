/**
 * Tenant Area Guard
 *
 * Allows access to the tenant app ONLY when:
 * - authenticated
 * - (tenant user) OR (super admin impersonating)
 * - tenant context exists
 */

import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

import { AuthService } from '../auth';

export const tenantAreaGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return combineLatest([authService.waitForAuth(), authService.waitForImpersonation()]).pipe(
    filter(([authReady, impReady]) => authReady && impReady),
    take(1),
    map(() => {
      if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
      }

      // Super admin is only allowed in tenant space while impersonating.
      if (authService.isSuperAdmin() && !authService.isImpersonating()) {
        return router.createUrlTree(['/admin']);
      }

      const user = authService.user();
      const effectiveTenantId = user?.tenantId ?? user?.impersonatedTenantId ?? null;
      if (!effectiveTenantId) {
        return router.createUrlTree(['/auth/no-tenant']);
      }

      return true;
    }),
  );
};
