import { EXPENSES_LIST, LOTS_LIST } from './features/workspace-lists/lists';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';
import { moduleGuard } from './core/guards/module.guard';
import { superAdminGuard } from './core/guards/super-admin-guard';
import { setupGuard } from './core/guards/setup.guard';
import { LoginComponent } from './features/auth/login/login.component';

export const routes: Routes = [
  // Auth routes (public)
  {
    path: 'auth/login',
    // In the main bundle: the first screen anyone sees should not wait for another download.
    component: LoginComponent,
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

  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./features/auth/password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    title: 'Forgot password - ThriftOS',
  },
  {
    path: 'auth/reset-password',
    loadComponent: () => import('./features/auth/password/reset-password.component').then((m) => m.ResetPasswordComponent),
    title: 'New password - ThriftOS',
  },
  // Terms and Privacy: public, no login.
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent),
    data: { kind: 'terms' },
    title: 'Terms - ThriftOS',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent),
    data: { kind: 'privacy' },
    title: 'Privacy - ThriftOS',
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
    // Printable statement of account (E3.5), outside the shell so it prints as a clean A4 page.
    path: 'statement/:id',
    loadComponent: () => import('./features/workspace-lists/statement.component').then((m) => m.StatementComponent),
    canActivate: [authGuard, tenantAreaGuard],
    title: 'ThriftOS',
  },
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

  // Setup wizard (journey 8): full screen, before the tenant app.
  {
    path: 'setup',
    loadComponent: () => import('./features/setup/setup.component').then((m) => m.SetupComponent),
    canActivate: [authGuard, tenantAreaGuard],
    title: 'ThriftOS',
  },

  // The tenant app: one shell, one route per job.
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard, tenantAreaGuard, setupGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'ThriftOS',
      },
      { path: 'home/containers', loadComponent: () => import('./features/home/containers.component').then((m) => m.HomeContainersComponent), title: 'ThriftOS' },
      { path: 'home/today', loadComponent: () => import('./features/home/today.component').then((m) => m.HomeTodayComponent), title: 'ThriftOS' },
      {
        path: 'home/overview',
        canActivate: [moduleGuard],
        data: { module: 'REPORTS' },
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
          { path: 'scorecard', loadComponent: () => import('./features/workspace-lists/scorecard.component').then((m) => m.ScorecardComponent), title: 'ThriftOS' },
        ],
      },
      {
        path: 'sort',
        canActivate: [moduleGuard],
        data: { module: 'SORT' },
        children: [
          { path: '', loadComponent: () => import('./features/sort/sort-home.component').then((m) => m.SortHomeComponent), title: 'ThriftOS' },
          // Workspace sorting (E3.2): lots list and board, a lot's sorting record, yield analysis.
          { path: 'records', loadComponent: () => import('./features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), data: { list: LOTS_LIST }, title: 'ThriftOS' },
          { path: 'records/:id', loadComponent: () => import('./features/workspace-lists/sorting-record.component').then((m) => m.SortingRecordComponent), title: 'ThriftOS' },
          { path: 'yield', loadComponent: () => import('./features/workspace-lists/yield.component').then((m) => m.YieldComponent), title: 'ThriftOS' },
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
          { path: 'value', loadComponent: () => import('./features/workspace-lists/stock-summary.component').then((m) => m.StockSummaryComponent), title: 'ThriftOS' },
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
          { path: 'analytics', loadComponent: () => import('./features/workspace-lists/sales-analytics.component').then((m) => m.SalesAnalyticsComponent), title: 'ThriftOS' },
          { path: 'prices', loadComponent: () => import('./features/workspace-lists/price-lists.component').then((m) => m.PriceListsComponent), title: 'ThriftOS' },
        ],
      },
      // Report centre on the laptop (E4.5): owner analytics, not tied to the older detailed-reports module.
      { path: 'insights', loadComponent: () => import('./features/workspace-lists/report-centre.component').then((m) => m.ReportCentreComponent), title: 'ThriftOS' },
      {
        // Finance (E3.6): management accounts on the laptop; each call checks its own permission.
        path: 'finance',
        children: [
          { path: '', redirectTo: 'expenses', pathMatch: 'full' },
          { path: 'expenses', loadComponent: () => import('./features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), data: { list: EXPENSES_LIST }, title: 'ThriftOS' },
          { path: 'expenses/new', loadComponent: () => import('./features/workspace-lists/expense.component').then((m) => m.ExpenseComponent), title: 'ThriftOS' },
          { path: 'expenses/:id', loadComponent: () => import('./features/workspace-lists/expense.component').then((m) => m.ExpenseComponent), title: 'ThriftOS' },
          { path: 'book', loadComponent: () => import('./features/workspace-lists/finance-book.component').then((m) => m.FinanceBookComponent), title: 'ThriftOS' },
          { path: 'close', loadComponent: () => import('./features/workspace-lists/cash-close.component').then((m) => m.CashCloseComponent), title: 'ThriftOS' },
          { path: 'pnl', loadComponent: () => import('./features/workspace-lists/pnl.component').then((m) => m.PnlComponent), title: 'ThriftOS' },
        ],
      },
      {
        path: 'khata',
        canActivate: [moduleGuard],
        data: { module: 'KHATA' },
        children: [
          // Workspace receivables (E3.5): collections worklist and ageing, customer 360.
          { path: 'records', loadComponent: () => import('./features/workspace-lists/collections.component').then((m) => m.CollectionsComponent), title: 'ThriftOS' },
          { path: 'records/:id', loadComponent: () => import('./features/workspace-lists/customer-record.component').then((m) => m.CustomerRecordComponent), title: 'ThriftOS' },
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
            loadComponent: () => import('./features/settings/settings-home.component').then((m) => m.SettingsHomeComponent),
            title: 'ThriftOS',
          },
          { path: 'team', loadComponent: () => import('./features/settings/team.component').then((m) => m.TeamComponent), title: 'ThriftOS' },
          { path: 'password', loadComponent: () => import('./features/settings/change-password.component').then((m) => m.ChangePasswordComponent), title: 'ThriftOS' },
          { path: 'ui-gallery', loadComponent: () => import('./features/workspace-gallery/ui-gallery.component').then((m) => m.UiGalleryComponent), title: 'Interface gallery - ThriftOS' },
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
