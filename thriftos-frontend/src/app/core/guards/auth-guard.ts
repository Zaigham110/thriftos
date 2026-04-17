/**
 * Auth Guard - Protects routes requiring authentication
 * Phase 1: Authentication & Shell
 */

import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { map, filter, take } from 'rxjs/operators';
import { Observable, combineLatest } from 'rxjs';
import { AuthService } from '../auth';

export const authGuard: CanActivateFn = (
  route,
  state
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return combineLatest([
    authService.waitForAuth(),
    authService.waitForImpersonation(),
  ]).pipe(
    filter(([authReady, impersonationReady]) => authReady && impersonationReady),
    take(1),
    map(() => {
      if (authService.isAuthenticated()) {
        return true;
      }

      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    })
  );
};
