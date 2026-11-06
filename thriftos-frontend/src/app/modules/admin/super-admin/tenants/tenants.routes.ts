/**
 * Super admin: businesses. New business is the three-field form; the old long form and the separate edit page are
 * gone (v2 review): editing happens on the business page.
 */

import { Routes } from '@angular/router';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tenants-list/tenants-list').then((m) => m.TenantsListComponent),
    title: 'Businesses - ThriftOS Admin',
  },
  {
    path: 'quick',
    loadComponent: () => import('./tenant-quick/tenant-quick.component').then((m) => m.TenantQuickComponent),
    title: 'New business - ThriftOS Admin',
  },
  { path: 'new', redirectTo: 'quick', pathMatch: 'full' },
  { path: ':id/edit', redirectTo: ':id', pathMatch: 'full' },
  {
    path: ':id',
    loadComponent: () => import('./tenant-detail/tenant-detail').then((m) => m.TenantDetailComponent),
    title: 'Business - ThriftOS Admin',
  },
];
