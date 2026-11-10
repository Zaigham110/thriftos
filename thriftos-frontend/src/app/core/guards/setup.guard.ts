import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from '../auth';
import { TenantService } from '../tenant/tenant.service';

/**
 * A business that has not been set up sends its owner to the setup wizard first (journey 8).
 * Others (a munshi, or offline with no tenant data) go on as usual.
 */
export const setupGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const tenants = inject(TenantService);
  const router = inject(Router);
  if (!auth.permissions().includes('tenant.update')) return of(true);
  // Their own password first (passwordGuard), then the setup.
  if (auth.user()?.mustChangePassword) return of(true);
  return tenants.loadTenant().pipe(
    map((t) => (t && t.setupCompletedAt === null ? router.createUrlTree(['/setup']) : true)),
    catchError(() => of(true)),
  );
};
