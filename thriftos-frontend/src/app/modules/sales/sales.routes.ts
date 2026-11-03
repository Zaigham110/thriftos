import { Routes } from '@angular/router';
import { SALES_LIST } from '../../features/workspace-lists/lists';

export const SALES_ROUTES: Routes = [
  {
    // Enterprise workspace list and record page (E2); the printable bill stays at /bill/:token.
    path: '',
    loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent),
    data: { list: SALES_LIST },
  },
  {
    path: ':id',
    loadComponent: () => import('../../features/sales-workspace/sale-record.component').then((m) => m.SaleRecordComponent),
  },
];
