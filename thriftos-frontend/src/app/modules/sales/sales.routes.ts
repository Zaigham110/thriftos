import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    // Enterprise workspace list and record page (E2); the printable bill stays at /bill/:token.
    path: '',
    loadComponent: () => import('../../features/sales-workspace/sales-list.component').then((m) => m.SalesListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('../../features/sales-workspace/sale-record.component').then((m) => m.SaleRecordComponent),
  },
];
