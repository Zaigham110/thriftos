/**
 * Post-login redirect component
 * Resolves the correct landing route based on auth + impersonation state.
 *
 * Rules:
 * - SUPERADMIN (not impersonating) -> /admin
 * - Operational tenant user         -> /app/lite/home (My Work)
 * - Administration-only tenant user -> /app/dashboard
 * - Authenticated w/o tenant       -> /auth/no-tenant
 */

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';
import { OperationModeService } from '../../core/config/operation-mode.service';

@Component({
  selector: 'app-post-login-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostLoginRedirectComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly modeService = inject(OperationModeService);
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

    if (this.modeService.isSimplifiedMobile() || this.isOperationalUser()) {
      void this.router.navigate(['/app/lite/home']);
    } else {
      void this.router.navigate(['/app/dashboard']);
    }
  }

  private isOperationalUser(): boolean {
    const operationalPrefixes = ['rag.', 'sorting.', 'repack.', 'inventory.', 'sales.'];
    return this.authService.permissions().some((permission) =>
      operationalPrefixes.some((prefix) => permission.startsWith(prefix)),
    );
  }
}
