import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/nav/unsaved-changes.guard';
import { SALES_LIST } from '../../features/workspace-lists/lists';

export const SALES_ROUTES: Routes = [
  {
    // Enterprise workspace list and record page (E2); the printable bill stays at /bill/:token.
    path: '',
    loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent),
    data: { list: SALES_LIST },
  },
  {
    // Desktop sale entry, keyboard first (E3.4); the phone keeps /sell/new.
    path: 'new',
    loadComponent: () => import('../../features/workspace-lists/sale-entry.component').then((m) => m.SaleEntryComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: ':id',
    loadComponent: () => import('../../features/sales-workspace/sale-record.component').then((m) => m.SaleRecordComponent),
  },
];
