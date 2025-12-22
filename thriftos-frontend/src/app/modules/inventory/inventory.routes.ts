/**
 * Inventory Routes
 * Phase 6: Inventory Management
 * 
 * Route Structure:
 * /app/inventory               - Inventory Dashboard
 * /app/inventory/items         - Inventory List
 * /app/inventory/items/:id     - Inventory Item Detail (with ledger)
 * 
 * NOTE: Inventory items are created from Repack module.
 * This module is VIEW-ONLY for tracking and traceability.
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/inventory-dashboard').then(
        (m) => m.InventoryDashboardComponent
      ),
    title: 'Inventory - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['INVENTORY_VIEW'] },
  },
  {
    path: 'items',
    loadComponent: () =>
      import('./items/inventory-list/inventory-list').then(
        (m) => m.InventoryListComponent
      ),
    title: 'Inventory Items - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['INVENTORY_VIEW'] },
  },
  {
    path: 'items/:id',
    loadComponent: () =>
      import('./items/inventory-detail/inventory-detail').then(
        (m) => m.InventoryDetailComponent
      ),
    title: 'Inventory Detail - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['INVENTORY_VIEW'] },
  },
];
