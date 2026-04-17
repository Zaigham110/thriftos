import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../admin.service';
import { Warehouse as WarehouseModel } from '../admin.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppBreadcrumbComponent,
  AppStackComponent,
  AppDialogComponent,
  type BreadcrumbItem,
  type DataTableColumn,
} from '../../../shared/ui';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-warehouse-management',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
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

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Warehouses' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<WarehouseModel | null>(null);
  readonly actionLoading = signal(false);

  readonly warehouses = this.adminService.warehouses;

  readonly tableColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Status', sortable: true },
  ];

  readonly filteredWarehouses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.warehouses();
    return this.warehouses().filter((w) =>
      w.name.toLowerCase().includes(query) ||
      (w.location || '').toLowerCase().includes(query) ||
      w.code.toLowerCase().includes(query)
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

  navigateToCreate(): void {
    this.router.navigate(['/app/admin/warehouses/new']);
  }

  navigateToEdit(warehouse: WarehouseModel): void {
    this.router.navigate(['/app/admin/warehouses', warehouse.id, 'edit']);
  }

  confirmDeactivate(warehouse: WarehouseModel): void {
    this.selected.set(warehouse);
    this.confirmDeactivateOpen.set(true);
  }

  confirmDelete(warehouse: WarehouseModel): void {
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

  setAsDefault(warehouse: WarehouseModel): void {
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
