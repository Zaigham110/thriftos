import { Routes } from '@angular/router';
import { STOCK_COUNTS_LIST, STOCK_LIST } from '../../features/workspace-lists/lists';

/** Inventory in the workspace (enterprise plan E3.3): stock list, stock counts, item record (ageing and value is /stock/value). */
export const INVENTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), data: { list: STOCK_LIST } },
  { path: 'counts', loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), data: { list: STOCK_COUNTS_LIST } },
  { path: ':id', loadComponent: () => import('../../features/workspace-lists/stock-record.component').then((m) => m.StockRecordComponent) },
];
