/**
 * Raw Category Management Component
 * 
 * Manage raw material categories for rag/bale procurement.
 * Separate from sorting output categories.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  LucideAngularModule,
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Filter,
  X,
  Layers,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-angular';

import { TenantService } from '../../../core/tenant/tenant.service';
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
import { RawCategoryFormDrawerComponent } from './raw-category-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

export interface RawCategory {
  id: string;
  tenantId: string;
  name: string;
  rawType: 'RAG' | 'BALE' | 'BOTH';
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-raw-category-management',
  standalone: true,
  imports: [
    CommonModule,
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
    RawCategoryFormDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './raw-category-management.html',
  styleUrl: './raw-category-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RawCategoryManagementComponent implements OnInit {
  private readonly tenantService = inject(TenantService);

  readonly icons = {
    Package,
    Plus,
    Pencil,
    Trash2,
    Search,
    RefreshCw,
    Filter,
    X,
    Layers,
    ArrowUpDown,
    CheckCircle2,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Raw Categories' },
  ];

  readonly searchQuery = signal('');
  readonly typeFilter = signal<'RAG' | 'BALE' | 'BOTH' | 'ALL'>('ALL');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly drawerOpen = signal(false);
  readonly selectedCategory = signal<RawCategory | null>(null);
  readonly confirmDeleteOpen = signal(false);
  readonly categoryToDelete = signal<RawCategory | null>(null);
  readonly rawCategories = signal<RawCategory[]>([]);

  readonly typeOptions = [
    { value: 'ALL', label: 'All Types' },
    { value: 'RAG', label: 'Rag Only' },
    { value: 'BALE', label: 'Bale Only' },
    { value: 'BOTH', label: 'Both' },
  ];

  // KPI Metrics
  readonly totalCount = computed(() => this.rawCategories().length);
  readonly ragCount = computed(
    () => this.rawCategories().filter((c) => c.rawType === 'RAG' || c.rawType === 'BOTH').length
  );
  readonly baleCount = computed(
    () => this.rawCategories().filter((c) => c.rawType === 'BALE' || c.rawType === 'BOTH').length
  );

  readonly filteredCategories = computed(() => {
    let categories = this.rawCategories();

    // Apply type filter
    const typeFilter = this.typeFilter();
    if (typeFilter !== 'ALL') {
      categories = categories.filter((cat) => cat.rawType === typeFilter);
    }

    // Apply search filter
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      categories = categories.filter((cat) =>
        cat.name.toLowerCase().includes(query)
      );
    }

    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tenantService.loadRawCategories().subscribe({
      next: (categories) => {
        this.rawCategories.set(categories);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load raw categories');
        this.loading.set(false);
      },
    });
  }

  refresh(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  openAddDrawer(): void {
    this.selectedCategory.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(category: RawCategory): void {
    this.selectedCategory.set(category);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedCategory.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.refresh();
  }

  confirmDelete(category: RawCategory): void {
    this.categoryToDelete.set(category);
    this.confirmDeleteOpen.set(true);
  }

  cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
    this.categoryToDelete.set(null);
  }

  deleteCategory(): void {
    const category = this.categoryToDelete();
    if (!category) return;

    this.tenantService.deleteRawCategory(category.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.refresh();
      },
      error: (err) => {
        console.error('Failed to delete raw category:', err);
        this.cancelDelete();
      },
    });
  }
}
