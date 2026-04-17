/**
 * Admin Shell Component
 *
 * Isolated SuperAdmin shell (no tenant operational nav).
 */

import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AppShellLayoutComponent, type SidebarNavConfig } from '../../shared/ui';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, AppShellLayoutComponent],
  template: `
    <app-shell-layout
      [tenantName]="tenantName()"
      [userName]="userName()"
      [showSwitchTenant]="false"
      [nav]="nav"
      (profile)="onProfile()"
      (signOut)="onSignOut()"
    />
  `,
  styles: [],
})
export class AdminShellComponent {
  protected readonly user = computed(() => this.authService.user());
  protected readonly tenantName = computed(() => 'ThriftOS Admin');
  protected readonly userName = computed(() => this.user()?.name || this.user()?.email || 'Super Admin');

  protected readonly nav: SidebarNavConfig = {
    productName: 'ThriftOS',
    productSubtitle: 'SuperAdmin',
    logoUrl: '/favicon.ico',
    dashboard: { id: 'tenants', label: 'Tenants', route: '/admin/tenants', icon: 'layers' },
    groups: [
      {
        id: 'management',
        label: 'Management',
        icon: 'layers',
        items: [
          { id: 'tenants', label: 'Tenants', route: '/admin/tenants', icon: 'layers' },
          { id: 'users', label: 'Users', route: '/admin/users', icon: 'file-text' },
        ],
      },
      {
        id: 'commercial',
        label: 'Commercial',
        icon: 'tag',
        items: [
          { id: 'plans', label: 'Plans', route: '/admin/plans', icon: 'tag' },
          { id: 'billing', label: 'Billing', route: '/admin/billing', icon: 'shopping-cart' },
        ],
      },
      {
        id: 'system',
        label: 'System',
        icon: 'settings',
        items: [
          { id: 'audit', label: 'Audit', route: '/admin/audit', icon: 'file-text' },
          { id: 'settings', label: 'Settings', route: '/admin/settings', icon: 'settings' },
        ],
      },
    ],
  };

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  onProfile(): void {
    // Intentionally not implemented in this hardening pass.
  }

  onSignOut(): void {
    this.authService.logout().subscribe();
    void this.router.navigate(['/auth/login']);
  }
}
