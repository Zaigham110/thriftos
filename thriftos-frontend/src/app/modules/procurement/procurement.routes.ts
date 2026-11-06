/**
 * Procurement Module Routes
 * Phase 2: Procurement UI
 *
 * Required route structure:
 * /procurement
 * /procurement/dashboard
 * /procurement/pos
 * /procurement/containers
 */

import { Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { permissionGuard } from '../../core/guards/permission-guard';
import { unsavedChangesGuard } from '../../core/nav/unsaved-changes.guard';
import { moduleGuard } from '../../core/guards/module.guard';
import { CONTAINERS_LIST, PURCHASE_LOTS_LIST, PURCHASING_TABS, SUPPLIERS_LIST } from '../../features/workspace-lists/lists';

/** Purchasing opens on the tab used last (containers by default). */
function lastPurchasingTab() {
  let last: string | null = null;
  try { last = localStorage.getItem(`thriftos.tab.${PURCHASING_TABS[0].link}`); } catch { /* private window */ }
  return inject(Router).parseUrl(PURCHASING_TABS.some((t) => t.link === last) ? last! : PURCHASING_TABS[0].link);
}

export const PROCUREMENT_ROUTES: Routes = [
  // The old procurement overview is replaced by the containers list and the scorecard (enterprise E3/E4).
  { path: '', pathMatch: 'full', children: [], canActivate: [lastPurchasingTab] },
  { path: 'dashboard', redirectTo: 'containers', pathMatch: 'full' },
  // Gaari and loose lots bought without a container (v2 review): the second Purchasing tab.
  {
    path: 'lots',
    children: [
      {
        path: '',
        loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent),
        title: 'Loose lots - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['rag.read'], list: PURCHASE_LOTS_LIST },
      },
      // Buy a loose lot on a laptop, and fix one later (v2 review); the phone keeps /receive/lot.
      {
        path: 'new',
        loadComponent: () => import('../../features/workspace-lists/lot-form.component').then((m) => m.LotFormComponent),
        title: 'Buy a loose lot - ThriftOS',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permissions: ['rag.create'] },
      },
      {
        path: ':id/edit',
        loadComponent: () => import('../../features/workspace-lists/lot-form.component').then((m) => m.LotFormComponent),
        title: 'Edit loose lot - ThriftOS',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permissions: ['rag.create'] },
      },
      // A lot's own page is its sorting record (the breadcrumb Purchasing › Loose lots › BALE-… links here).
      { path: ':id', redirectTo: '/sort/records/:id' },
    ],
  },


  // Purchase Orders
  {
    path: 'pos',
    // Purchase orders are not part of v1: only when the business turned them on.
    canActivate: [moduleGuard],
    data: { module: 'PURCHASE_ORDERS' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./purchase-orders/purchase-order-list/purchase-order-list').then(
            (m) => m.PurchaseOrderListComponent
          ),
        title: 'Purchase Orders - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.read'] },
      },
      {
        path: 'create',
        loadComponent: () =>
          import('./purchase-orders/purchase-order-create/purchase-order-create').then(
            (m) => m.PurchaseOrderCreateComponent
          ),
        title: 'Create Purchase Order - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.create'] },
      },
      {
        path: ':id/containers/create',
        loadComponent: () =>
          import('./purchase-orders/purchase-order-add-container/purchase-order-add-container').then(
            (m) => m.PurchaseOrderAddContainerComponent
          ),
        title: 'Add Container - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.create'] },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./purchase-orders/purchase-order-detail/purchase-order-detail').then(
            (m) => m.PurchaseOrderDetailComponent
          ),
        title: 'Purchase Order - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.read'] },
      },
    ],
  },

  // Containers
  {
    path: 'containers',
    children: [
      {
        path: '',
        // Workspace list with a status board (enterprise plan E3.1).
        loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent),
        title: 'Containers - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.read'], list: CONTAINERS_LIST },
      },
      // One simple form to receive a container on a laptop and to edit it (v2 review); the phone keeps /receive/container.
      {
        path: 'new',
        loadComponent: () => import('../../features/workspace-lists/container-form.component').then((m) => m.ContainerFormComponent),
        title: 'Receive a container - ThriftOS',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permissions: ['container.create'] },
      },
      {
        path: ':id/edit',
        loadComponent: () => import('../../features/workspace-lists/container-form.component').then((m) => m.ContainerFormComponent),
        title: 'Edit container - ThriftOS',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permissions: ['container.update'] },
      },
      // Charges and lots are added in a panel on the container's page now (v2 review); old links land there.
      { path: ':id/charges/create', redirectTo: '/receive/records/containers/:id' },
      { path: ':id/rags/create', redirectTo: '/receive/records/containers/:id' },
      {
        path: ':id',
        // Traceability record page: landed cost → lots → sorting → bales → sales (E3.1).
        loadComponent: () => import('../../features/workspace-lists/container-record.component').then((m) => m.ContainerRecordComponent),
        title: 'Container - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.read'] },
      },
    ],
  },

  // Suppliers: list and scorecard (E3.1).
  {
    path: 'suppliers',
    canActivate: [permissionGuard],
    data: { permissions: ['vendor.read'] },
    children: [
      { path: '', loadComponent: () => import('../../features/workspace-lists/list-page.component').then((m) => m.ListPageComponent), title: 'Suppliers - ThriftOS', data: { list: SUPPLIERS_LIST } },
      // Add and change a supplier here (v2 review), not in Settings › Advanced.
      { path: 'new', loadComponent: () => import('../../features/workspace-lists/supplier-form.component').then((m) => m.SupplierFormComponent), canActivate: [permissionGuard], canDeactivate: [unsavedChangesGuard], data: { permissions: ['vendor.create'] }, title: 'ThriftOS' },
      { path: ':id/edit', loadComponent: () => import('../../features/workspace-lists/supplier-form.component').then((m) => m.SupplierFormComponent), canActivate: [permissionGuard], canDeactivate: [unsavedChangesGuard], data: { permissions: ['vendor.update'] }, title: 'ThriftOS' },
      { path: ':id', loadComponent: () => import('../../features/workspace-lists/supplier-record.component').then((m) => m.SupplierRecordComponent), title: 'Supplier - ThriftOS' },
    ],
  },

  // Loose Bales (list/detail only - creation via PO)

  // Rags / Bales
  {
    path: 'rags',
    children: [
      // The old lots page is the Purchasing tab now (an old link never opens a blank page).
      { path: '', pathMatch: 'full', redirectTo: '/receive/records/lots' },
      {
        path: ':ragId/edit',
        loadComponent: () => import('./rags/rag-edit-page').then((m) => m.RagEditPageComponent),
        title: 'Edit Rag - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['rag.create'] },
      },
    ],
  },
];
