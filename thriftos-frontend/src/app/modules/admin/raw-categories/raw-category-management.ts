/**
 * Raw Category Management Component
 * 
 * Manage raw material categories for rag/bale procurement.
 * Separate from sorting output categories.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Package, Plus, Pencil, Trash2, Search, RefreshCw, Filter } from 'lucide-angular';
import { TenantService } from '../../../core/tenant/tenant.service';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
  ConfirmDialogComponent,
  ButtonComponent,
} from '../../../shared/ui';
import { RawCategoryFormDrawerComponent } from './raw-category-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

interface SelectOption {
  value: string;
  label: string;
}

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
    LucideAngularModule,
    CardComponent,
    BreadcrumbComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ConfirmDialogComponent,
    RawCategoryFormDrawerComponent,
    HasPermissionDirective,
    ButtonComponent,
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
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Raw Categories' },
  ];

  readonly searchQuery = signal('');
  readonly typeFilter = signal<'RAG' | 'BALE' | 'BOTH' | 'ALL'>('ALL');
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly selectedCategory = signal<RawCategory | null>(null);
  readonly confirmDeleteOpen = signal(false);
  readonly categoryToDelete = signal<RawCategory | null>(null);
  readonly rawCategories = signal<RawCategory[]>([]);

  readonly typeOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Types' },
    { value: 'RAG', label: 'Rag Only' },
    { value: 'BALE', label: 'Bale Only' },
    { value: 'BOTH', label: 'Both' },
  ];

  readonly filteredCategories = computed(() => {
    let categories = this.rawCategories();

    // Apply type filter
    const typeFilter = this.typeFilter();
    if (typeFilter !== 'ALL') {
      categories = categories.filter(cat => cat.rawType === typeFilter);
    }

    // Apply search filter
    const query = this.searchQuery().toLowerCase();
    if (query) {
      categories = categories.filter(cat =>
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
    this.tenantService.loadRawCategories().subscribe({
      next: (categories) => {
        this.rawCategories.set(categories);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
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

  getRawTypeBadgeClass(type: 'RAG' | 'BALE' | 'BOTH'): string {
    switch (type) {
      case 'RAG':
        return 'badge-blue';
      case 'BALE':
        return 'badge-green';
      case 'BOTH':
        return 'badge-purple';
      default:
        return 'badge-gray';
    }
  }
}
