/**
 * Repack Routes
 * Phase 5: Repack & QR Code Generation
 * 
 * Route Structure:
 * /app/repack                - Repack Session List
 * /app/repack/:id            - Repack Session Detail / Workspace
 * 
 * NOTE: Session creation happens from Stage 2 output, not via dedicated route
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const REPACK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sessions/repack-session-list/repack-session-list').then(
        (m) => m.RepackSessionListComponent
      ),
    title: 'Repack Sessions - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_VIEW'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./sessions/repack-session-detail/repack-session-detail').then(
        (m) => m.RepackSessionDetailComponent
      ),
    title: 'Repack Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['REPACK_VIEW'] },
  },
];
