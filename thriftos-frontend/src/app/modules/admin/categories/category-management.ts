/**
 * Category Management Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/categories
 * 
 * Manages sorting output categories and linked waste category assignments.
 */

import { I18N } from '../../../core/i18n/t.pipe';
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Layers,
  Tags,
  CheckCircle2,
  Recycle,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  ArrowUpDown,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Category } from '../admin.models';
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
  selector: 'app-category-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    I18N,
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
  templateUrl: './category-management.html',
  styleUrl: './category-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Categories' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly error = this.adminService.error;

  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Category | null>(null);
  readonly actionLoading = signal(false);

  readonly categories = this.adminService.categories;

  readonly icons = {
    Layers,
    Tags,
    CheckCircle2,
    Recycle,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Power,
    X,
    ArrowUpDown,
  };

  // KPI Calculations
  readonly totalCategoriesCount = computed(() => this.categories().length);
  readonly activeCategoriesCount = computed(
    () => this.categories().filter((c) => c.isActive).length
  );
  readonly linkedWasteCount = computed(() => this.categories().length);

  readonly filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.categories();

    return this.categories().filter((c) =>
      c.name.toLowerCase().includes(query)
    );
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

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearError(): void {
    this.adminService.clearError();
  }

  navigateToCreate(): void {
    this.router.navigate(['/settings/admin/categories/new']);
  }

  navigateToEdit(category: Category): void {
    this.router.navigate(['/settings/admin/categories', category.id, 'edit']);
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
