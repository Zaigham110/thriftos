import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sales-index/sales-index.page').then((m) => m.SalesIndexPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./sales-new/sales-new.page').then((m) => m.SalesNewPage),
  },
  {
    path: ':id/invoice',
    loadComponent: () => import('./sale-invoice/sale-invoice.page').then((m) => m.SaleInvoicePage),
  },
  {
    path: ':id',
    loadComponent: () => import('./sale-detail/sale-detail.page').then((m) => m.SaleDetailPage),
  },
];
