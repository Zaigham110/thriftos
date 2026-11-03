/**
 * Inventory Movements Report Component
 * Phase 7: Reports & Analytics
 * 
 * Auditable inventory movement ledger (in/out movements across warehouses).
 * Route: /app/reports/inventory-movements
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import type { InventoryMovementsResponse, ReportFilters } from '../../reports.models';
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
import { LucideAngularModule, ArrowRight, Scale, RefreshCw, Package, Layers } from 'lucide-angular';

@Component({
  selector: 'app-inventory-movements-report',
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
  templateUrl: './inventory-movements-report.html',
  styleUrl: './inventory-movements-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryMovementsReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    ArrowRight,
    Scale,
    RefreshCw,
    Package,
    Layers,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Auditable Inventory Movement Ledger' },
  ];

  readonly response = signal<InventoryMovementsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchText = signal<string>('');
  readonly warehouses = signal<{ id: string; name: string }[]>([]);
  protected currentFilters: ReportFilters = {};

  readonly columns: DataTableColumn[] = [
    { label: 'Movement Date', key: 'createdAt', sortable: true },
    { label: 'Movement Type', key: 'movementType', sortable: true },
    { label: 'Unit Code', key: 'unitCode', sortable: true },
    { label: 'Unit Type', key: 'unitType', sortable: true },
    { label: 'Category', key: 'categoryName', sortable: true },
    { label: 'Grade', key: 'gradeName', sortable: true },
    { label: 'Warehouse', key: 'warehouseName', sortable: true },
    { label: 'Moved KG', key: 'quantityKg', sortable: true, align: 'right' },
    { label: 'Moved PCS', key: 'quantityPcs', sortable: true, align: 'right' },
    { label: 'Avg Unit Cost', key: 'avgCost', sortable: true, align: 'right' },
  ];

  // Computed Summary Metrics
  readonly summaryTotalMovements = computed(() => {
    return this.response()?.summary?.totalMovements || 0;
  });

  readonly summaryTotalKg = computed(() => {
    return this.response()?.summary?.totalKg || 0;
  });

  readonly summaryTotalPcs = computed(() => {
    return this.response()?.summary?.totalPcs || 0;
  });

  protected get exporting(): boolean {
    return this.reportsService.exporting();
  }

  ngOnInit(): void {
    this.reportsService.loadFilterLookups().subscribe({
      next: (lookups) => {
        this.warehouses.set(lookups.warehouses);
      },
      error: () => {
        this.warehouses.set([]);
      },
    });
    this.loadData();
  }

  loadData(filters?: ReportFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentFilters = filters || {};

    this.reportsService.fetchInventoryMovements(filters).subscribe({
      next: (result) => {
        this.response.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory movements');
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
    this.reportsService.exportInventoryMovements(this.currentFilters);
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

  getMovementTypeClass(type: string): string {
    switch (type) {
      case 'INTAKE':
      case 'RECEIVE':
        return 'mtype--in';
      case 'SEAL_REPACK':
        return 'mtype--repack';
      case 'RESERVE':
      case 'SALE':
        return 'mtype--out';
      default:
        return 'mtype--default';
    }
  }
}
