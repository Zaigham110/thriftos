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
import { RouterLink } from '@angular/router';
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
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-yield-report',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
    ReportFiltersComponent,
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
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Yield Report' },
  ];

  // Computed summary
  protected get totalInput(): number {
    return this.data().reduce((sum, r) => sum + (r.inputWeightKg || 0), 0);
  }

  protected get totalOutput(): number {
    return this.data().reduce((sum, r) => sum + (r.outputWeightKg || 0), 0);
  }

  protected get totalWaste(): number {
    return this.data().reduce((sum, r) => sum + (r.wasteWeightKg || 0), 0);
  }

  protected get avgYield(): number {
    return this.totalInput > 0 ? (this.totalOutput / this.totalInput) * 100 : 0;
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

  exportReport(): void {
    this.reportsService.exportYieldReport(this.currentFilters);
  }

  formatWeight(weight: number): string {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(2)} T`;
    }
    return `${weight.toFixed(2)} KG`;
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  getYieldClass(yieldPct: number): string {
    if (yieldPct >= 80) return 'yield--high';
    if (yieldPct >= 60) return 'yield--medium';
    return 'yield--low';
  }
}
