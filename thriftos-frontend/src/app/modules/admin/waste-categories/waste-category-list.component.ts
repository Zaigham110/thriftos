import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppStackComponent,
  AppDialogComponent,
} from '../../../shared/ui';
import { WasteCategoryService } from './waste-category.service';
import type { WasteCategory } from './waste-category.models';

@Component({
  selector: 'app-waste-category-list',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppStackComponent,
    AppDialogComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">Waste Categories</h1>
          <p class="page-subtitle">Manage waste categories and their configuration. System-generated categories are automatically created when you create normal categories.</p>
        </app-stack>

        <div class="actions">
          <app-button variant="primary" (clickEvent)="navigateToCreate()">
            New Waste Category
          </app-button>
        </div>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-card>
            <app-data-table
              [data]="categories()"
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
                <span class="text-sm">{{ row.defaultResalePrice | currency:'USD':'symbol':'1.2-2' }}</span>
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
                  <app-button variant="secondary" type="button" (clickEvent)="navigateToEdit(row.id)">
                    Edit
                  </app-button>
                  @if (row.isActive) {
                    <app-button variant="danger" type="button" (clickEvent)="confirmDeactivate(row)">
                      Deactivate
                    </app-button>
                  }
                  @if (!row.isSystemGenerated && !row.isActive) {
                    <app-button variant="danger" type="button" (clickEvent)="confirmDelete(row)">
                      Delete
                    </app-button>
                  }
                </div>
              </ng-template>
            </app-data-table>
          </app-card>
        </app-section>
      </app-page-body>
    </app-page>

    <app-dialog
      [open]="deactivateDialog()"
      title="Deactivate Waste Category"
      [message]="'Are you sure you want to deactivate ' + selectedCategory()?.name + '? It will no longer be available for new sorting operations.'"
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
      [message]="'Are you sure you want to permanently delete ' + selectedCategory()?.name + '? This action cannot be undone.'"
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
    this.router.navigate(['/settings/waste-categories/new']);
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/settings/waste-categories', id, 'edit']);
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
