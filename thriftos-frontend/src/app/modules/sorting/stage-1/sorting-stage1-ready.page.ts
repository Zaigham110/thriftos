import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SortingFacadeService, type Stage1QueueItem } from '../sorting-facade.service';
import {
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLinkComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
  type DataTableColumn,
  type DataTableState,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-stage1-ready-page',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppLinkComponent
  ],
  templateUrl: './sorting-stage1-ready.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage1ReadyPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  // Breadcrumbs — matches Procurement pattern
  readonly breadcrumbs = [
    { label: 'Sorting', link: '/sorting' },
    { label: 'Stage 1', link: undefined },
  ];

  readonly rows = signal<Stage1QueueItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);

  readonly columns: DataTableColumn[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      filterable: true,
      getValue: (row) => {
        const item = row as Stage1QueueItem;
        return item.sourceType === 'LOOSE_BALE' ? item.baleCode : item.ragCode;
      },
    },
    {
      key: 'sourceType',
      label: 'Source Type',
      sortable: true,
      getValue: (row) => {
        const item = row as Stage1QueueItem;
        return item.sourceType || 'RAG';
      },
    },
    {
      key: 'container',
      label: 'Container',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as Stage1QueueItem).container?.containerNumber ?? '—',
    },
    {
      key: 'purchaseOrder',
      label: 'Purchase Order',
      sortable: true,
      getValue: (row) => {
        const item = row as Stage1QueueItem;
        return item.container?.purchaseOrder?.poNumber ?? item.purchaseOrder?.poNumber ?? '—';
      },
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as Stage1QueueItem).weightKg,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'NOT_STARTED', value: 'NOT_STARTED' },
        { label: 'IN_SORTING', value: 'IN_SORTING' },
      ],
      getValue: (row) => (row as Stage1QueueItem).status,
    },
  ];

  readonly readyCount = computed(() => this.rows().length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load all data for client-side filtering - queue is typically small
    this.facade.stage1Queue(1, 1000, undefined).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load ready rags/bales');
        this.loading.set(false);
      },
    });
  }

  start(item: Stage1QueueItem): void {
    // Determine which ID to use for routing
    const id = item.sourceType === 'LOOSE_BALE' ? item.sourceId || item.id : item.id;
    const sourceType = item.sourceType || 'RAG';
    
    // Navigate to the start page - it will call stage1Start with correct params
    this.router.navigate(['/sorting/stage-1', id], { 
      state: { sourceType } 
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  getSourceLabel(item: Stage1QueueItem): string {
    if (item.sourceType === 'LOOSE_BALE') return 'Loose Bale';
    if (item.containerId) return 'Container Rag';
    return 'Loose Rag';
  }
}
