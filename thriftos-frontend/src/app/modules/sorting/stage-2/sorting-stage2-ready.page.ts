import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { AvailableForGrading } from '../../sorting-stage2/sorting-stage2.models';
import { SortingFacadeService } from '../sorting-facade.service';
import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
  type DataTableColumn,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-stage2-ready-page',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppDataTableComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './sorting-stage2-ready.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage2ReadyPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  // Breadcrumbs — matches Procurement pattern
  readonly breadcrumbs = [
    { label: 'Sorting', link: '/sorting' },
    { label: 'Stage 2', link: undefined },
  ];

  readonly rows = signal<AvailableForGrading[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  readonly columns: DataTableColumn[] = [
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as AvailableForGrading).category?.name ?? '',
    },
    {
      key: 'rag',
      label: 'Rag/Bale',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as AvailableForGrading).rag?.ragCode ?? '',
    },
    {
      key: 'container',
      label: 'Container',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as AvailableForGrading).container?.containerNumber ?? '',
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as AvailableForGrading).weightKg,
    },
    {
      key: 'gradeStatus',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'NOT_STARTED', value: 'NOT_STARTED' },
        { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
      ],
      getValue: (row) => (row as AvailableForGrading).gradeStatus ?? 'NOT_STARTED',
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      getValue: (row) => (row as AvailableForGrading).createdAt,
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page(), pageSize = this.pageSize()): void {
    this.loading.set(true);
    this.error.set(null);

    this.facade.stage2Queue(page, pageSize).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.page.set(resp.page);
        this.pageSize.set(resp.limit);
        this.totalPages.set(resp.totalPages ?? 1);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load available outputs');
        this.loading.set(false);
      },
    });
  }

  onTableStateChange(state: { pageIndex: number; pageSize: number }): void {
    if (state.pageIndex !== this.page() || state.pageSize !== this.pageSize()) {
      this.load(state.pageIndex, state.pageSize);
    }
  }

  grade(output: AvailableForGrading): void {
    this.router.navigate(['/sorting/stage-2', output.id]);
  }

  clearError(): void {
    this.error.set(null);
  }
}
