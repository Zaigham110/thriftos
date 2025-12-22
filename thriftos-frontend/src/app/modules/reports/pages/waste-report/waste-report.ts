/**
 * Waste Report Component
 * Phase 7: Reports & Analytics
 * 
 * Waste analysis by stage and cost impact.
 * Shows waste distribution across procurement, sorting, and grading.
 * Route: /app/reports/waste
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Trash2,
  ArrowLeft,
  Download,
  DollarSign,
  Layers,
  Scale,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { WasteReportRow, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import {
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-waste-report',
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
  templateUrl: './waste-report.html',
  styleUrl: './waste-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasteReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    Trash2,
    ArrowLeft,
    Download,
    DollarSign,
    Layers,
    Scale,
  };

  readonly wasteByStage = signal<WasteReportRow[]>([]);
  readonly wasteCostImpact = signal<WasteReportRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeView = signal<'by-stage' | 'cost-impact'>('by-stage');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Waste Report' },
  ];

  protected get totalWaste(): number {
    const data = this.activeView() === 'by-stage' ? this.wasteByStage() : this.wasteCostImpact();
    return data.reduce((sum, r) => sum + (r.wasteKg || 0), 0);
  }

  protected get totalCost(): number {
    return this.wasteCostImpact().reduce((sum, r) => sum + (r.wasteCost || 0), 0);
  }

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

    // Load both reports
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

  formatWeight(weight: number): string {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(2)} T`;
    }
    return `${weight.toFixed(2)} KG`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  getBarWidth(wasteKg: number): string {
    const maxWaste = Math.max(...this.currentData.map((r) => r.wasteKg || 0));
    return maxWaste > 0 ? `${(wasteKg / maxWaste) * 100}%` : '0%';
  }

  getStageColor(stage: string): string {
    switch (stage) {
      case 'Procurement':
        return 'stage--procurement';
      case 'Sorting Stage 1':
        return 'stage--sorting';
      case 'Grading Stage 2':
        return 'stage--grading';
      default:
        return 'stage--default';
    }
  }
}
