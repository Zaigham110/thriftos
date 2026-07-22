/**
 * Warehouse Management Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/warehouses
 * 
 * Manages tenant warehouses, default warehouse assignment, and status controls.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Building2,
  MapPin,
  CheckCircle2,
  Star,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  Building,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Warehouse } from '../admin.models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-warehouse-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    HasPermissionDirective,
  ],
  templateUrl: './warehouse-management.html',
  styleUrl: './warehouse-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehouseManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Warehouses' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly error = this.adminService.error;

  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Warehouse | null>(null);
  readonly actionLoading = signal(false);

  readonly warehouses = this.adminService.warehouses;

  readonly icons = {
    Building2,
    MapPin,
    CheckCircle2,
    Star,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Power,
    X,
    Building,
  };

  // KPI Calculations
  readonly totalWarehousesCount = computed(() => this.warehouses().length);
  readonly activeWarehousesCount = computed(
    () => this.warehouses().filter((w) => w.isActive).length
  );
  readonly defaultWarehouseName = computed(() => {
    const def = this.warehouses().find((w) => w.isDefault);
    return def ? def.name : 'None';
  });

  readonly filteredWarehouses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.warehouses();

    return this.warehouses().filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.code.toLowerCase().includes(query) ||
        (w.location || '').toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadWarehouses().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearError(): void {
    this.adminService.clearError();
  }

  navigateToCreate(): void {
    this.router.navigate(['/app/admin/warehouses/new']);
  }

  navigateToEdit(warehouse: Warehouse): void {
    this.router.navigate(['/app/admin/warehouses', warehouse.id, 'edit']);
  }

  confirmDeactivate(warehouse: Warehouse): void {
    this.selected.set(warehouse);
    this.confirmDeactivateOpen.set(true);
  }

  confirmDelete(warehouse: Warehouse): void {
    this.selected.set(warehouse);
    this.confirmDeleteOpen.set(true);
  }

  cancelDialogs(): void {
    this.confirmDeactivateOpen.set(false);
    this.confirmDeleteOpen.set(false);
    this.selected.set(null);
    this.actionLoading.set(false);
  }

  executeDeactivate(): void {
    const warehouse = this.selected();
    if (!warehouse) return;

    this.actionLoading.set(true);
    this.adminService.updateWarehouse(warehouse.id, { isActive: false }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
      },
    });
  }

  executeDelete(): void {
    const warehouse = this.selected();
    if (!warehouse) return;

    this.actionLoading.set(true);
    this.adminService.deleteWarehouse(warehouse.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
      },
    });
  }

  setAsDefault(warehouse: Warehouse): void {
    this.actionLoading.set(true);
    this.adminService.setDefaultWarehouse(warehouse.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
      },
    });
  }
}
