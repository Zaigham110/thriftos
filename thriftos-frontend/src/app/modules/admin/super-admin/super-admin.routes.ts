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
];
