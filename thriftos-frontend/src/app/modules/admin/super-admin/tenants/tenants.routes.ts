/**
 * Super Admin Tenants Routes
 * Phase 1: Authentication & Shell
 */

import { Routes } from '@angular/router';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tenants-list/tenants-list').then((m) => m.TenantsListComponent),
    title: 'Tenants - ThriftOS Admin',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./tenant-detail/tenant-detail').then((m) => m.TenantDetailComponent),
    title: 'Tenant Details - ThriftOS Admin',
  },
];
