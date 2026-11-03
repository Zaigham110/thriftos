/**
 * Yield Report Component
 * Phase 7: Reports & Analytics
 * 
 * Category yield analysis from sorting operations.
 * Shows input/output weights, material loss, and yield percentages.
 * Route: /app/reports/yield
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  TrendingUp,
  ArrowLeft,
  Download,
  RefreshCw,
  Scale,
  Package,
  Trash2,
  Layers,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { YieldReportRow, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppErrorStateComponent,
  AppBreadcrumbComponent,
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-yield-report',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    LucideAngularModule,
    ReportFiltersComponent,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppErrorStateComponent,
    AppBreadcrumbComponent,
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
    Layers,
  };

  readonly data = signal<YieldReportRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  readonly categories = signal<{ id: string; name: string }[]>([]);
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Yield Audit & Mass Balance' },
  ];

  readonly columns: DataTableColumn[] = [
    { label: 'Category Name', key: 'categoryName', sortable: true },
    { label: 'Raw Intake (KG)', key: 'inputWeightKg', sortable: true, align: 'right' },
    { label: 'Category Output (KG)', key: 'outputWeightKg', sortable: true, align: 'right' },
    { label: 'Material Waste (KG)', key: 'wasteWeightKg', sortable: true, align: 'right' },
    { label: 'Yield Conversion %', key: 'yieldPct', sortable: true, align: 'right' },
  ];

  // Summary Metrics
  readonly totalInputKg = computed(() => {
    return this.data().reduce((sum, r) => sum + Number(r.inputWeightKg || 0), 0);
  });

  readonly totalOutputKg = computed(() => {
    return this.data().reduce((sum, r) => sum + Number(r.outputWeightKg || 0), 0);
  });

  readonly totalWasteKg = computed(() => {
    return this.data().reduce((sum, r) => sum + Number(r.wasteWeightKg || 0), 0);
  });

  readonly averageYieldPct = computed(() => {
    const input = this.totalInputKg();
    if (input <= 0) return 0;
    return Math.min(100, (this.totalOutputKg() / input) * 100);
  });

  protected get exporting(): boolean {
    return this.reportsService.exporting();
  }

  ngOnInit(): void {
    this.reportsService.loadFilterLookups().subscribe({
      next: (lookups) => {
        this.categories.set(lookups.categories);
      },
      error: () => {
        this.categories.set([]);
      },
    });
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
