/**
 * Admin Area Guard
 *
 * Allows access to /admin/** ONLY when:
 * - authenticated
 * - super admin
 * - NOT impersonating (admin UI must not mix with tenant mode)
 */

import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

import { AuthService } from '../auth';

export const adminAreaGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return combineLatest([authService.waitForAuth(), authService.waitForImpersonation()]).pipe(
    filter(([authReady, impReady]) => authReady && impReady),
    take(1),
    map(() => {
      if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
      }

      // If tenant user hits /admin/**, bounce to tenant space.
      if (!authService.isSuperAdmin()) {
        return router.createUrlTree(['/home']);
      }

      // If superadmin is impersonating, they must stay in tenant space.
      if (authService.isImpersonating()) {
        return router.createUrlTree(['/home']);
      }

      return true;
    }),
  );
};
