/**
 * Super Admin Routes
 * Phase 1: Authentication & Shell
 */

import { Routes } from '@angular/router';

export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'tenants',
    pathMatch: 'full',
  },
  {
    path: 'tenants',
    loadChildren: () => import('./tenants/tenants.routes').then((m) => m.TENANTS_ROUTES),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('../../../features/admin-shell/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
    data: {
      title: 'Users',
      subtitle: 'SuperAdmin',
      message: 'User administration is not configured yet in this workspace.',
    },
    title: 'Users - ThriftOS Admin',
  },
  {
    path: 'plans',
    loadComponent: () =>
      import('../../../features/admin-shell/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
    data: {
      title: 'Plans',
      subtitle: 'SuperAdmin',
      message: 'Plan configuration is not configured yet in this workspace.',
    },
    title: 'Plans - ThriftOS Admin',
  },
  {
    path: 'billing',
    loadComponent: () =>
      import('../../../features/admin-shell/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
    data: {
      title: 'Billing',
      subtitle: 'SuperAdmin',
      message: 'Billing configuration is not configured yet in this workspace.',
    },
    title: 'Billing - ThriftOS Admin',
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('../../../features/admin-shell/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
    data: {
      title: 'Audit',
      subtitle: 'SuperAdmin',
      message: 'Audit logs are not configured yet in this workspace.',
    },
    title: 'Audit - ThriftOS Admin',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('../../../features/admin-shell/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
    data: {
      title: 'Settings',
      subtitle: 'SuperAdmin',
      message: 'SuperAdmin settings are not configured yet in this workspace.',
    },
    title: 'Settings - ThriftOS Admin',
  },
];
