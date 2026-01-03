import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./index/inventory-index.page').then((m) => m.InventoryIndexPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./detail/inventory-detail.page').then((m) => m.InventoryDetailPage),
  },
];
