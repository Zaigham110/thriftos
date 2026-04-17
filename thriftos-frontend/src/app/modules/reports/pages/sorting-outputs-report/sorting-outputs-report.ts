import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type {
  ReportFilters,
  SortingOutputsResponse,
  SortingStage1OutputRow,
  SortingStage2OutputRow,
} from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppBreadcrumbComponent,
  AppStackComponent,
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-sorting-outputs-report',
  standalone: true,
  imports: [
    CommonModule,
    ReportFiltersComponent,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppErrorStateComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
  ],
  templateUrl: './sorting-outputs-report.html',
  styleUrl: './sorting-outputs-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingOutputsReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Sorting Outputs' },
  ];

  readonly response = signal<SortingOutputsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  readonly categories = signal<{ id: string; name: string }[]>([]);
  readonly grades = signal<{ id: string; name: string }[]>([]);
  protected currentFilters: ReportFilters = {};

  readonly stage1Columns: DataTableColumn[] = [
    { label: 'Created', key: 'createdAt', sortable: true },
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'RAG', key: 'ragCode', sortable: true },
    { label: 'PO #', key: 'poNumber', sortable: true },
    { label: 'Container', key: 'containerNumber', sortable: true },
    { label: 'Weight (KG)', key: 'weightKg', sortable: true, align: 'right' },
    { label: 'Allocated Cost', key: 'allocatedCost', sortable: true, align: 'right' },
    { label: 'Sort Status', key: 'sortStatus', sortable: true },
  ];

  readonly stage2Columns: DataTableColumn[] = [
    { label: 'Created', key: 'createdAt', sortable: true },
    { label: 'Grade', key: 'gradeName', sortable: true },
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'RAG', key: 'ragCode', sortable: true },
    { label: 'PO #', key: 'poNumber', sortable: true },
    { label: 'Container', key: 'containerNumber', sortable: true },
    { label: 'Weight (KG)', key: 'weightKg', sortable: true, align: 'right' },
    { label: 'Allocated Cost', key: 'allocatedCost', sortable: true, align: 'right' },
    { label: 'Measurement', key: 'measurementType', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
  ];

  protected get exporting(): boolean {
    return this.reportsService.exporting();
  }

  ngOnInit(): void {
    this.reportsService.loadFilterLookups().subscribe({
      next: (lookups) => {
        this.categories.set(lookups.categories);
        this.grades.set(lookups.grades);
      },
      error: () => {
        this.categories.set([]);
        this.grades.set([]);
      },
    });
    this.loadData();
  }

  loadData(filters?: ReportFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentFilters = filters || {};

    this.reportsService.fetchSortingOutputs(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load sorting outputs');
        this.loading.set(false);
      },
    });
  }

  onFiltersChange(filters: ReportFilters): void {
    this.loadData(filters);
  }

  onSearchChange(value: string): void {
    this.searchText.set(value ?? '');
  }

  exportReport(): void {
    this.reportsService.exportSortingOutputs(this.currentFilters);
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(String(value));
    return Number.isFinite(n) ? n : null;
  }

  formatWeight(weight: unknown): string {
    const n = this.toNumber(weight);
    if (n === null) return '—';
    if (n >= 1000) return `${(n / 1000).toFixed(2)} T`;
    return `${n.toFixed(2)} KG`;
  }

  formatCurrency(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return this.money.format(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(value: unknown): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  }

  stage1Rows(): SortingStage1OutputRow[] {
    return this.response()?.stage1?.data ?? [];
  }

  stage2Rows(): SortingStage2OutputRow[] {
    return this.response()?.stage2?.data ?? [];
  }
}
