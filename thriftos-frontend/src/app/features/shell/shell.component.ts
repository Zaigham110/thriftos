/**
 * ===============================
 * APP SHELL COMPONENT - PHASE 0
 * ===============================
 * 
 * DESIGN SYSTEM COMPLIANCE:
 * ✓ Uses app-page hierarchy
 * ✓ Sidebar with 7 modules ONLY
 * ✓ Top bar with context ONLY
 * ✓ NO feature UI
 * ✓ NO business logic
 * ✓ NO custom layout
 */

import { Component, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AppShellLayoutComponent, type SidebarNavConfig } from '../../shared/ui';
import { AuthService } from '../../core/auth';
import { TenantService } from '../../core/tenant/tenant.service';

@Component({
  selector: 'app-thrift-shell',
  standalone: true,
  imports: [
    CommonModule,
    AppShellLayoutComponent,
  ],
  template: `
    <app-shell-layout
      [tenantName]="tenantName()"
      [userName]="userName()"
      [showSwitchTenant]="showSwitchTenant()"
      [showImpersonationBanner]="isImpersonating()"
      [impersonationBannerText]="impersonationBannerText()"
      [nav]="nav"
      (profile)="onProfile()"
      (switchTenant)="onSwitchTenant()"
      (exitImpersonation)="onExitImpersonation()"
      (signOut)="onSignOut()"
    />
  `,
  styles: [],
})
export class ThriftShellComponent {
  protected readonly user = computed(() => this.authService.user());
  protected readonly tenant = computed(() => this.tenantService.tenant());
  protected readonly isImpersonating = computed(() => this.authService.isImpersonating());

  protected readonly tenantName = computed(() => {
    const user = this.user();
    const tenant = this.tenant();
    if (tenant?.name) return tenant.name;
    if (user?.tenantId) return 'Tenant';
    return 'No Tenant';
  });

  protected readonly userName = computed(() => this.user()?.name || 'User');
  protected readonly showSwitchTenant = computed(() => false);

  protected readonly impersonationBannerText = computed(() => {
    if (!this.isImpersonating()) return '';
    return `Impersonating Tenant: ${this.tenantName()}`;
  });

  protected readonly nav: SidebarNavConfig = {
    productName: 'ThriftOS',
    productSubtitle: 'Operations & Inventory Platform',
    logoUrl: '/os_logo.png',
    dashboard: { id: 'dashboard', label: 'Dashboard', route: '/app/dashboard', icon: 'layout-dashboard' },
    groups: [
      {
        id: 'sales',
        label: 'Sales',
        icon: 'file-text',
        items: [
          { id: 'sales', label: 'Sales Orders', route: '/app/sales', icon: 'file-text' },
        ],
      },
      {
        id: 'procurement',
        label: 'Procurement',
        icon: 'shopping-cart',
        items: [
          { id: 'dashboard', label: 'Dashboard', route: '/app/procurement/dashboard', icon: 'layout-dashboard' },
          { id: 'po', label: 'Purchase Orders', route: '/app/procurement/pos', icon: 'file-text' },
          { id: 'containers', label: 'Containers', route: '/app/procurement/containers', icon: 'container' },
          { id: 'loose-bales', label: 'Loose Bales', route: '/app/procurement/loose-bales', icon: 'tag' },
        ],
      },
      {
        id: 'sorting',
        label: 'Sorting',
        icon: 'layers',
        items: [
          { id: 'stage1', label: 'Stage 1 — Category', route: '/app/sorting/stage-1', icon: 'layers' },
          { id: 'stage2', label: 'Stage 2 — Grading', route: '/app/sorting/stage-2', icon: 'tag' },
          { id: 'outputs', label: 'Output Registry', route: '/app/sorting/outputs', icon: 'file-text' },
        ],
      },
      {
        id: 'packaging',
        label: 'Packaging',
        icon: 'package',
        items: [
          { id: 'packaging', label: 'Packaging', route: '/app/packaging/repack', icon: 'package' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: 'warehouse',
        items: [{ id: 'inventory', label: 'Inventory', route: '/app/inventory', icon: 'warehouse' }],
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: 'bar-chart-3',
        items: [
          { id: 'reports-dashboard', label: 'Dashboard', route: '/app/reports', icon: 'layout-dashboard' },
          { id: 'inventory-report', label: 'Inventory Report', route: '/app/reports/inventory', icon: 'warehouse' },
          { id: 'procurement-report', label: 'Procurement Report', route: '/app/reports/procurement', icon: 'shopping-cart' },
          { id: 'waste-report', label: 'Waste Report', route: '/app/reports/waste', icon: 'trash-2' },
          { id: 'yield-report', label: 'Yield Report', route: '/app/reports/yield', icon: 'trending-up' },
        ],
      },
      {
        id: 'admin',
        label: 'Administration',
        icon: 'settings',
        items: [
          { id: 'users', label: 'Users', route: '/app/admin/users', icon: 'users' },
          { id: 'roles', label: 'Roles', route: '/app/admin/roles', icon: 'shield' },
          { id: 'warehouses', label: 'Warehouses', route: '/app/admin/warehouses', icon: 'warehouse' },
          { id: 'vendors', label: 'Vendors', route: '/app/admin/vendors', icon: 'truck' },
          { id: 'categories', label: 'Categories', route: '/app/admin/categories', icon: 'layers' },
          { id: 'grades', label: 'Grades', route: '/app/admin/grades', icon: 'tag' },
          { id: 'raw-categories', label: 'Raw Categories', route: '/app/admin/raw-categories', icon: 'box' },
          { id: 'waste-categories', label: 'Waste Categories', route: '/app/admin/waste-categories', icon: 'trash-2' },
        ],
      },
    ],
  };

  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly router: Router
  ) {
    // Phase-0: load tenant profile only for displaying company name in topbar.
    effect(() => {
      const user = this.user();
      const hasTenantContext = !!(user?.tenantId || user?.impersonatedTenantId);
      if (hasTenantContext) {
        this.tenantService.loadTenant().subscribe({
          next: () => { },
          error: () => { },
        });
      }
    });
  }

  onProfile(): void {
    // Phase-0: no profile UI
  }

  onSwitchTenant(): void {
    // Phase-0: no tenant switch UI
  }

  onExitImpersonation(): void {
    this.authService.exitImpersonation().subscribe();
  }

  onSignOut(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
}
