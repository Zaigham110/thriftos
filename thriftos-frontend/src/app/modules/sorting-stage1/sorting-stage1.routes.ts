/**
 * Sorting Stage 1 Routes
 * Phase 3: Category Sorting UI
 * 
 * Route Structure:
 * /app/sorting/stage1                - Session List
 * /app/sorting/stage1/rags           - Available Rags/Bales List
 * /app/sorting/stage1/create         - Create Session
 * /app/sorting/stage1/:id            - Session Detail / Workspace
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const SORTING_STAGE1_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sessions/sorting-session-list/sorting-session-list').then(
        (m) => m.SortingSessionListComponent
      ),
    title: 'Sorting Stage 1 - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_VIEW'] },
  },
  {
    path: 'rags',
    loadComponent: () =>
      import('./rags/rag-sortable-list').then(
        (m) => m.RagSortableListComponent
      ),
    title: 'Available Rags & Bales - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_VIEW'] },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./sessions/sorting-session-create/sorting-session-create').then(
        (m) => m.SortingSessionCreateComponent
      ),
    title: 'Create Sorting Session - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_CREATE'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./sessions/sorting-session-detail/sorting-session-detail').then(
        (m) => m.SortingSessionDetailComponent
      ),
    title: 'Sorting Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_VIEW'] },
  },
];
