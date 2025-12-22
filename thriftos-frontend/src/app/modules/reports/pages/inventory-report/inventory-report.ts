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
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Package,
  ArrowLeft,
  Download,
  Scale,
  Layers,
  Clock,
  Warehouse,
} from 'lucide-angular';
import { ReportsService } from '../../reports.service';
import { InventorySnapshotResponse, InventoryAgingResponse, ReportFilters } from '../../reports.models';
import { ReportFiltersComponent } from '../../shared/report-filters.component';
import {
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-inventory-report',
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
  templateUrl: './inventory-report.html',
  styleUrl: './inventory-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryReportComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    Package,
    ArrowLeft,
    Download,
    Scale,
    Layers,
    Clock,
    Warehouse,
  };

  readonly snapshot = signal<InventorySnapshotResponse | null>(null);
  readonly aging = signal<InventoryAgingResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeView = signal<'snapshot' | 'aging'>('snapshot');
  protected currentFilters: ReportFilters = {};

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports', link: '/app/reports' },
    { label: 'Inventory Report' },
  ];

  protected get totalUnits(): number {
    return this.snapshot()?.summary?.totalUnits ?? 0;
  }

  protected get totalWeight(): number {
    return this.snapshot()?.summary?.totalWeightKg ?? 0;
  }

  protected get totalPcs(): number {
    return this.snapshot()?.summary?.totalPcs ?? 0;
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
