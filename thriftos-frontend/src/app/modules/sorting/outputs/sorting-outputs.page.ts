import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { GradeOutput, GradingOutputStatus } from '../../sorting-stage2/sorting-stage2.models';
import { GRADING_OUTPUT_STATUS_CONFIG as STATUS_CONFIG } from '../../sorting-stage2/sorting-stage2.models';
import { SortingFacadeService } from '../sorting-facade.service';
import {
  AppBadgeComponent,
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
  type DataTableState,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-outputs-page',
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
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './sorting-outputs.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingOutputsPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  // Breadcrumbs — matches Procurement pattern
  readonly breadcrumbs = [
    { label: 'Sorting', link: '/sorting' },
    { label: 'Outputs', link: undefined },
  ];

  readonly rows = signal<GradeOutput[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly marking = signal(false);
  readonly markingOutputId = signal<string | null>(null);

  readonly columns: DataTableColumn[] = [
    {
      key: 'code',
      label: 'Output Code',
      sortable: true,
      filterable: true,
      getValue: (row) => this.outputCode(row as GradeOutput),
    },
    {
      key: 'gradeId',
      label: 'Grade',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as GradeOutput).grade?.id ?? '',
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as GradeOutput).gradeBucket?.gradeSession?.categoryOutput?.category?.name ?? '',
    },
    {
      key: 'ragCode',
      label: 'Rag/Bale',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as GradeOutput).gradeBucket?.gradeSession?.categoryOutput?.rag?.ragCode ?? '',
    },
    {
      key: 'containerNumber',
      label: 'Container',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as GradeOutput).gradeBucket?.gradeSession?.categoryOutput?.container?.containerNumber ?? '',
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as any).totalAmount ?? (row as any).weightKg,
    },
    {
      key: 'used',
      label: 'Used',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as any).usedAmount ?? 0,
    },
    {
      key: 'remaining',
      label: 'Remaining',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as any).remainingAmount ?? (row as any).totalAmount ?? (row as any).weightKg,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Available', value: 'AVAILABLE' },
        { label: 'Partially Used', value: 'PARTIALLY_USED' },
        { label: 'Depleted', value: 'DEPLETED' },
        { label: 'Ready for Repack', value: 'READY_FOR_REPACK' },
      ],
      getValue: (row) => (row as GradeOutput).status ?? 'AVAILABLE',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      getValue: () => '',
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(
    page = this.page(),
    pageSize = this.pageSize(),
    query?: { search?: string; filters?: Record<string, string> },
  ): void {
    this.loading.set(true);
    this.error.set(null);

    const filters = query?.filters ?? {};
    this.facade.outputs(page, pageSize, {
      search: query?.search,
      status: filters['status'],
      gradeId: filters['gradeId'],
      ragCode: filters['ragCode'],
      containerNumber: filters['containerNumber'],
    }).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.page.set(resp.page);
        this.pageSize.set(resp.limit);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load outputs');
        this.loading.set(false);
      },
    });
  }

  onTableStateChange(state: DataTableState): void {
    this.load(state.pageIndex, state.pageSize, { search: state.search, filters: state.filters });
  }

  clearError(): void {
    this.error.set(null);
  }

  statusVariant(status: string | undefined): 'success' | 'warning' | 'danger' | 'primary' | 'default' {
    const s = (status ?? 'AVAILABLE') as GradingOutputStatus;
    return STATUS_CONFIG[s]?.variant ?? 'default';
  }

  statusLabel(status: string | undefined): string {
    const s = (status ?? 'AVAILABLE') as GradingOutputStatus;
    return STATUS_CONFIG[s]?.label ?? status ?? 'Available';
  }

  canMarkReady(row: GradeOutput): boolean {
    const status = row.status ?? 'AVAILABLE';
    return status === 'AVAILABLE' || status === 'PARTIALLY_USED';
  }

  markReadyForRepack(row: GradeOutput): void {
    if (!this.canMarkReady(row)) {
      return;
    }

    if (!confirm(`Mark this output as READY FOR REPACK?\n\nThis will make it available in the repack workspace.`)) {
      return;
    }

    this.marking.set(true);
    this.markingOutputId.set(row.id);

    this.facade.markOutputReadyForRepack(row.id).subscribe({
      next: () => {
        this.marking.set(false);
        this.markingOutputId.set(null);
        // Reload to show updated status
        this.load();
      },
      error: (err) => {
        this.marking.set(false);
        this.markingOutputId.set(null);
        this.error.set(err?.message || 'Failed to mark output as ready');
      },
    });
  }

  outputCode(row: GradeOutput): string {
    return `OUT-${String(row.id).slice(0, 8).toUpperCase()}`;
  }

  viewDetails(row: GradeOutput): void {
    this.router.navigate(['/sorting/outputs', row.id]);
  }

  isRepackEligible(row: GradeOutput): boolean {
    const remaining = Number((row as any).remainingAmount ?? (row as any).totalAmount ?? (row as any).weightKg ?? 0);
    const status = String(row.status ?? 'AVAILABLE');
    return remaining > 0 && status === 'READY_FOR_REPACK';
  }

  startRepack(row: GradeOutput): void {
    this.router.navigate(['/packaging/repack/workspace'], {
      queryParams: { fromGradingOutputId: row.id },
    });
  }
}
