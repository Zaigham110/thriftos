import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth';

/**
 * Someone signed in with a password ThriftOS made (a new owner, or a reset from the console) chooses their own
 * before anything else (v2: owners sign in with email). Only the change-password page opens until then.
 */
export const passwordGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (!auth.user()?.mustChangePassword || state.url.startsWith('/settings/password')) return true;
  return inject(Router).createUrlTree(['/settings/password']);
};
