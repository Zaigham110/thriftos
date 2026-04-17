import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Legacy tenant redirect
 *
 * Preserves deep links from the pre-/app route space by prefixing `/app`.
 * Examples:
 * - /procurement/pos/123 -> /app/procurement/pos/123
 * - /dashboard -> /app/dashboard
 */
@Component({
  selector: 'app-legacy-tenant-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegacyTenantRedirectComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    const url = this.router.url || '/';
    void this.router.navigateByUrl(`/app${url}`, { replaceUrl: true });
  }
}
