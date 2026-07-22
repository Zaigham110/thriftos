/**
 * Procurement Report Component
 * Phase 7: Reports & Analytics
 * 
 * Supplier vendor summary and container procurement cost analysis.
 * Route: /app/reports/procurement
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import { VendorSummaryRow, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
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
import { LucideAngularModule, DollarSign, Truck, RefreshCw, Scale, Layers } from 'lucide-angular';

@Component({
  selector: 'app-procurement-report',
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
  templateUrl: './procurement-report.html',
  styleUrl: './procurement-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    DollarSign,
    Truck,
    RefreshCw,
    Scale,
    Layers,
  };

  readonly vendors = signal<VendorSummaryRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/app/reports' },
    { label: 'Supplier Vendor Procurement Summary' },
  ];

  readonly vendorColumns: DataTableColumn[] = [
    { key: 'vendorName', label: 'Supplier Vendor Name', sortable: true },
    { key: 'totalContainers', label: 'Containers Count', sortable: true, align: 'right' },
    { key: 'totalWeightKg', label: 'Total Weight (KG)', sortable: true, align: 'right' },
    { key: 'totalCost', label: 'Cumulative PO Cost', sortable: true, align: 'right' },
    { key: 'avgCostPerKg', label: 'Average Cost / KG', sortable: true, align: 'right' },
  ];

  // Computed Summaries
  readonly summaryTotalCost = computed(() => {
    return this.vendors().reduce((sum, r) => sum + Number(r.totalCost || 0), 0);
  });

  readonly summaryTotalWeightKg = computed(() => {
    return this.vendors().reduce((sum, r) => sum + Number(r.totalWeightKg || 0), 0);
  });

  readonly summaryTotalContainers = computed(() => {
    return this.vendors().reduce((sum, r) => sum + Number(r.totalContainers || 0), 0);
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
    this.loadData();
  }

  loadData(filters?: ReportFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentFilters = filters || {};

    this.reportsService.loadVendorSummary(filters).subscribe({
      next: (rows) => {
        this.vendors.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load procurement report');
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
    this.reportsService.exportVendorSummary(this.currentFilters);
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

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  formatCurrency(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return this.money.format(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
