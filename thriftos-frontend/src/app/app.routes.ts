import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';
import { moduleGuard } from './core/guards/module.guard';
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

  // The bill link shared on WhatsApp: public, no login.
  {
    path: 'bill/:token',
    loadComponent: () => import('./features/bill/public-bill.component').then((m) => m.PublicBillComponent),
    title: 'Bill - ThriftOS',
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
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'ThriftOS',
      },
      {
        path: 'home/overview',
        loadComponent: () => import('./features/dashboard/dashboard/dashboard').then((m) => m.DashboardComponent),
        title: 'ThriftOS',
      },
      {
        path: 'receive',
        canActivate: [moduleGuard],
        data: { module: 'RECEIVE' },
        children: [
          { path: '', loadComponent: () => import('./features/receive/receive-home.component').then((m) => m.ReceiveHomeComponent), title: 'ThriftOS' },
          { path: 'container', loadComponent: () => import('./features/receive/receive-container.component').then((m) => m.ReceiveContainerComponent), title: 'ThriftOS' },
          { path: 'lot', loadComponent: () => import('./features/receive/receive-lot.component').then((m) => m.ReceiveLotComponent), title: 'ThriftOS' },
          { path: 'ready', loadComponent: () => import('./features/receive/receive-ready.component').then((m) => m.ReceiveReadyComponent), title: 'ThriftOS' },
          { path: 'ready/open/:id', loadComponent: () => import('./features/receive/open-bale.component').then((m) => m.OpenBaleComponent), title: 'ThriftOS' },
          { path: 'records', loadChildren: () => import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES) },
        ],
      },
      {
        path: 'sort',
        canActivate: [moduleGuard],
        data: { module: 'SORT' },
        children: [
          { path: '', loadComponent: () => import('./features/sort/sort-home.component').then((m) => m.SortHomeComponent), title: 'ThriftOS' },
          { path: 'grade/:id', loadComponent: () => import('./features/sort/sort-work.component').then((m) => m.SortWorkComponent), data: { stage: 2 }, title: 'ThriftOS' },
          { path: ':id', loadComponent: () => import('./features/sort/sort-work.component').then((m) => m.SortWorkComponent), data: { stage: 1 }, title: 'ThriftOS' },
        ],
      },
      {
        path: 'stock',
        canActivate: [moduleGuard],
        data: { module: 'STOCK' },
        children: [
          { path: '', loadComponent: () => import('./features/stock/stock-home.component').then((m) => m.StockHomeComponent), title: 'ThriftOS' },
          { path: 'bale', loadComponent: () => import('./features/stock/make-bale.component').then((m) => m.MakeBaleComponent), title: 'ThriftOS' },
          { path: 'label/:id', loadComponent: () => import('./features/stock/labels.component').then((m) => m.LabelsComponent), title: 'ThriftOS' },
          { path: 'labels', loadComponent: () => import('./features/stock/labels.component').then((m) => m.LabelsComponent), title: 'ThriftOS' },
          { path: 'items', loadChildren: () => import('./modules/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES) },
        ],
      },
      {
        path: 'sell',
        canActivate: [moduleGuard],
        data: { module: 'SELL' },
        children: [
          { path: '', loadComponent: () => import('./features/sell/sell-home.component').then((m) => m.SellHomeComponent), title: 'ThriftOS' },
          { path: 'new', loadComponent: () => import('./features/sell/sale.component').then((m) => m.SaleComponent), title: 'ThriftOS' },
          { path: 'records', loadChildren: () => import('./modules/sales/sales.routes').then((m) => m.SALES_ROUTES) },
        ],
      },
      {
        path: 'khata',
        canActivate: [moduleGuard],
        data: { module: 'KHATA' },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/khata/khata-list.component').then((m) => m.KhataListComponent),
            title: 'Khata - ThriftOS',
          },
          {
            path: ':id',
            loadComponent: () => import('./features/khata/khata-customer.component').then((m) => m.KhataCustomerComponent),
            title: 'Khata - ThriftOS',
          },
        ],
      },
      {
        path: 'reports',
        canActivate: [moduleGuard],
        data: { module: 'REPORTS' },
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
