/**
 * Super Admin Routes
 * Multi-tenant SuperAdmin operations and platform governance.
 */

import { Routes } from '@angular/router';

export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/super-admin-dashboard.component').then((m) => m.SuperAdminDashboardComponent),
    title: 'SuperAdmin Operations Cockpit - ThriftOS',
  },
  {
    path: 'tenants',
    loadChildren: () => import('./tenants/tenants.routes').then((m) => m.TENANTS_ROUTES),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./users/global-users.component').then((m) => m.GlobalUsersComponent),
    title: 'People - ThriftOS Admin',
  },
  // Plans and billing showed sample numbers and were never part of ThriftOS (v2 review): old links go to the overview.
  { path: 'plans', redirectTo: 'dashboard' },
  { path: 'billing', redirectTo: 'dashboard' },
  {
    path: 'audit',
    loadComponent: () =>
      import('./audit/global-audit.component').then((m) => m.GlobalAuditComponent),
    title: 'Security Audit Stream - ThriftOS Admin',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/super-admin-settings.component').then((m) => m.SuperAdminSettingsComponent),
    title: 'System Settings - ThriftOS Admin',
  },
];
