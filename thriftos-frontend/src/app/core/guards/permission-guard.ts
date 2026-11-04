/**
 * Permission Guard - Protects routes requiring specific permissions
 * Phase 1: Authentication & Shell
 */

import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
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
    switchMap(() => {
      if (!authService.isAuthenticated()) {
        return of(router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: state.url },
        }));
      }

      // Super Admin bypasses permission checks
      if (authService.isSuperAdmin()) {
        return of(true);
      }

      // If no permissions required, allow access
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return of(true);
      }

      const allowed = () =>
        requireAll ? authService.hasAllPermissions(requiredPermissions) : authService.hasAnyPermission(requiredPermissions);
      if (allowed()) {
        return of(true);
      }

      // The app opens with the last saved profile; a permission added since (e.g. by a new release) is only in a
      // fresh one. Ask once before saying no.
      return authService.loadCurrentUser().pipe(
        map(() => (allowed() ? true : router.createUrlTree(['/auth/unauthorized']))),
        catchError(() => of(router.createUrlTree(['/auth/unauthorized']))),
      );
    })
  );
};
