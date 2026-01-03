/**
 * Yield Report Component
 * Phase 7: Reports & Analytics
 * 
 * Category yield analysis from sorting operations.
 * Shows input/output weights and yield percentages.
 * Route: /app/reports/yield
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  TrendingUp,
  ArrowLeft,
  Download,
  RefreshCw,
  Scale,
  Package,
  Trash2,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { YieldReportRow, ReportFilters } from '../../reports.models';
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
  AppBreadcrumbComponent,
  AppStackComponent,
  type DataTableColumn,
  type BreadcrumbItem
} from '../../../../shared/ui';

@Component({
  selector: 'app-yield-report',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
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
  templateUrl: './yield-report.html',
  styleUrl: './yield-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YieldReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    TrendingUp,
    ArrowLeft,
    Download,
    RefreshCw,
    Scale,
    Package,
    Trash2,
  };

  readonly data = signal<YieldReportRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Yield Report' },
  ];

  readonly columns: DataTableColumn[] = [
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'Input (KG)', key: 'inputWeightKg', sortable: true, align: 'right' },
    { label: 'Output (KG)', key: 'outputWeightKg', sortable: true, align: 'right' },
    { label: 'Waste (KG)', key: 'wasteWeightKg', sortable: true, align: 'right' },
    { label: 'Yield %', key: 'yieldPct', sortable: true, align: 'right' },
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

    this.reportsService.loadYieldReport(filters).subscribe({
      next: (rows) => {
        this.data.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load yield report');
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
    this.reportsService.exportYieldReport(this.currentFilters);
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

  formatPercent(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return `${n.toFixed(1)}%`;
  }
}
