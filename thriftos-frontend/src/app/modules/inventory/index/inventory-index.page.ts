/**
 * INVENTORY INDEX - ODOO-STYLE DENSE TABLE
 * =========================================
 * Production-grade ERP inventory browser.
 * Dense table with fully functional filters.
 */

import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { InventoryService } from '../inventory.service';
import { AuthService } from '../../../core/auth/auth';
import { InventoryItem } from '../inventory.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  type DataTableColumn,
  type DataTableState,
  AppBadgeComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppSelectComponent,
  type SelectOption,
  AppFormFieldComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-inventory-index',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppSelectComponent,
    AppFormFieldComponent,
  ],
  templateUrl: './inventory-index.page.html',
  styleUrl: './inventory-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryIndexPage implements OnInit {
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly authService = inject(AuthService);

  // State
  readonly items = signal<InventoryItem[]>([]);
  readonly totalCount = signal<number>(0);
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

  // Permission check
  readonly hasPermission = computed(() => this.authService.hasPermission('INVENTORY_VIEW'));

  // Table configuration
  readonly tableColumns: DataTableColumn[] = [
    { key: 'unitCode', label: 'Inventory Code', sortable: true, width: '150px' },
    { key: 'category', label: 'Category', sortable: true, width: '120px' },
    { key: 'grade', label: 'Grade', sortable: true, width: '100px' },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      width: '120px',
      getValue: (row: any) => {
        const item = row as InventoryItem;
        return item.measurementType === 'WEIGHT'
          ? `${item.weightKg} kg`
          : `${item.pcsCount} pcs`;
      },
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      sortable: true,
      width: '140px',
      getValue: (row: any) => (row as InventoryItem).warehouseName || '—',
    },
    { key: 'status', label: 'Status', sortable: true, width: '100px' },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      width: '140px',
      getValue: (row: any) => new Date((row as InventoryItem).createdAt).toLocaleDateString(),
    },
  ];

  ngOnInit(): void {
    if (!this.hasPermission()) {
      this.error.set('You do not have permission to view inventory');
      return;
    }

    this.loadFilterOptions();
    this.loadItems();
  }

  loadFilterOptions(): void {
    // Load categories
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
        this.items.set(response.items);
        this.totalCount.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory');
        this.loading.set(false);
      },
    });
  }

  onTableStateChange(state: DataTableState): void {
    this.currentPage.set(state.pageIndex);
    this.pageSize.set(state.pageSize);
    this.loadItems();
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

  onRowClick(item: InventoryItem): void {
    this.router.navigate(['/inventory', item.id]);
  }

  getStatusVariant(status: string): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'MOVED':
        return 'warning';
      default:
        return 'default';
    }
  }
}
