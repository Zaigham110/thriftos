/**
 * Repack Summary Report Component
 * Phase 7: Reports & Analytics
 * 
 * Draft vs sealed repack production units grouped by status.
 * Route: /app/reports/repack-summary
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type { RepackSummaryResponse, ReportFilters } from '../../reports.models';
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
import { LucideAngularModule, Layers, Scale, RefreshCw, DollarSign, Package, CheckCircle2 } from 'lucide-angular';

@Component({
  selector: 'app-repack-summary-report',
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
  templateUrl: './repack-summary-report.html',
  styleUrl: './repack-summary-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackSummaryReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    Layers,
    Scale,
    RefreshCw,
    DollarSign,
    Package,
    CheckCircle2,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Repack Production & Batch Summary' },
  ];

  readonly response = signal<RepackSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly columns: DataTableColumn[] = [
    { label: 'Repack Status', key: 'status', sortable: true },
    { label: 'Repack Units', key: 'units', sortable: true, align: 'right' },
    { label: 'Packed Weight (KG)', key: 'totalWeightKg', sortable: true, align: 'right' },
    { label: 'Pieces Count (PCS)', key: 'totalPcs', sortable: true, align: 'right' },
    { label: 'Valuation Cost', key: 'totalCost', sortable: true, align: 'right' },
  ];

  // Computed Summary Metrics
  readonly summaryTotalUnits = computed(() => {
    const data = this.response()?.data || [];
    return data.reduce((sum, r) => sum + (r.units || 0), 0);
  });

  readonly summaryTotalWeightKg = computed(() => {
    const data = this.response()?.data || [];
    return data.reduce((sum, r) => sum + (r.totalWeightKg || 0), 0);
  });

  readonly summaryTotalPcs = computed(() => {
    const data = this.response()?.data || [];
    return data.reduce((sum, r) => sum + (r.totalPcs || 0), 0);
  });

  readonly summaryTotalCost = computed(() => {
    const data = this.response()?.data || [];
    return data.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  });

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

  getStatusClass(status: string): string {
    switch (status) {
      case 'SEALED':
        return 'status--sealed';
      case 'DRAFT':
        return 'status--draft';
      case 'CANCELLED':
        return 'status--cancelled';
      default:
        return 'status--default';
    }
  }
}
