/**
 * Procurement Summary Report Component
 * Phase 7: Reports & Analytics
 * 
 * PO total costs reconciled against computed container/bale costs.
 * Route: /app/reports/procurement-summary
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { ReportsService } from '../../reports.service';
import type { ProcurementSummaryResponse, ProcurementSummaryRow, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import { MoneyService } from '../../../../core/money/money.service';
import { MoneyPipe } from '../../../../core/money/money.pipe';
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
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../../shared/ui';
import { LucideAngularModule, DollarSign, Truck, RefreshCw, CheckCircle, AlertTriangle, Layers } from 'lucide-angular';

@Component({
  selector: 'app-procurement-summary-report',
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
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppErrorStateComponent,
    AppBreadcrumbComponent,
  ],
  templateUrl: './procurement-summary-report.html',
  styleUrl: './procurement-summary-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementSummaryReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    DollarSign,
    Truck,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Layers,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/app/reports' },
    { label: 'Procurement Summary & Cost Reconciliation' },
  ];

  readonly response = signal<ProcurementSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly columns: DataTableColumn[] = [
    { label: 'PO #', key: 'poNumber', sortable: true },
    { label: 'PO Type', key: 'poType', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
    { label: 'Supplier Vendor', key: 'vendorName', sortable: true },
    { label: 'Created Date', key: 'createdAt', sortable: true },
    {
      label: 'Containers',
      key: 'containersCount',
      sortable: true,
      align: 'right',
      getValue: (row) => (row as ProcurementSummaryRow).containers?.count,
    },
    {
      label: 'Container Weight',
      key: 'containersWeightKg',
      sortable: true,
      align: 'right',
      getValue: (row) => (row as ProcurementSummaryRow).containers?.weightKg,
    },
    {
      label: 'Container Cost',
      key: 'containersCost',
      sortable: true,
      align: 'right',
      getValue: (row) => (row as ProcurementSummaryRow).containers?.cost,
    },
    {
      label: 'Loose Bales',
      key: 'looseBalesCount',
      sortable: true,
      align: 'right',
      getValue: (row) => (row as ProcurementSummaryRow).looseBales?.count,
    },
    {
      label: 'PO Cost Total',
      key: 'poTotalCost',
      sortable: true,
      align: 'right',
    },
    {
      label: 'Computed Landed Cost',
      key: 'computedProcurementCost',
      sortable: true,
      align: 'right',
    },
    { label: 'Reconciliation', key: 'matchesPoTotal', sortable: true },
  ];

  // Computed Summaries
  readonly summaryTotalPoCost = computed(() => {
    return this.response()?.summary?.totalPoCost || 0;
  });

  readonly summaryTotalComputedCost = computed(() => {
    return this.response()?.summary?.totalComputedProcurementCost || 0;
  });

  readonly summaryTotalContainers = computed(() => {
    const data = this.response()?.data || [];
    return data.reduce((sum, r) => sum + (r.containers?.count || 0), 0);
  });

  readonly summaryMatchingCount = computed(() => {
    const data = this.response()?.data || [];
    return data.filter((r) => r.matchesPoTotal).length;
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

    this.reportsService.fetchProcurementSummary(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load procurement summary');
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
    this.reportsService.exportProcurementSummary(this.currentFilters);
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
