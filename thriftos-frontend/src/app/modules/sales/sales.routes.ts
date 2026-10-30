import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sales-index/sales-index.page').then((m) => m.SalesIndexPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./sale-invoice/sale-invoice.page').then((m) => m.SaleInvoicePage),
  },
];
