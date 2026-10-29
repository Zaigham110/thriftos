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

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const PROCUREMENT_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/procurement-dashboard').then((m) => m.ProcurementDashboardComponent),
    title: 'Procurement Dashboard - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['po.read'] },
  },

  // Purchase Orders
  {
    path: 'pos',
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
        loadComponent: () =>
          import('./containers/container-list/container-list').then(
            (m) => m.ContainerListComponent
          ),
        title: 'Containers - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.read'] },
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./containers/container-edit/container-edit').then((m) => m.ContainerEditComponent),
        title: 'Edit Container - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.update'] },
      },
      {
        path: ':id/charges/create',
        loadComponent: () =>
          import('./containers/container-charge-create/container-charge-create').then(
            (m) => m.ContainerChargeCreateComponent
          ),
        title: 'Add Container Charge - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.update'] },
      },
      {
        path: ':id/rags/create',
        loadComponent: () =>
          import('./rags/rag-create-page').then((m) => m.RagCreatePageComponent),
        title: 'Add Rag - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['rag.create'] },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./containers/container-detail/container-detail').then(
            (m) => m.ContainerDetailComponent
          ),
        title: 'Container - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['container.read'] },
      },
    ],
  },

  // Loose Bales (list/detail only - creation via PO)

  // Rags / Bales
  {
    path: 'rags',
    children: [
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
