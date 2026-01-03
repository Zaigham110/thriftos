import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
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
  ArrowRight,
} from 'lucide-angular';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  type BreadcrumbItem,
  type TableColumn,
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
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppDataTableComponent,
  ],
  templateUrl: './reports-dashboard.html',
  styleUrl: './reports-dashboard-erp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsDashboardComponent implements OnInit {
  readonly icons = {
    BarChart3,
    TrendingUp,
    Trash2,
    Package,
    DollarSign,
    FileBarChart,
    ArrowRight,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Reports' },
  ];

  readonly reportColumns: TableColumn[] = [
    { key: 'title', label: 'Report', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'action', label: 'Action', width: '120px' },
  ];

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  readonly reportLinks: ReportLink[] = [
    {
      id: 'procurement-summary',
      title: 'Procurement Summary',
      description: 'Purchase orders reconciled to computed procurement costs',
      route: '/reports/procurement-summary',
      icon: DollarSign,
      color: 'amber',
    },
    {
      id: 'yield',
      title: 'Yield Report',
      description: 'Category yield analysis from sorting operations',
      route: '/reports/yield',
      icon: TrendingUp,
      color: 'green',
    },
    {
      id: 'sorting-outputs',
      title: 'Sorting Outputs',
      description: 'Stage 1 category outputs and Stage 2 grade outputs',
      route: '/reports/sorting-outputs',
      icon: BarChart3,
      color: 'blue',
    },
    {
      id: 'sorting-waste',
      title: 'Sorting Waste',
      description: 'Legacy + categorized waste with combined totals',
      route: '/reports/sorting-waste',
      icon: Trash2,
      color: 'red',
    },
    {
      id: 'waste',
      title: 'Waste Report',
      description: 'Waste by stage and cost impact analysis',
      route: '/reports/waste',
      icon: Trash2,
      color: 'red',
    },
    {
      id: 'inventory',
      title: 'Inventory Report',
      description: 'Stock levels, valuation, and aging analysis',
      route: '/reports/inventory',
      icon: Package,
      color: 'blue',
    },
    {
      id: 'inventory-movements',
      title: 'Inventory Movements',
      description: 'Auditable inventory movement ledger (in/out)',
      route: '/reports/inventory-movements',
      icon: ArrowRight,
      color: 'blue',
    },
    {
      id: 'procurement',
      title: 'Procurement Report',
      description: 'Cost analysis and supplier performance',
      route: '/reports/procurement',
      icon: DollarSign,
      color: 'amber',
    },
    {
      id: 'repack-summary',
      title: 'Repack Summary',
      description: 'Draft vs sealed repacks grouped by status',
      route: '/reports/repack-summary',
      icon: Package,
      color: 'green',
    },
    {
      id: 'final-product-cost',
      title: 'Final Product Cost',
      description: 'Backend-derived sealed unit costs and traceability counts',
      route: '/reports/final-product-cost',
      icon: FileBarChart,
      color: 'primary',
    },
  ];

  ngOnInit(): void {
    // No dashboard-level aggregation. Report pages are the source of truth.
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(String(value));
    return Number.isFinite(n) ? n : null;
  }

  formatCurrency(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  formatWeight(weight: unknown): string {
    const n = this.toNumber(weight);
    if (n === null) return '—';
    if (n >= 1000) return `${(n / 1000).toFixed(2)} T`;
    return `${n.toFixed(2)} KG`;
  }

  formatPercent(value: unknown): string {
    const n = this.toNumber(value);
    if (n === null) return '—';
    return `${n.toFixed(1)}%`;
  }
}
