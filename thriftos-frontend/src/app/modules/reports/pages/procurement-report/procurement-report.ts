/**
 * Procurement Report Component
 * Phase 7: Reports & Analytics
 * 
 * Vendor summary and procurement cost analysis.
 * Shows cost breakdown by vendor and container.
 * Route: /app/reports/procurement
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportsService } from '../../reports.service';
import { VendorSummaryRow, ReportFilters } from '../../reports.models';
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
  type BreadcrumbItem
} from '../../../../shared/ui';

@Component({
  selector: 'app-procurement-report',
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
    AppStackComponent
  ],
  templateUrl: './procurement-report.html',
  styleUrl: './procurement-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly vendors = signal<VendorSummaryRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Procurement Report' },
  ];

  readonly vendorColumns: DataTableColumn[] = [
    {
      key: 'vendorName',
      label: 'Vendor',
      sortable: true,
    },
    {
      key: 'totalContainers',
      label: 'Containers',
      sortable: true,
      align: 'right'
    },
    {
      key: 'totalWeightKg',
      label: 'Weight',
      sortable: true,
      align: 'right',
    },
    {
      key: 'totalCost',
      label: 'Total Cost',
      sortable: true,
      align: 'right',
    },
    {
      key: 'avgCostPerKg',
      label: 'Cost/KG',
      sortable: true,
      align: 'right',
    }
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(n);
  }

  // No frontend rollups or chart calculations.
}
