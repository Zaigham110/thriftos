/**
 * Waste Report Component
 * Phase 7: Reports & Analytics
 * 
 * Waste analysis by stage and cost impact.
 * Shows waste distribution across procurement, sorting, and grading.
 * Route: /app/reports/waste
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  Trash2,
  ArrowLeft,
  Download,
  DollarSign,
  Layers,
  Scale,
  RefreshCw,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { MoneyService } from '../../../../core/money/money.service';
import { WasteReportRow, ReportFilters } from '../../reports.models';
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

@Component({
  selector: 'app-waste-report',
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
  templateUrl: './waste-report.html',
  styleUrl: './waste-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasteReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly money = inject(MoneyService);

  readonly icons = {
    Trash2,
    ArrowLeft,
    Download,
    DollarSign,
    Layers,
    Scale,
    RefreshCw,
  };

  readonly wasteByStage = signal<WasteReportRow[]>([]);
  readonly wasteCostImpact = signal<WasteReportRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeView = signal<'by-stage' | 'cost-impact'>('by-stage');
  readonly searchText = signal<string>('');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Waste & Loss Analysis' },
  ];

  readonly columns: DataTableColumn[] = [
    { label: 'Supply Chain Stage', key: 'stage', sortable: true },
    { label: 'Material Waste (KG)', key: 'wasteKg', sortable: true, align: 'right' },
    { label: 'Waste Cost Impact', key: 'wasteCost', sortable: true, align: 'right' },
  ];

  // Computed Summaries
  readonly summaryTotalWasteKg = computed(() => {
    return this.wasteByStage().reduce((sum, r) => sum + Number(r.wasteKg || 0), 0);
  });

  readonly summaryTotalWasteCost = computed(() => {
    return this.wasteCostImpact().reduce((sum, r) => sum + Number(r.wasteCost || 0), 0);
  });

  protected get currentData(): WasteReportRow[] {
    return this.activeView() === 'by-stage' ? this.wasteByStage() : this.wasteCostImpact();
  }

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

    this.reportsService.loadWasteByStage(filters).subscribe({
      next: (rows) => {
        this.wasteByStage.set(rows);
        this.loadCostImpact(filters);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load waste report');
        this.loading.set(false);
      },
    });
  }

  private loadCostImpact(filters?: ReportFilters): void {
    this.reportsService.loadWasteCostImpact(filters).subscribe({
      next: (rows) => {
        this.wasteCostImpact.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load waste cost impact');
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

  setView(view: 'by-stage' | 'cost-impact'): void {
    this.activeView.set(view);
  }

  exportReport(): void {
    if (this.activeView() === 'by-stage') {
      this.reportsService.exportWasteByStage(this.currentFilters);
    } else {
      this.reportsService.exportWasteCostImpact(this.currentFilters);
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

  formatCurrency(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return this.money.format(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
