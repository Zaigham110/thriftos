/**
 * Impersonation Banner - High-visibility warning when Super Admin is impersonating a tenant
 * Phase 1: Authentication & Shell
 * 
 * NON-NEGOTIABLE UX RULES:
 * - Persistent banner at top of screen
 * - High-visibility warning style
 * - "Exit Impersonation" button always visible
 */

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, X, LogOut } from 'lucide-angular';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './impersonation-banner.html',
  styleUrl: './impersonation-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonationBannerComponent {
  protected readonly icons = {
    AlertTriangle,
    X,
    LogOut,
  };

  protected readonly isExiting = signal(false);

  protected readonly isImpersonating = computed(() => this.authService.isImpersonating());
  protected readonly impersonatedTenantId = computed(() => {
    const user = this.authService.user();
    return user?.tenantId || user?.impersonatedTenantId || null;
  });
  protected readonly tenantName = computed(() => {
    const user = this.authService.user();
    // Try to get tenant name from user context
    // For now, show the tenant ID or "Tenant" if available
    const tenantId = user?.tenantId || user?.impersonatedTenantId;
    return tenantId ? `Tenant ID: ${tenantId.slice(0, 8)}...` : 'Unknown Tenant';
  });

  constructor(private readonly authService: AuthService) {}

  exitImpersonation(): void {
    this.isExiting.set(true);
    this.authService.exitImpersonation().subscribe({
      next: () => this.isExiting.set(false),
      error: () => this.isExiting.set(false),
    });
  }
}
