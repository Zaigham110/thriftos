import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppStackComponent,
  AppDialogComponent,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../core/money/money.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { WasteCategoryService } from './waste-category.service';
import type { WasteCategory } from './waste-category.models';

@Component({
  selector: 'app-waste-category-list',
  standalone: true,
  imports: [
    CommonModule,
    MoneyPipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppStackComponent,
    AppDialogComponent,
    HasPermissionDirective,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">Waste Categories</h1>
          <p class="page-subtitle">Manage waste categories and their configuration. System-generated categories are automatically created when you create normal categories.</p>
        </app-stack>

        <div class="actions">
          <app-button variant="primary" (clickEvent)="navigateToCreate()" *hasPermission="'category.create'">
            New Waste Category
          </app-button>
        </div>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-section-header>
            <h2 class="section-title">All Waste Categories</h2>
            <div class="section-actions">
              <div class="search">
                <input
                  type="text"
                  class="search-input"
                  placeholder="Search waste categories…"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                />
              </div>
            </div>
          </app-section-header>

          <app-section-body>
            <app-data-table
              [data]="filteredCategories()"
              [columns]="columns"
              [loading]="loading()"
              emptyMessage="No waste categories found. Create your first waste category."
            >
              <ng-template #nameCell let-row>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ row.name }}</span>
                </div>
              </ng-template>

              <ng-template #linkedCategoryCell let-row>
                @if (row.linkedCategory) {
                  <span class="text-sm">{{ row.linkedCategory.name }}</span>
                } @else {
                  <span class="text-sm text-gray-500">Manual</span>
                }
              </ng-template>

              <ng-template #unitCell let-row>
                <span class="text-sm">{{ row.unitType }}</span>
              </ng-template>

              <ng-template #priceCell let-row>
                <span class="text-sm">{{ row.defaultResalePrice | money:{ minimumFractionDigits: 2, maximumFractionDigits: 2 } }}</span>
              </ng-template>

              <ng-template #statusCell let-row>
                <span class="text-sm" [class.text-green-600]="row.isActive" [class.text-gray-500]="!row.isActive">
                  {{ row.isActive ? 'Active' : 'Inactive' }}
                </span>
              </ng-template>

              <ng-template #typeCell let-row>
                <span class="text-sm" [class.text-orange-600]="row.isSystemGenerated" [class.text-blue-600]="!row.isSystemGenerated">
                  {{ row.isSystemGenerated ? 'System' : 'Manual' }}
                </span>
              </ng-template>

              <ng-template #actionsCell let-row>
                <div class="flex items-center gap-2">
                  <app-button variant="secondary" type="button" (clickEvent)="navigateToEdit(row.id)" *hasPermission="'category.update'">
                    Edit
                  </app-button>
                  @if (row.isActive) {
                    <app-button variant="danger" type="button" (clickEvent)="confirmDeactivate(row)" *hasPermission="'category.update'">
                      Deactivate
                    </app-button>
                  }
                  @if (!row.isSystemGenerated && !row.isActive) {
                    <app-button variant="danger" type="button" (clickEvent)="confirmDelete(row)" *hasPermission="'category.delete'">
                      Delete
                    </app-button>
                  }
                </div>
              </ng-template>
            </app-data-table>
          </app-section-body>
        </app-section>
      </app-page-body>
    </app-page>

    <app-dialog
      [open]="deactivateDialog()"
      title="Deactivate Waste Category"
      [message]="'Deactivating ' + (selectedCategory()?.name || '') + ' will remove it from selection in Sorting Stage-1, Sorting Stage-2, and waste reporting. Existing history remains.'"
      confirmText="Deactivate"
      cancelText="Cancel"
      variant="danger"
      [loading]="actionLoading()"
      (confirmed)="executeDeactivate()"
      (cancelled)="deactivateDialog.set(false)"
    />

    <app-dialog
      [open]="deleteDialog()"
      title="Delete Waste Category"
      [message]="'Deleting ' + (selectedCategory()?.name || '') + ' will permanently remove it. If it has been used in waste records, deletion will be blocked and you should deactivate instead.'"
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
      [loading]="actionLoading()"
      (confirmed)="executeDelete()"
      (cancelled)="deleteDialog.set(false)"
    />
  `
})
export class WasteCategoryListComponent {
  private readonly router = inject(Router);
  private readonly service = inject(WasteCategoryService);

  readonly categories = signal<WasteCategory[]>([]);
  readonly loading = signal(false);

  readonly searchQuery = signal('');
  readonly filteredCategories = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.categories();

    return this.categories().filter((c) => {
      return (
        c.name.toLowerCase().includes(query) ||
        (c.linkedCategory?.name || '').toLowerCase().includes(query)
      );
    });
  });
  
  readonly deactivateDialog = signal(false);
  readonly deleteDialog = signal(false);
  readonly selectedCategory = signal<WasteCategory | null>(null);
  readonly actionLoading = signal(false);

  readonly columns = [
    { key: 'name', label: 'Name', template: 'nameCell' },
    { key: 'linkedCategory', label: 'Linked Category', template: 'linkedCategoryCell' },
    { key: 'unitType', label: 'Unit', template: 'unitCell' },
    { key: 'defaultResalePrice', label: 'Default Price/Unit', template: 'priceCell' },
    { key: 'isActive', label: 'Status', template: 'statusCell' },
    { key: 'isSystemGenerated', label: 'Type', template: 'typeCell' },
    { key: 'actions', label: '', template: 'actionsCell', sortable: false }
  ];

  ngOnInit() {
    this.loadCategories();
  }

  private loadCategories() {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  navigateToCreate() {
    this.router.navigate(['/app/admin/waste-categories/new']);
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/app/admin/waste-categories', id, 'edit']);
  }

  confirmDeactivate(category: WasteCategory) {
    this.selectedCategory.set(category);
    this.deactivateDialog.set(true);
  }

  confirmDelete(category: WasteCategory) {
    this.selectedCategory.set(category);
    this.deleteDialog.set(true);
  }

  executeDeactivate() {
    const category = this.selectedCategory();
    if (!category) return;

    this.actionLoading.set(true);
    this.service.deactivate(category.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.deactivateDialog.set(false);
        this.selectedCategory.set(null);
        this.loadCategories();
      },
      error: () => {
        this.actionLoading.set(false);
      }
    });
  }

  executeDelete() {
    const category = this.selectedCategory();
    if (!category) return;

    this.actionLoading.set(true);
    this.service.delete(category.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.deleteDialog.set(false);
        this.selectedCategory.set(null);
        this.loadCategories();
      },
      error: () => {
        this.actionLoading.set(false);
      }
    });
  }
}
