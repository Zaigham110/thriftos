import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type { FinalProductCostResponse, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import { MoneyPipe } from '../../../../core/money/money.pipe';
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
import { LucideAngularModule, DollarSign, Package, Scale, RefreshCw, Layers, ShieldCheck } from 'lucide-angular';

@Component({
  selector: 'app-final-product-cost-report',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MoneyPipe,
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
  templateUrl: './final-product-cost-report.html',
  styleUrl: './final-product-cost-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinalProductCostReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    DollarSign,
    Package,
    Scale,
    RefreshCw,
    Layers,
    ShieldCheck,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Final Product Cost & COGS' },
  ];

  readonly response = signal<FinalProductCostResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  readonly categories = signal<{ id: string; name: string }[]>([]);
  readonly grades = signal<{ id: string; name: string }[]>([]);
  protected currentFilters: ReportFilters = {};

  readonly columns: DataTableColumn[] = [
    { label: 'Sealed Date', key: 'dateSealed', sortable: true },
    { label: 'Product Code', key: 'productCode', sortable: true },
    { label: 'Category', key: 'category', sortable: true },
    { label: 'Grade', key: 'grade', sortable: true },
    { label: 'Unit Type', key: 'unitType', sortable: true },
    { label: 'Packed Qty', key: 'totalQty', sortable: true, align: 'right' },
    { label: 'Net Weight (KG)', key: 'totalWeightKg', sortable: true, align: 'right' },
    { label: 'Landed Cost', key: 'totalCost', sortable: true, align: 'right' },
    { label: 'Cost / KG', key: 'costPerKg', sortable: true, align: 'right' },
    { label: 'Cost / Unit', key: 'costPerUnit', sortable: true, align: 'right' },
    { label: 'Src Ctrs', key: 'sourceContainers', sortable: true, align: 'right' },
    { label: 'Src Bales', key: 'sourceBales', sortable: true, align: 'right' },
  ];

  // Computed KPI Summaries
  readonly summaryTotalCost = computed(() => {
    return this.response()?.summary?.totalCost || 0;
  });

  readonly summaryTotalWeightKg = computed(() => {
    return this.response()?.summary?.totalWeightKg || 0;
  });

  readonly summaryTotalUnits = computed(() => {
    return this.response()?.summary?.totalUnits || 0;
  });

  readonly summaryAvgCostPerKg = computed(() => {
    const w = this.summaryTotalWeightKg();
    if (w <= 0) return 0;
    return this.summaryTotalCost() / w;
  });

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

    this.reportsService.fetchFinalProductCost(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load final product cost');
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
    this.reportsService.exportFinalProductCost(this.currentFilters);
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
