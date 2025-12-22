/**
 * Inventory List Component
 * Phase 6: Inventory Management
 * 
 * ERP-dense table showing all inventory items.
 * Route: /app/inventory/items
 * 
 * READ-ONLY - No create or edit actions.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Package, Search, Filter, Eye, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-angular';
import { InventoryService } from '../../inventory.service';
import { InventoryItem, InventoryItemFilters, InventoryStatus } from '../../inventory.models';
import { WarehouseBadgeComponent } from '../../shared/warehouse-badge.component';

interface SelectOption {
  value: string | number;
  label: string;
}

import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
  BadgeComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
    BadgeComponent,
    WarehouseBadgeComponent,
  ],
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryListComponent implements OnInit {
  protected readonly inventoryService = inject(InventoryService);

  readonly icons = {
    Package,
    Search,
    Filter,
    Eye,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
  };

  // Expose service signals
  readonly loading = this.inventoryService.loading;
  readonly error = this.inventoryService.error;
  readonly items = this.inventoryService.items;
  readonly totalCount = this.inventoryService.totalCount;
  readonly currentPage = this.inventoryService.currentPage;
  readonly totalPages = this.inventoryService.totalPages;

  // Local filter state
  readonly filters = signal<InventoryItemFilters>({
    page: 1,
    limit: 20,
  });

  // Reference data for filters
  readonly warehouses = this.inventoryService.warehouses;
  readonly categories = signal<SelectOption[]>([]);
  readonly grades = signal<SelectOption[]>([]);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Inventory', link: '/app/inventory' },
    { label: 'Items' },
  ];

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'RESERVED', label: 'Reserved' },
    { value: 'SOLD', label: 'Sold' },
  ];

  ngOnInit(): void {
    this.loadReferenceData();
    this.loadItems();
  }

  private loadReferenceData(): void {
    this.inventoryService.loadWarehouses().subscribe();
    this.inventoryService.loadReferenceData().subscribe({
      next: ({ categories, grades }) => {
        this.categories.set([
          { value: '', label: 'All Categories' },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ]);
        this.grades.set([
          { value: '', label: 'All Grades' },
          ...grades.map((g) => ({ value: g.id, label: g.name })),
        ]);
      },
    });
  }

  loadItems(): void {
    this.inventoryService.loadItems(this.filters()).subscribe();
  }

  onFilterChange(key: keyof InventoryItemFilters, value: string | number): void {
    this.filters.update((f) => ({
      ...f,
      [key]: value || undefined,
      page: key === 'page' ? (value as number) : 1, // Reset page on filter change
    }));
    this.loadItems();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.onFilterChange('page', page);
  }

  refresh(): void {
    this.loadItems();
  }

  clearFilters(): void {
    this.filters.set({ page: 1, limit: 20 });
    this.loadItems();
  }

  formatWeight(weight: number | string): string {
    return this.inventoryService.formatWeight(weight);
  }

  getStatusVariant(status: InventoryStatus): 'success' | 'warning' | 'danger' | 'info' {
    return this.inventoryService.getStatusVariant(status);
  }

  getWarehouseOptions(): SelectOption[] {
    return [
      { value: '', label: 'All Warehouses' },
      ...this.warehouses().map((w) => ({
        value: w.id,
        label: w.code ? `${w.code} - ${w.name}` : w.name,
      })),
    ];
  }
}
