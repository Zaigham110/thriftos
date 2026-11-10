import { EXPENSES_LIST, LOTS_LIST } from './features/workspace-lists/lists';
import { nextLotGuard } from './features/sort/next-lot.guard';
import { unsavedChangesGuard } from './core/nav/unsaved-changes.guard';
import { desktopRedirect } from './core/guards/desktop-redirect.guard';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { tenantAreaGuard } from './core/guards/tenant-area.guard';
import { moduleGuard } from './core/guards/module.guard';
import { superAdminGuard } from './core/guards/super-admin-guard';
import { passwordGuard } from './core/guards/password.guard';
import { setupGuard } from './core/guards/setup.guard';
import { LoginComponent } from './features/auth/login/login.component';

export const routes: Routes = [
  // Typed or old addresses for signing in (v2 review): the sign-in page, not "page not found".
  { path: 'login', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: 'signin', redirectTo: '/auth/login', pathMatch: 'full' },
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
    // The statement now opens inside the app, under its customer (the shell hides itself when printing).
    path: 'statement/:id',
    redirectTo: '/khata/records/:id/statement',
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
    canActivate: [authGuard, tenantAreaGuard, passwordGuard],
    title: 'ThriftOS',
  },

  // The tenant app: one shell, one route per job.
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard, tenantAreaGuard, passwordGuard, setupGuard],
    // Every page inside, too (a guard above runs only when the area is entered).
    canActivateChild: [passwordGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'ThriftOS',
      },
      { path: 'home/containers', canActivate: [desktopRedirect('/receive/records/containers')], loadComponent: () => import('./features/home/containers.component').then((m) => m.HomeContainersComponent), title: 'ThriftOS' },
      { path: 'home/today', canActivate: [desktopRedirect('/sell/records')], loadComponent: () => import('./features/home/today.component').then((m) => m.HomeTodayComponent), title: 'ThriftOS' },
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
          { path: '', canActivate: [desktopRedirect('/receive/records/containers')], loadComponent: () => import('./features/receive/receive-home.component').then((m) => m.ReceiveHomeComponent), title: 'ThriftOS' },
          { path: 'container', canActivate: [moduleGuard, desktopRedirect('/receive/records/containers/new')], data: { module: 'CONTAINERS' }, loadComponent: () => import('./features/receive/receive-container.component').then((m) => m.ReceiveContainerComponent), title: 'ThriftOS' },
          { path: 'lot', canActivate: [moduleGuard, desktopRedirect('/receive/records/lots/new')], data: { module: 'LOOSE_LOTS' }, loadComponent: () => import('./features/receive/receive-lot.component').then((m) => m.ReceiveLotComponent), title: 'ThriftOS' },
          { path: 'ready', canActivate: [moduleGuard], data: { module: 'READY_STOCK' }, loadComponent: () => import('./features/receive/receive-ready.component').then((m) => m.ReceiveReadyComponent), title: 'ThriftOS' },
          { path: 'ready/open/:id', loadComponent: () => import('./features/receive/open-bale.component').then((m) => m.OpenBaleComponent), title: 'ThriftOS' },
          { path: 'records', loadChildren: () => import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES) },
          { path: 'scorecard', canActivate: [moduleGuard], data: { module: ['CONTAINERS', 'LOOSE_LOTS'] }, loadComponent: () => import('./features/workspace-lists/scorecard.component').then((m) => m.ScorecardComponent), title: 'ThriftOS' },
        ],
      },
      {
        path: 'sort',
        canActivate: [moduleGuard],
        data: { module: 'SORT' },
        children: [
          { path: '', canActivate: [desktopRedirect('/sort/records')], loadComponent: () => import('./features/sort/sort-home.component').then((m) => m.SortHomeComponent), title: 'ThriftOS' },
          // Workspace sorting (E3.2): lots list and board, a lot's sorting record, yield analysis.
          { path: 'records', loadComponent: () => import('./features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), data: { list: LOTS_LIST }, title: 'ThriftOS' },
          { path: 'records/:id', loadComponent: () => import('./features/workspace-lists/sorting-record.component').then((m) => m.SortingRecordComponent), title: 'ThriftOS' },
          { path: 'yield', loadComponent: () => import('./features/workspace-lists/yield.component').then((m) => m.YieldComponent), title: 'ThriftOS' },
          { path: 'next', canActivate: [nextLotGuard], children: [] },
          { path: 'grade/:id', loadComponent: () => import('./features/sort/sort-work.component').then((m) => m.SortWorkComponent), data: { stage: 2 }, title: 'ThriftOS' },
          { path: ':id', loadComponent: () => import('./features/sort/sort-work.component').then((m) => m.SortWorkComponent), data: { stage: 1 }, title: 'ThriftOS' },
        ],
      },
      {
        path: 'stock',
        canActivate: [moduleGuard],
        data: { module: 'STOCK' },
        children: [
          { path: '', canActivate: [desktopRedirect('/stock/by-item')], loadComponent: () => import('./features/stock/stock-home.component').then((m) => m.StockHomeComponent), title: 'ThriftOS' },
          { path: 'bale', loadComponent: () => import('./features/stock/make-bale.component').then((m) => m.MakeBaleComponent), title: 'ThriftOS' },
          { path: 'label/:id', loadComponent: () => import('./features/stock/labels.component').then((m) => m.LabelsComponent), title: 'ThriftOS' },
          { path: 'labels', loadComponent: () => import('./features/stock/labels.component').then((m) => m.LabelsComponent), title: 'ThriftOS' },
          { path: 'items', loadChildren: () => import('./modules/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES) },
          // Inventory by item (v2 review): bales and sorted kg per category and grade; its second tab is each item.
          { path: 'by-item', loadComponent: () => import('./features/workspace-lists/stock-by-item.component').then((m) => m.StockByItemComponent), title: 'ThriftOS' },
          { path: 'value', loadComponent: () => import('./features/workspace-lists/stock-summary.component').then((m) => m.StockSummaryComponent), title: 'ThriftOS' },
        ],
      },
      {
        path: 'sell',
        canActivate: [moduleGuard],
        data: { module: 'SELL' },
        children: [
          { path: '', canActivate: [desktopRedirect('/sell/records')], loadComponent: () => import('./features/sell/sell-home.component').then((m) => m.SellHomeComponent), title: 'ThriftOS' },
          { path: 'new', canActivate: [desktopRedirect('/sell/records/new')], loadComponent: () => import('./features/sell/sale.component').then((m) => m.SaleComponent), title: 'ThriftOS' },
          { path: 'records', loadChildren: () => import('./modules/sales/sales.routes').then((m) => m.SALES_ROUTES) },
          { path: 'analytics', loadComponent: () => import('./features/workspace-lists/sales-analytics.component').then((m) => m.SalesAnalyticsComponent), title: 'ThriftOS' },
          { path: 'prices', canActivate: [moduleGuard], data: { module: 'PRICE_LISTS' }, loadComponent: () => import('./features/workspace-lists/price-lists.component').then((m) => m.PriceListsComponent), title: 'ThriftOS' },
        ],
      },
      // Report centre on the laptop (E4.5): owner analytics, not tied to the older detailed-reports module.
      { path: 'help', loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent), title: 'ThriftOS' },
      { path: 'help/:topic', loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent), title: 'ThriftOS' },
      { path: 'insights', loadComponent: () => import('./features/workspace-lists/report-centre.component').then((m) => m.ReportCentreComponent), title: 'ThriftOS' },
      {
        // Finance (E3.6): management accounts on the laptop; each call checks its own permission.
        path: 'finance',
        children: [
          { path: '', redirectTo: 'expenses', pathMatch: 'full' },
          { path: 'expenses', canActivate: [moduleGuard], data: { list: EXPENSES_LIST, module: 'EXPENSES' }, loadComponent: () => import('./features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), title: 'ThriftOS' },
          { path: 'expenses/new', canActivate: [moduleGuard], data: { module: 'EXPENSES' }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/workspace-lists/expense.component').then((m) => m.ExpenseComponent), title: 'ThriftOS' },
          { path: 'expenses/:id', canActivate: [moduleGuard], data: { module: 'EXPENSES' }, loadComponent: () => import('./features/workspace-lists/expense.component').then((m) => m.ExpenseComponent), title: 'ThriftOS' },
          { path: 'book', canActivate: [moduleGuard], data: { module: ['CASH_CLOSE', 'EXPENSES'] }, loadComponent: () => import('./features/workspace-lists/finance-book.component').then((m) => m.FinanceBookComponent), title: 'ThriftOS' },
          { path: 'close', canActivate: [moduleGuard], data: { module: 'CASH_CLOSE' }, loadComponent: () => import('./features/workspace-lists/cash-close.component').then((m) => m.CashCloseComponent), title: 'ThriftOS' },
          { path: 'pnl', canActivate: [moduleGuard], data: { module: 'PNL' }, loadComponent: () => import('./features/workspace-lists/pnl.component').then((m) => m.PnlComponent), title: 'ThriftOS' },
        ],
      },
      {
        path: 'khata',
        canActivate: [moduleGuard],
        data: { module: 'KHATA' },
        children: [
          // Workspace receivables (E3.5): collections worklist and ageing, customer 360.
          { path: 'records', loadComponent: () => import('./features/workspace-lists/collections.component').then((m) => m.CollectionsComponent), title: 'ThriftOS' },
          // Add and change customers on the laptop; the statement sits under its customer (v2 review).
          { path: 'records/new', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/workspace-lists/customer-form.component').then((m) => m.CustomerFormComponent), title: 'ThriftOS' },
          { path: 'records/:id', loadComponent: () => import('./features/workspace-lists/customer-record.component').then((m) => m.CustomerRecordComponent), title: 'ThriftOS' },
          { path: 'records/:id/edit', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/workspace-lists/customer-form.component').then((m) => m.CustomerFormComponent), title: 'ThriftOS' },
          { path: 'records/:id/statement', loadComponent: () => import('./features/workspace-lists/statement.component').then((m) => m.StatementComponent), title: 'ThriftOS' },
          {
            path: '',
            canActivate: [desktopRedirect('/khata/records')],
            loadComponent: () => import('./features/khata/khata-list.component').then((m) => m.KhataListComponent),
            title: 'Receivables - ThriftOS',
          },
          {
            path: ':id',
            canActivate: [desktopRedirect('/khata/records/:id')],
            loadComponent: () => import('./features/khata/khata-customer.component').then((m) => m.KhataCustomerComponent),
            title: 'Receivables - ThriftOS',
          },
        ],
      },
      {
        path: 'reports',
        // On the laptop the report centre has every report; the phone keeps the insights screen.
        canActivate: [desktopRedirect('/insights'), moduleGuard],
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
          { path: 'business', loadComponent: () => import('./features/settings/business.component').then((m) => m.BusinessComponent), title: 'ThriftOS' },
          { path: 'pin', loadComponent: () => import('./features/settings/change-pin.component').then((m) => m.ChangePinComponent), title: 'ThriftOS' },
          { path: 'password', loadComponent: () => import('./features/settings/change-password.component').then((m) => m.ChangePasswordComponent), title: 'ThriftOS' },
          { path: 'ui-gallery', loadComponent: () => import('./features/workspace-gallery/ui-gallery.component').then((m) => m.UiGalleryComponent), title: 'Interface gallery - ThriftOS' },
          {
            path: 'admin',
            loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
          },
        ],
      },
      { path: 'unavailable', loadComponent: () => import('./features/error/not-found.component').then((m) => m.NotFoundComponent), title: 'ThriftOS' },
      // An address that does not exist says so (with a way back) instead of jumping to Home without a word.
      { path: '**', loadComponent: () => import('./features/error/not-found.component').then((m) => m.NotFoundComponent), title: 'ThriftOS' },
    ],
  },

  // Fallback route
  {
    path: '**',
    redirectTo: '/home',
  },
];
