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
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  DollarSign,
  ArrowLeft,
  Download,
  Scale,
  Package,
  Users,
  TrendingDown,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { VendorSummaryRow, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import {
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-procurement-report',
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
  templateUrl: './procurement-report.html',
  styleUrl: './procurement-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    DollarSign,
    ArrowLeft,
    Download,
    Scale,
    Package,
    Users,
    TrendingDown,
  };

  readonly vendors = signal<VendorSummaryRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Procurement Report' },
  ];

  protected get totalVendors(): number {
    return this.vendors().length;
  }

  protected get totalContainers(): number {
    return this.vendors().reduce((sum, v) => sum + (v.totalContainers || 0), 0);
  }

  protected get totalCost(): number {
    return this.vendors().reduce((sum, v) => sum + (v.totalCost || 0), 0);
  }

  protected get totalWeight(): number {
    return this.vendors().reduce((sum, v) => sum + (v.totalWeightKg || 0), 0);
  }

  protected get avgCostPerKg(): number {
    return this.totalWeight > 0 ? this.totalCost / this.totalWeight : 0;
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

  exportReport(): void {
    this.reportsService.exportVendorSummary(this.currentFilters);
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

  getCostClass(avgCostPerKg: number): string {
    const overallAvg = this.avgCostPerKg;
    if (avgCostPerKg < overallAvg * 0.9) return 'cost--low';
    if (avgCostPerKg > overallAvg * 1.1) return 'cost--high';
    return 'cost--normal';
  }

  getVendorShareWidth(totalCost: number): string {
    const maxCost = Math.max(...this.vendors().map((v) => v.totalCost || 0));
    return maxCost > 0 ? `${(totalCost / maxCost) * 100}%` : '0%';
  }
}
