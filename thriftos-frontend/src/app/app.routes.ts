import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';
import { operationalModuleGuard } from './core/guards/operational-module.guard';
import { superAdminGuard } from './core/guards/super-admin-guard';

export const routes: Routes = [
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

  // The tenant app: one shell, one route per job.
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard, tenantAreaGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/flow/work/flow-work.component').then((m) => m.FlowWorkComponent),
        title: 'Home - ThriftOS',
      },
      {
        path: 'home/overview',
        loadComponent: () => import('./features/dashboard/dashboard/dashboard').then((m) => m.DashboardComponent),
        title: 'Overview - ThriftOS',
      },
      {
        path: 'receive',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'INTAKE' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/receive/flow-receive.component').then((m) => m.FlowReceiveComponent),
            title: 'Receive - ThriftOS',
          },
          {
            path: 'container',
            loadComponent: () =>
              import('./features/flow/receive/flow-container-receive.component').then((m) => m.FlowContainerReceiveComponent),
            title: 'Receive container - ThriftOS',
          },
          {
            path: 'records',
            loadChildren: () => import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
          },
        ],
      },
      {
        path: 'sort',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'SORTING' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/transform/flow-transform.component').then((m) => m.FlowTransformComponent),
            title: 'Sort - ThriftOS',
          },
          {
            path: 'grade',
            loadComponent: () => import('./features/flow/grade/flow-grade.component').then((m) => m.FlowGradeComponent),
            title: 'Grade - ThriftOS',
          },
        ],
      },
      {
        path: 'stock',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'STOCK' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/stock/flow-stock.component').then((m) => m.FlowStockComponent),
            title: 'Stock - ThriftOS',
          },
          {
            path: 'bale',
            loadComponent: () => import('./features/flow/seal/flow-seal.component').then((m) => m.FlowSealComponent),
            title: 'Make bale - ThriftOS',
          },
          {
            path: 'items',
            loadChildren: () => import('./modules/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
          },
        ],
      },
      {
        path: 'sell',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'SALES' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/dispatch/flow-dispatch.component').then((m) => m.FlowDispatchComponent),
            title: 'Sell - ThriftOS',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/flow/sale/flow-sale.component').then((m) => m.FlowSaleComponent),
            title: 'New sale - ThriftOS',
          },
          {
            path: 'records',
            loadChildren: () => import('./modules/sales/sales.routes').then((m) => m.SALES_ROUTES),
          },
        ],
      },
      {
        path: 'khata',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'SALES' },
        loadComponent: () => import('./modules/sales/customers-index/customers-index.page').then((m) => m.CustomersIndexPage),
        title: 'Khata - ThriftOS',
      },
      {
        path: 'reports',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'INSIGHTS' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/insights/flow-insights.component').then((m) => m.FlowInsightsComponent),
            title: 'Reports - ThriftOS',
          },
          {
            path: 'detail',
            loadChildren: () => import('./modules/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
          },
        ],
      },
      {
        path: 'settings',
        canActivate: [operationalModuleGuard],
        data: { operationalModule: 'ADMINISTRATION' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/flow/control/flow-control.component').then((m) => m.FlowControlComponent),
            title: 'Settings - ThriftOS',
          },
          {
            path: 'admin',
            loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
          },
        ],
      },
    ],
  },

  // Fallback route
  {
    path: '**',
    redirectTo: '/home',
  },
];
