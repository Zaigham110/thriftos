/**
 * Application Routes - Phase 1: Authentication & Shell
 * 
 * Route Structure:
 * - /login - Public login page
 * - /error/403 - Access denied
 * - /error/404 - Page not found
 * - /admin/super/* - Super Admin routes (superAdminGuard)
 * - /app/* - Authenticated tenant routes (authGuard)
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { superAdminGuard } from './core/guards/super-admin-guard';
import { AppShellComponent } from './core/layout/app-shell/app-shell';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginComponent),
    title: 'Login - ThriftOS',
  },

  // Error pages
  {
    path: 'error/403',
    loadComponent: () =>
      import('./features/error/forbidden/forbidden').then((m) => m.ForbiddenComponent),
    title: 'Access Denied - ThriftOS',
  },
  {
    path: 'error/404',
    loadComponent: () =>
      import('./features/error/not-found/not-found').then((m) => m.NotFoundComponent),
    title: 'Page Not Found - ThriftOS',
  },

  // Authenticated routes with App Shell
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      // Super Admin routes
      {
        path: 'admin/super',
        canActivate: [superAdminGuard],
        loadChildren: () =>
          import('./modules/admin/super-admin/super-admin.routes').then(
            (m) => m.SUPER_ADMIN_ROUTES
          ),
      },

      // Tenant application routes
      {
        path: 'app',
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./features/dashboard/dashboard/dashboard').then(
                (m) => m.DashboardComponent
              ),
            title: 'Dashboard - ThriftOS',
          },
          // Procurement module
          {
            path: 'procurement',
            loadChildren: () =>
              import('./modules/procurement/procurement.routes').then(
                (m) => m.PROCUREMENT_ROUTES
              ),
          },
          // Sorting Stage 1 module (Phase 3)
          {
            path: 'sorting/stage1',
            loadChildren: () =>
              import('./modules/sorting-stage1/sorting-stage1.routes').then(
                (m) => m.SORTING_STAGE1_ROUTES
              ),
          },
          // Sorting Stage 2 module (Phase 4: Grading)
          {
            path: 'sorting/stage2',
            loadChildren: () =>
              import('./modules/sorting-stage2/sorting-stage2.routes').then(
                (m) => m.SORTING_STAGE2_ROUTES
              ),
          },
          // Repack module (Phase 5: Repack & QR Code Generation)
          {
            path: 'repack',
            loadChildren: () =>
              import('./modules/repack/repack.routes').then(
                (m) => m.REPACK_ROUTES
              ),
          },
          // Inventory module (Phase 6: Inventory Management)
          {
            path: 'inventory',
            loadChildren: () =>
              import('./modules/inventory/inventory.routes').then(
                (m) => m.INVENTORY_ROUTES
              ),
          },
          // Reports module (Phase 7: Reports & Analytics)
          {
            path: 'reports',
            loadChildren: () =>
              import('./modules/reports/reports.routes').then(
                (m) => m.REPORTS_ROUTES
              ),
          },
          // Admin module (Phase 8: Tenant Administration)
          {
            path: 'admin',
            loadChildren: () =>
              import('./modules/admin/admin.routes').then(
                (m) => m.ADMIN_ROUTES
              ),
          },
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full',
          },
        ],
      },

      // Default redirect based on role
      {
        path: '',
        redirectTo: 'app/dashboard',
        pathMatch: 'full',
      },
    ],
  },

  // Catch-all redirect to 404
  {
    path: '**',
    redirectTo: 'error/404',
  },
];
