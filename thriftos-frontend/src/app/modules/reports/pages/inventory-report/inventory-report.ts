/**
 * Inventory Report Component
 * Phase 7: Reports & Analytics
 * 
 * Inventory snapshot and aging analysis.
 * Shows inventory by category, grade, warehouse, and age.
 * Route: /app/reports/inventory
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import { InventorySnapshotResponse, InventoryAgingResponse, ReportFilters, InventorySnapshotRow, InventoryAgingRow } from '../../reports.models';
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
} from '../../../../shared/ui';

@Component({
  selector: 'app-inventory-report',
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
  templateUrl: './inventory-report.html',
  styleUrl: './inventory-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly breadcrumbs = [
    { label: 'Reports', link: '/reports' },
    { label: 'Inventory', link: undefined },
  ];

  readonly snapshot = signal<InventorySnapshotResponse | null>(null);
  readonly aging = signal<InventoryAgingResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeView = signal<'snapshot' | 'aging'>('snapshot');
  readonly searchText = signal<string>('');
  readonly categories = signal<{ id: string; name: string }[]>([]);
  readonly grades = signal<{ id: string; name: string }[]>([]);
  readonly warehouses = signal<{ id: string; name: string }[]>([]);
  protected currentFilters: ReportFilters = {};

  readonly snapshotColumns: DataTableColumn[] = [
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'Grade', key: 'gradeName', sortable: true },
    { label: 'Warehouse', key: 'warehouseName', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
    { label: 'Units', key: 'totalUnits', sortable: true, align: 'right' },
    { label: 'Weight', key: 'totalWeightKg', sortable: true, align: 'right' },
    { label: 'Pieces', key: 'totalPcs', sortable: true, align: 'right' },
  ];

  readonly agingColumns: DataTableColumn[] = [
    { label: 'Age Range', key: 'ageRangeDays', sortable: true },
    { label: 'Units', key: 'unitsCount', sortable: true, align: 'right' },
    { label: 'Weight', key: 'totalWeightKg', sortable: true, align: 'right' },
    { label: 'Total Value', key: 'totalValue', sortable: true, align: 'right' },
  ];

  protected get exporting(): boolean {
    return this.reportsService.exporting();
  }

  ngOnInit(): void {
    this.reportsService.loadFilterLookups().subscribe({
      next: (lookups) => {
        this.categories.set(lookups.categories);
        this.grades.set(lookups.grades);
        this.warehouses.set(lookups.warehouses);
      },
      error: () => {
        this.categories.set([]);
        this.grades.set([]);
        this.warehouses.set([]);
      },
    });
    this.loadData();
  }

  loadData(filters?: ReportFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentFilters = filters || {};

    // Load snapshot
    this.reportsService.loadInventorySnapshot(filters).subscribe({
      next: (data) => {
        this.snapshot.set(data);
        this.loadAging(filters);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory report');
        this.loading.set(false);
      },
    });
  }

  private loadAging(filters?: ReportFilters): void {
    this.reportsService.loadInventoryAging(filters).subscribe({
      next: (data) => {
        this.aging.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory aging');
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

  setView(view: 'snapshot' | 'aging'): void {
    this.activeView.set(view);
  }

  exportReport(): void {
    if (this.activeView() === 'snapshot') {
      this.reportsService.exportInventorySnapshot(this.currentFilters);
    } else {
      this.reportsService.exportInventoryAging(this.currentFilters);
    }
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

  getStatusClass(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'status--available';
      case 'RESERVED':
        return 'status--reserved';
      case 'SOLD':
        return 'status--sold';
      default:
        return 'status--default';
    }
  }

  getAgingClass(ageRange: string): string {
    if (ageRange.includes('0-30') || ageRange.includes('0-7')) {
      return 'aging--fresh';
    }
    if (ageRange.includes('31-60') || ageRange.includes('8-30')) {
      return 'aging--normal';
    }
    if (ageRange.includes('61-90') || ageRange.includes('31-90')) {
      return 'aging--warning';
    }
    return 'aging--old';
  }
}
