/**
 * Procurement Module Routes
 * Phase 2: Procurement UI
 * 
 * Route Structure:
 * /app/procurement                 - Dashboard
 * /app/procurement/purchase-orders - PO List
 * /app/procurement/purchase-orders/create - Create PO
 * /app/procurement/purchase-orders/:id - PO Detail
 * /app/procurement/containers      - Container List
 * /app/procurement/containers/:id  - Container Detail
 * /app/procurement/incoming-bales  - Bale List
 * /app/procurement/incoming-bales/create - Create Bale
 * /app/procurement/incoming-bales/:id - Bale Detail
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const PROCUREMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/procurement-dashboard').then(
        (m) => m.ProcurementDashboardComponent
      ),
    title: 'Procurement - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['po.read'] },
  },

  // Purchase Orders
  {
    path: 'purchase-orders',
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

  // Incoming Bales (Loose Bales)
  {
    path: 'incoming-bales',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./incoming-bales/incoming-bale-list/incoming-bale-list').then(
            (m) => m.IncomingBaleListComponent
          ),
        title: 'Incoming Bales - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.read'] },
      },
      {
        path: 'create',
        loadComponent: () =>
          import('./incoming-bales/incoming-bale-create/incoming-bale-create').then(
            (m) => m.IncomingBaleCreateComponent
          ),
        title: 'Create Incoming Bale - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.create'] },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./incoming-bales/incoming-bale-detail/incoming-bale-detail').then(
            (m) => m.IncomingBaleDetailComponent
          ),
        title: 'Incoming Bale - ThriftOS',
        canActivate: [permissionGuard],
        data: { permissions: ['po.read'] },
      },
    ],
  },
];
