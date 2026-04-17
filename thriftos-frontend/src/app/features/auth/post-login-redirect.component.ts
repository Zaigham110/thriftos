/**
 * Post-login redirect component
 * Resolves the correct landing route based on auth + impersonation state.
 *
 * Rules:
 * - SUPERADMIN (not impersonating) -> /admin
 * - TENANT (or impersonating)      -> /app/dashboard
 * - Authenticated w/o tenant       -> /auth/no-tenant
 */

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-post-login-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostLoginRedirectComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const isAuthed = this.authService.isAuthenticated();
    if (!isAuthed) {
      void this.router.navigate(['/auth/login']);
      return;
    }

    const isSuperAdmin = this.authService.isSuperAdmin();
    const isImpersonating = this.authService.isImpersonating();
    const user = this.authService.user();

    if (isSuperAdmin && !isImpersonating) {
      void this.router.navigate(['/admin']);
      return;
    }

    // Tenant user OR impersonating super admin
    const effectiveTenantId = user?.tenantId ?? user?.impersonatedTenantId ?? null;
    if (!effectiveTenantId) {
      void this.router.navigate(['/auth/no-tenant']);
      return;
    }

    void this.router.navigate(['/app/dashboard']);
  }
}
