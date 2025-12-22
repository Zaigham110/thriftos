/**
 * Permission Guard - Protects routes requiring specific permissions
 * Phase 1: Authentication & Shell
 */

import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { map, filter, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AuthService } from '../auth';

export const permissionGuard: CanActivateFn = (
  route,
  state
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredPermissions = route.data?.['permissions'] as string[] | undefined;
  const requireAll = route.data?.['requireAllPermissions'] as boolean | undefined;

  return authService.waitForAuth().pipe(
    filter((ready) => ready),
    take(1),
    map(() => {
      if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        });
      }

      // Super Admin bypasses permission checks
      if (authService.isSuperAdmin()) {
        return true;
      }

      // If no permissions required, allow access
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      // Check permissions
      const hasPermission = requireAll
        ? authService.hasAllPermissions(requiredPermissions)
        : authService.hasAnyPermission(requiredPermissions);

      if (hasPermission) {
        return true;
      }

      // Redirect to 403 page for unauthorized access
      return router.createUrlTree(['/error/403']);
    })
  );
};
