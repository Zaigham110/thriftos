/**
 * Super Admin Tenants Routes
 */

import { Routes } from '@angular/router';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tenants-list/tenants-list').then((m) => m.TenantsListComponent),
    title: 'Tenants Directory - ThriftOS Admin',
  },
  {
    path: 'quick',
    loadComponent: () =>
      import('./tenant-quick/tenant-quick.component').then((m) => m.TenantQuickComponent),
    title: 'New business - ThriftOS Admin',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./tenant-create/tenant-create.component').then((m) => m.TenantCreateComponent),
    title: 'Provision New Tenant - ThriftOS Admin',
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./tenant-edit/tenant-edit.component').then((m) => m.TenantEditComponent),
    title: 'Edit Tenant Configuration - ThriftOS Admin',
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./tenant-detail/tenant-detail').then((m) => m.TenantDetailComponent),
    title: 'Tenant Details - ThriftOS Admin',
  },
];
