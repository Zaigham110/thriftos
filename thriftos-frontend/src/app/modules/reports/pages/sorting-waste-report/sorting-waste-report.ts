import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type {
  ReportFilters,
  SortingWasteResponse,
  SortingWasteLegacyRow,
  SortingWasteByCategoryRow,
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
  selector: 'app-sorting-waste-report',
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
  templateUrl: './sorting-waste-report.html',
  styleUrl: './sorting-waste-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingWasteReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/home/overview' },
    { label: 'Reports', link: '/reports/detail' },
    { label: 'Sorting Waste' },
  ];

  readonly response = signal<SortingWasteResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly legacyColumns: DataTableColumn[] = [
    { label: 'Closed At', key: 'closedAt', sortable: true },
    { label: 'Stage', key: 'stage', sortable: true },
    { label: 'Session', key: 'sessionCode', sortable: true },
    { label: 'Waste (KG)', key: 'wasteWeightKg', sortable: true, align: 'right' },
  ];

  readonly categorizedColumns: DataTableColumn[] = [
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'Stage', key: 'stage', sortable: true },
    { label: 'Unit Type', key: 'unitType', sortable: true },
    { label: 'Waste (KG)', key: 'wasteKg', sortable: true, align: 'right' },
    { label: 'Waste (PCS)', key: 'wastePcs', sortable: true, align: 'right' },
    { label: 'Estimated Value', key: 'estimatedValue', sortable: true, align: 'right' },
  ];

  protected get exporting(): boolean {
    return this.reportsService.exporting();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(filters?: ReportFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentFilters = filters || {};

    this.reportsService.fetchSortingWaste(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load sorting waste');
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
    this.reportsService.exportSortingWaste(this.currentFilters);
  }

  legacyRows(): SortingWasteLegacyRow[] {
    return this.response()?.data ?? [];
  }

  categorizedRows(): SortingWasteByCategoryRow[] {
    return this.response()?.categorized?.byCategory ?? [];
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

  formatNumber(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return new Intl.NumberFormat('en-US').format(n);
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
}
