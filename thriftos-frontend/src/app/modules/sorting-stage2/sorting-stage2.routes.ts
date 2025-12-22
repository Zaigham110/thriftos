/**
 * Sorting Stage 2 Routes
 * Phase 4: Grading UI
 * 
 * Route Structure:
 * /app/sorting/stage2                - Grading Session List
 * /app/sorting/stage2/:id            - Grading Session Detail / Workspace
 * 
 * NOTE: Session creation happens from Stage 1 output, not via dedicated route
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const SORTING_STAGE2_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sessions/grading-session-list/grading-session-list').then(
        (m) => m.GradingSessionListComponent
      ),
    title: 'Grading Stage 2 - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_VIEW'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./sessions/grading-session-detail/grading-session-detail').then(
        (m) => m.GradingSessionDetailComponent
      ),
    title: 'Grading Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_VIEW'] },
  },
];
