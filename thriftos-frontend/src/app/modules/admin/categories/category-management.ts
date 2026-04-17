import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../admin.service';
import type { Category } from '../admin.models';
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
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../shared/ui';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-category-management',
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
  templateUrl: './category-management.html',
  styleUrl: './category-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  private readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Categories' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);

  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Category | null>(null);
  readonly actionLoading = signal(false);

  readonly categories = this.adminService.categories;

  readonly tableColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'sortOrder', label: 'Sort Order', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  readonly filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.categories();
    return this.categories().filter((c) => c.name.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadCategories().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }

  navigateToCreate(): void {
    this.router.navigate(['/app/admin/categories/new']);
  }

  navigateToEdit(category: Category): void {
    this.router.navigate(['/app/admin/categories', category.id, 'edit']);
  }

  confirmDeactivate(category: Category): void {
    this.selected.set(category);
    this.confirmDeactivateOpen.set(true);
  }

  confirmDelete(category: Category): void {
    this.selected.set(category);
    this.confirmDeleteOpen.set(true);
  }

  cancelDialogs(): void {
    this.confirmDeactivateOpen.set(false);
    this.confirmDeleteOpen.set(false);
    this.selected.set(null);
    this.actionLoading.set(false);
  }

  executeDeactivate(): void {
    const category = this.selected();
    if (!category) return;

    this.actionLoading.set(true);
    this.adminService.updateCategory(category.id, { isActive: false }).subscribe({
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
    const category = this.selected();
    if (!category) return;

    this.actionLoading.set(true);
    this.adminService.deleteCategory(category.id).subscribe({
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
}
