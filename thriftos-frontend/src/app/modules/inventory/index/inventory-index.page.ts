/**
 * Inventory Index Component
 * Phase 2: Inventory Module UI
 * 
 * High-density directory table and KPI summary cards for Finished Goods Inventory.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Warehouse as WarehouseIcon,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Filter,
  XCircle,
  DollarSign,
  Truck,
} from 'lucide-angular';

import { InventoryService } from '../inventory.service';
import { AuthService } from '../../../core/auth/auth';
import { InventoryItem } from '../inventory.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
  type SelectOption,
} from '../../../shared/ui';

@Component({
  selector: 'app-inventory-index',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './inventory-index.page.html',
  styleUrl: './inventory-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryIndexPage implements OnInit {
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly authService = inject(AuthService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inventory', route: '/app/inventory' },
    { label: 'Finished Goods' },
  ];

  readonly icons = {
    Warehouse: WarehouseIcon,
    Package,
    Layers,
    Sparkles,
    RefreshCw,
    Eye,
    Filter,
    XCircle,
    DollarSign,
    Truck,
  };

  // State
  readonly items = signal<InventoryItem[]>([]);
  readonly totalCount = signal<number>(0);
  readonly totalWeightKg = signal<number>(0);
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter options
  readonly categories = signal<SelectOption[]>([]);
  readonly grades = signal<SelectOption[]>([]);
  readonly warehouses = signal<SelectOption[]>([]);

  // Filter controls
  readonly categoryFilter = new FormControl<string>('');
  readonly gradeFilter = new FormControl<string>('');
  readonly warehouseFilter = new FormControl<string>('');
  readonly statusFilter = new FormControl<string>('');

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'MOVED', label: 'Moved' },
    { value: 'CONSUMED', label: 'Consumed' },
  ];

  readonly hasPermission = computed(() => this.authService.hasPermission('INVENTORY_VIEW'));

  // Computed KPI Metrics
  readonly availableCount = computed(() => {
    return this.items().filter((i) => i.status === 'AVAILABLE').length;
  });

  readonly totalValuation = computed(() => {
    return this.items().reduce((sum, item) => {
      const weight = Number(item.weightKg || 0);
      const cost = Number(item.avgCost || 0);
      return sum + weight * cost;
    }, 0);
  });

  ngOnInit(): void {
    if (!this.hasPermission()) {
      this.error.set('You do not have permission to view inventory');
      return;
    }

    this.loadFilterOptions();
    this.loadItems();
  }

  loadFilterOptions(): void {
    this.inventoryService.getFilterOptions().subscribe({
      next: (options) => {
        this.categories.set([
          { value: '', label: 'All Categories' },
          ...options.categories.map((c) => ({ value: c.id, label: c.name })),
        ]);
        this.grades.set([
          { value: '', label: 'All Grades' },
          ...options.grades.map((g) => ({ value: g.id, label: g.name })),
        ]);
        this.warehouses.set([
          { value: '', label: 'All Warehouses' },
          ...options.warehouses.map((w) => ({ value: w.id, label: w.name })),
        ]);
      },
      error: (err) => console.error('Failed to load filter options:', err),
    });
  }

  loadItems(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: any = {
      page: this.currentPage().toString(),
      limit: this.pageSize().toString(),
    };

    if (this.categoryFilter.value) params.categoryId = this.categoryFilter.value;
    if (this.gradeFilter.value) params.gradeId = this.gradeFilter.value;
    if (this.warehouseFilter.value) params.warehouseId = this.warehouseFilter.value;
    if (this.statusFilter.value) params.status = this.statusFilter.value;

    this.inventoryService.getAll(params).subscribe({
      next: (response) => {
        this.items.set(response.items || []);
        this.totalCount.set(response.total || 0);
        this.totalWeightKg.set(response.aggregates?.totalWeight || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load inventory items');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadItems();
  }

  clearFilters(): void {
    this.categoryFilter.setValue('');
    this.gradeFilter.setValue('');
    this.warehouseFilter.setValue('');
    this.statusFilter.setValue('');
    this.currentPage.set(1);
    this.loadItems();
  }

  viewDetails(item: InventoryItem): void {
    this.router.navigate(['/app/inventory', item.id]);
  }

  itemCode(item: InventoryItem): string {
    if (item.unitCode) return item.unitCode;
    return `INV-${String(item.id).slice(0, 8).toUpperCase()}`;
  }

  itemTotalValue(item: InventoryItem): number {
    const weight = Number(item.weightKg || 0);
    const cost = Number(item.avgCost || 0);
    return weight * cost;
  }
}
