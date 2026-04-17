import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type { RepackSummaryResponse, ReportFilters } from '../../reports.models';
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
  selector: 'app-repack-summary-report',
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
  templateUrl: './repack-summary-report.html',
  styleUrl: './repack-summary-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackSummaryReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Repack Summary' },
  ];

  readonly response = signal<RepackSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly columns: DataTableColumn[] = [
    { label: 'Status', key: 'status', sortable: true },
    { label: 'Units', key: 'units', sortable: true, align: 'right' },
    { label: 'Weight (KG)', key: 'totalWeightKg', sortable: true, align: 'right' },
    { label: 'Pieces', key: 'totalPcs', sortable: true, align: 'right' },
    { label: 'Total Cost', key: 'totalCost', sortable: true, align: 'right' },
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

    this.reportsService.fetchRepackSummary(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load repack summary');
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
    this.reportsService.exportRepackSummary(this.currentFilters);
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
}
