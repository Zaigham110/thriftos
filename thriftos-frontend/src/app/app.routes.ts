/**
 * ===============================
 * APPLICATION ROUTES - PHASE 0
 * ===============================
 * 
 * Route Structure:
 * - /auth/login - Public login page
 * - /auth/no-tenant - No tenant assigned
 * - /auth/unauthorized - Access restricted
 * - /* - Authenticated routes with shell
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  // Default redirect
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },

  // Auth routes (public)
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in - ThriftOS',
  },
  {
    path: 'auth/no-tenant',
    loadComponent: () =>
      import('./features/auth/no-tenant/no-tenant.component').then((m) => m.NoTenantComponent),
    title: 'No Tenant - ThriftOS',
  },
  {
    path: 'auth/unauthorized',
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
    title: 'Access Restricted - ThriftOS',
  },

  // Legacy login redirect
  {
    path: 'login',
    redirectTo: '/auth/login',
    pathMatch: 'full',
  },

  // Authenticated routes with shell
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ThriftShellComponent),
    canActivate: [authGuard],
    children: [
      // Phase-0: ALL authenticated routes render the placeholder only.
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard').then((m) => m.DashboardComponent),
        title: 'Dashboard - ThriftOS',
      },

      // Procurement (Phase-2 module)
      {
        path: 'procurement',
        loadChildren: () =>
          import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
      },

      // Sorting
      {
        path: 'sorting',
        loadChildren: () =>
          import('./modules/sorting/sorting.routes').then((m) => m.SORTING_ROUTES),
      },

      // Packaging
      {
        path: 'packaging/repack',
        loadChildren: () =>
          import('./modules/repack/repack.routes').then((m) => m.REPACK_ROUTES),
      },
      {
        path: 'packaging/draft-packs',
        loadComponent: () =>
          import('./features/shell/module-placeholder.component').then((m) => m.ModulePlaceholderComponent),
        title: 'Draft Packs - ThriftOS',
      },

      // Inventory / Reports / Settings
      {
        path: 'inventory',
        loadChildren: () =>
          import('./modules/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./modules/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },

      // Redirects for group roots
      {
        path: 'sorting',
        redirectTo: 'sorting/stage-1',
        pathMatch: 'full',
      },
      {
        path: 'packaging',
        redirectTo: 'packaging/repack',
        pathMatch: 'full',
      },
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
