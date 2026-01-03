/**
 * REPACK ROUTES — CLEAN REBUILD
 * =============================
 * 
 * Route Structure (LOCKED):
 * /packaging/repack         → Index (Drafts + Sealed)
 * /packaging/repack/new     → Create new draft
 * /packaging/repack/:id     → Workspace (edit DRAFT / view SEALED)
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const REPACK_ROUTES: Routes = [
  // INDEX — List all drafts and sealed units
  {
    path: '',
    loadComponent: () =>
      import('./index/repack-index.page').then((m) => m.RepackIndexComponent),
    title: 'Repack - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_VIEW'] },
  },

  // NEW — Create a new draft
  // TEMPORARILY DISABLED: Backend requires allocations upfront
  // TODO: Implement inline draft creation in workspace
  /*
  {
    path: 'new',
    loadComponent: () =>
      import('./new/repack-new.page').then((m) => m.RepackNewComponent),
    title: 'New Repack - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_CREATE'] },
  },
  */

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
    path: 'workspace',
    redirectTo: 'new',
    pathMatch: 'full',
  },
  {
    path: 'workspace/:id',
    redirectTo: ':id',
  },
];
