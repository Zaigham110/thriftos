/**
 * REPACK ROUTES
 * =============
 * 
 * Route Structure:
 * /app/packaging/repack         → Index (Drafts + Sealed)
 * /app/packaging/repack/new     → Create new draft
 * /app/packaging/repack/:id     → Workspace (edit DRAFT / view SEALED)
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const REPACK_ROUTES: Routes = [
  // INDEX — List all drafts and sealed units
  {
    path: '',
    loadComponent: () =>
      import('./index/repack-index.page').then((m) => m.RepackIndexComponent),
    title: 'Repack Registry - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_VIEW'] },
  },

  // NEW — Create a new draft
  {
    path: 'new',
    loadComponent: () =>
      import('./new/repack-new.page').then((m) => m.RepackNewComponent),
    title: 'New Repack Unit - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_CREATE'] },
  },

  // WORKSPACE — Edit draft or view sealed
  {
    path: ':id',
    loadComponent: () =>
      import('./workspace/repack-workspace.page').then((m) => m.RepackWorkspaceComponent),
    title: 'Repack Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_VIEW'] },
  },

  // LEGACY REDIRECTS
  {
    path: 'create',
    redirectTo: 'new',
    pathMatch: 'full',
  },
  {
    path: 'workspace',
    redirectTo: 'new',
    pathMatch: 'full',
  },
  {
    path: 'workspace/:id',
    redirectTo: ':id',
  },
];
