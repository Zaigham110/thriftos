import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';
import { operationalModuleGuard } from './core/guards/operational-module.guard';
import { superAdminGuard } from './core/guards/super-admin-guard';

export const routes: Routes = [
  // Default redirect to /app
  {
    path: '',
    redirectTo: 'app',
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

  // Super-admin route space must be defined outside /app. Without this route,
  // the wildcard sends /admin to /app while tenantAreaGuard sends super admins
  // back to /admin, creating an infinite navigation loop.
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    canActivate: [authGuard, superAdminGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./modules/admin/super-admin/super-admin.routes').then((m) => m.SUPER_ADMIN_ROUTES),
      },
    ],
  },

  // Lite ERP Mode route space (isolated responsive shell)
  {
    path: 'app/lite',
    loadComponent: () =>
      import('./features/simplified-shell/simplified-shell.component').then((m) => m.SimplifiedShellComponent),
    canActivate: [authGuard, tenantAreaGuard],
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'WORK' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-home/mobile-home.component').then((m) => m.MobileHomeComponent),
        title: 'Lite ERP Home - ThriftOS',
      },
      {
        path: 'buying',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'INTAKE' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-buying/mobile-buying.component').then((m) => m.MobileBuyingComponent),
        title: 'Raw Bale Buying & Intake - ThriftOS Lite',
      },
      {
        path: 'sorting',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'SORTING' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-sorting/mobile-sorting.component').then((m) => m.MobileSortingComponent),
        title: 'Sorting Workstation - ThriftOS Lite',
      },
      {
        path: 'repack',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'REPACK' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-repack/mobile-repack.component').then((m) => m.MobileRepackComponent),
        title: 'Repack & QR Generator - ThriftOS Lite',
      },
      {
        path: 'lookup',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'STOCK' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-inventory/mobile-inventory.component').then((m) => m.MobileInventoryComponent),
        title: 'QR Lookup & Stock - ThriftOS Lite',
      },
      {
        path: 'quick-sale',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'SALES' },
        loadComponent: () =>
          import('./features/simplified-mode/mobile-sales/mobile-quick-sale.component').then((m) => m.MobileQuickSaleComponent),
        title: 'POS Quick Sale - ThriftOS Lite',
      },
      {
        path: 'more',
        loadComponent: () =>
          import('./features/simplified-mode/mobile-more/mobile-more.component').then((m) => m.MobileMoreComponent),
        title: 'More Operations - ThriftOS Lite',
      },
    ],
  },

  // Backward compatibility redirects from /app/mobile/* to /app/lite/*
  {
    path: 'app/mobile/home',
    redirectTo: 'app/lite/home',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile/buying',
    redirectTo: 'app/lite/buying',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile/sorting',
    redirectTo: 'app/lite/sorting',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile/repack',
    redirectTo: 'app/lite/repack',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile/lookup',
    redirectTo: 'app/lite/lookup',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile/quick-sale',
    redirectTo: 'app/lite/quick-sale',
    pathMatch: 'full',
  },
  {
    path: 'app/mobile',
    redirectTo: 'app/lite/home',
    pathMatch: 'full',
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

  // Fallback route
  {
    path: '**',
    redirectTo: '/app',
  },
];
