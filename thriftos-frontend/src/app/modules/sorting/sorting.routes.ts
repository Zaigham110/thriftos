import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const SORTING_ROUTES: Routes = [
  // Canonical routes (locked)
  {
    path: 'stage-1',
    loadComponent: () =>
      import('./stage-1/sorting-stage1-ready.page').then((m) => m.SortingStage1ReadyPage),
    title: 'Sorting Stage 1 - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_VIEW'] },
  },
  {
    path: 'stage-1/:ragId',
    loadComponent: () =>
      import('./stage-1/sorting-stage1-start.page').then((m) => m.SortingStage1StartPage),
    title: 'Sorting Stage 1 - Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE1_CREATE'] },
  },
  {
    path: 'stage-2',
    loadComponent: () =>
      import('./stage-2/sorting-stage2-ready.page').then((m) => m.SortingStage2ReadyPage),
    title: 'Sorting Stage 2 - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_VIEW'] },
  },
  {
    path: 'stage-2/:categoryOutputId',
    loadComponent: () =>
      import('./stage-2/sorting-stage2-grade.page').then((m) => m.SortingStage2GradePage),
    title: 'Sorting Stage 2 - Workspace - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_CREATE'] },
  },
  {
    path: 'outputs',
    loadComponent: () =>
      import('./outputs/sorting-outputs.page').then((m) => m.SortingOutputsPage),
    title: 'Sorting Outputs - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_VIEW'] },
  },
  {
    path: 'outputs/:id',
    loadComponent: () =>
      import('./outputs/sorting-output-detail.page').then((m) => m.SortingOutputDetailPage),
    title: 'Output Detail - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['SORTING_STAGE2_VIEW'] },
  },

  // Back-compat redirects
  { path: '', redirectTo: 'stage-1', pathMatch: 'full' },
  { path: 'stage1', redirectTo: 'stage-1', pathMatch: 'full' },
  { path: 'stage2', redirectTo: 'stage-2', pathMatch: 'full' },
  { path: 'stage-1/:ragId/start', redirectTo: 'stage-1/:ragId', pathMatch: 'full' },
  { path: 'stage-2/:outputId/grade', redirectTo: 'stage-2/:outputId', pathMatch: 'full' },
];
