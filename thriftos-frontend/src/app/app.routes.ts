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
import { adminAreaGuard } from './core/guards/admin-area.guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';

const LEGACY_TENANT_ROOTS = new Set(['dashboard', 'procurement', 'sorting', 'packaging', 'inventory', 'reports']);

const legacyTenantMatcher = (segments: import('@angular/router').UrlSegment[]): import('@angular/router').UrlMatchResult | null => {
  if (!segments.length) return null;
  const first = segments[0]?.path;
  if (!first) return null;
  if (!LEGACY_TENANT_ROOTS.has(first)) return null;
  return { consumed: segments };
};

export const routes: Routes = [
  // Default landing (role-aware)
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/post-login-redirect.component').then((m) => m.PostLoginRedirectComponent),
    canActivate: [authGuard],
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

  // SuperAdmin route space (isolated)
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    canActivate: [authGuard, adminAreaGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./modules/admin/super-admin/super-admin.routes').then((m) => m.SUPER_ADMIN_ROUTES),
      },
    ],
  },

  // Tenant app route space (isolated)
  {
    path: 'app',
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ThriftShellComponent),
    canActivate: [authGuard, tenantAreaGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard').then((m) => m.DashboardComponent),
        title: 'Dashboard - ThriftOS',
      },
      {
        path: 'procurement',
        loadChildren: () =>
          import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
      },
      {
        path: 'sorting',
        loadChildren: () =>
          import('./modules/sorting/sorting.routes').then((m) => m.SORTING_ROUTES),
      },
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
        path: 'sales',
        loadChildren: () =>
          import('./modules/sales/sales.routes').then((m) => m.SALES_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
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

  // Legacy tenant route space (redirect into /app while preserving deep-link segments)
  {
    matcher: legacyTenantMatcher,
    loadComponent: () =>
      import('./features/legacy/legacy-tenant-redirect.component').then((m) => m.LegacyTenantRedirectComponent),
  },

  // Fallback
  {
    path: '**',
    redirectTo: '/',
  },
];
