import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, Routes, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor, managerUp, ownerOnly, signedIn } from './core';
import { BalePage } from './pages/bale.page';
import { BillPage } from './pages/bill.page';
import { BillsPage } from './pages/bills.page';
import { CustomerPage } from './pages/customer.page';
import { CustomersPage } from './pages/customers.page';
import { DrawerPage } from './pages/drawer.page';
import { ExpensesPage } from './pages/expenses.page';
import { HardwarePage } from './pages/hardware.page';
import { LoginPage } from './pages/login.page';
import { ManagePage } from './pages/manage.page';
import { ReportsPage } from './pages/reports.page';
import { BranchesPage, MyPinPage, ShopSettingsPage, StaffPage } from './pages/settings.pages';
import { ShipmentNewPage } from './pages/shipment-new.page';
import { ShipmentPage } from './pages/shipment.page';
import { ShipmentsPage } from './pages/shipments.page';
import { StockCheckPage } from './pages/stock-check.page';
import { StockPage } from './pages/stock.page';
import { TillPage } from './pages/till.page';
import { TransfersPage } from './pages/transfers.page';

const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: '',
    canActivate: [signedIn],
    children: [
      { path: '', component: TillPage },
      { path: 'bills', component: BillsPage },
      { path: 'bills/:id', component: BillPage },
      { path: 'stock', component: StockPage },
      { path: 'stock/:id', component: BalePage },
      { path: 'stock-check', component: StockCheckPage },
      { path: 'customers', component: CustomersPage },
      { path: 'customers/:id', component: CustomerPage },
      { path: 'manage', component: ManagePage },
      { path: 'drawer', component: DrawerPage },
      { path: 'transfers', component: TransfersPage },
      { path: 'expenses', component: ExpensesPage, canActivate: [managerUp] },
      { path: 'reports', component: ReportsPage, canActivate: [managerUp] },
      { path: 'shipments', component: ShipmentsPage, canActivate: [ownerOnly] },
      { path: 'shipments/new', component: ShipmentNewPage, canActivate: [ownerOnly] },
      { path: 'shipments/:id', component: ShipmentPage, canActivate: [ownerOnly] },
      { path: 'settings/hardware', component: HardwarePage },
      { path: 'settings/me', component: MyPinPage },
      { path: 'settings/shop', component: ShopSettingsPage, canActivate: [ownerOnly] },
      { path: 'settings/staff', component: StaffPage, canActivate: [ownerOnly] },
      { path: 'settings/branches', component: BranchesPage, canActivate: [ownerOnly] },
    ],
  },
  { path: '**', redirectTo: '' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // The app shell is kept on the device, so the till opens and sells with no connection.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:5000' }),
  ],
};
