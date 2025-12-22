/**
 * Reports Dashboard Component
 * Phase 7: Reports & Analytics
 * 
 * Landing page with summary cards linking to detailed reports.
 * Route: /app/reports
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  BarChart3,
  TrendingUp,
  Trash2,
  Package,
  DollarSign,
  FileBarChart,
  Download,
  RefreshCw,
} from 'lucide-angular';
import { ReportsService } from '../reports.service';
import { ReportsDashboardSummary } from '../reports.models';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../shared/ui';

interface ReportLink {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
  color: 'primary' | 'blue' | 'green' | 'amber' | 'red';
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
  ],
  templateUrl: './reports-dashboard.html',
  styleUrl: './reports-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsDashboardComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    BarChart3,
    TrendingUp,
    Trash2,
    Package,
    DollarSign,
    FileBarChart,
    Download,
    RefreshCw,
  };

  readonly summary = signal<ReportsDashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports' },
  ];

  readonly reportLinks: ReportLink[] = [
    {
      id: 'yield',
      title: 'Yield Report',
      description: 'Category yield analysis from sorting operations',
      route: '/app/reports/yield',
      icon: TrendingUp,
      color: 'green',
    },
    {
      id: 'waste',
      title: 'Waste Report',
      description: 'Waste by stage and cost impact analysis',
      route: '/app/reports/waste',
      icon: Trash2,
      color: 'red',
    },
    {
      id: 'inventory',
      title: 'Inventory Report',
      description: 'Inventory snapshot and aging analysis',
      route: '/app/reports/inventory',
      icon: Package,
      color: 'blue',
    },
    {
      id: 'procurement',
      title: 'Procurement Report',
      description: 'Vendor summary and cost breakdown',
      route: '/app/reports/procurement',
      icon: DollarSign,
      color: 'amber',
    },
  ];

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportsService.loadDashboardSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load reports summary');
        this.loading.set(false);
      },
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
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
}
