/**
 * Waste Category List Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/waste-categories
 * 
 * Manages byproduct waste categories and resale default prices.
 */

import { Component, computed, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Recycle,
  Link2,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  Tag,
  DollarSign,
} from 'lucide-angular';

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
import { MoneyPipe } from '../../../core/money/money.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { WasteCategoryService } from './waste-category.service';
import type { WasteCategory } from './waste-category.models';

@Component({
  selector: 'app-waste-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    HasPermissionDirective,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div class="header-left-group">
          <div class="eyebrow-container">
            <app-breadcrumb [items]="breadcrumbs"></app-breadcrumb>
          </div>
          <h1 class="page-title">Waste Categories</h1>
          <p class="page-subtitle">Configure byproduct waste streams, resale default prices, and auto-generated sorting reject links.</p>
        </div>

        <div class="header-right-actions">
          <button class="btn btn-secondary" (click)="refresh()" [disabled]="loading()">
            <lucide-icon [img]="icons.RefreshCw" [size]="15" [class.animate-spin]="loading()"></lucide-icon>
            Refresh
          </button>
          <button class="btn btn-primary" (click)="navigateToCreate()" *hasPermission="'category.create'">
            <lucide-icon [img]="icons.Plus" [size]="15"></lucide-icon>
            New Waste Category
          </button>
        </div>
      </app-page-header>

      <app-page-body>
        <!-- KPI Summary Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-purple">
              <lucide-icon [img]="icons.Recycle" [size]="20"></lucide-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Total Waste Categories</span>
              <span class="kpi-value">{{ totalCategoriesCount() }}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-emerald">
              <lucide-icon [img]="icons.Link2" [size]="20"></lucide-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Auto-Linked Output Streams</span>
              <span class="kpi-value">{{ autoLinkedCount() }}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-blue">
              <lucide-icon [img]="icons.Layers" [size]="20"></lucide-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Manual Categories</span>
              <span class="kpi-value">{{ manualCategoriesCount() }}</span>
            </div>
          </div>
        </div>

        <!-- Main Table Section -->
        <app-section>
          <div class="table-toolbar">
            <div class="toolbar-title">
              <span class="section-label">Waste Category Directory</span>
              <span class="results-count">{{ filteredCategories().length }} categories</span>
            </div>

            <div class="search-box">
              <lucide-icon [img]="icons.Search" [size]="15" class="search-icon"></lucide-icon>
              <input
                type="text"
                class="search-input"
                placeholder="Search waste categories or linked output category..."
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event.target).value)"
              />
              @if (searchQuery()) {
                <button class="search-clear-btn" (click)="clearSearch()">
                  <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
                </button>
              }
            </div>
          </div>

          <div class="table-card">
            @if (loading() && categories().length === 0) {
              <app-loading></app-loading>
            } @else if (filteredCategories().length === 0) {
              <app-empty-state
                title="No Waste Categories Found"
                [message]="searchQuery() ? 'No waste category matches your search query' : 'Create your first waste category or add normal categories to auto-generate linked streams.'"
              >
                @if (!searchQuery()) {
                  <button class="btn btn-primary mt-3" (click)="navigateToCreate()" *hasPermission="'category.create'">
                    <lucide-icon [img]="icons.Plus" [size]="15"></lucide-icon>
                    Create Waste Category
                  </button>
                }
              </app-empty-state>
            } @else {
              <div class="table-wrapper">
                <table class="waste-table">
                  <thead>
                    <tr>
                      <th>Waste Category Name</th>
                      <th>Creation Type</th>
                      <th>Linked Output Category</th>
                      <th>Unit Type</th>
                      <th>Default Resale Price</th>
                      <th>Status</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (cat of filteredCategories(); track cat.id) {
                      <tr>
                        <td>
                          <span class="waste-name-badge">
                            <lucide-icon [img]="icons.Recycle" [size]="13"></lucide-icon>
                            {{ cat.name }}
                          </span>
                        </td>

                        <td>
                          @if (cat.isSystemGenerated) {
                            <span class="type-pill system">
                              <lucide-icon [img]="icons.Link2" [size]="12"></lucide-icon>
                              Auto-Linked
                            </span>
                          } @else {
                            <span class="type-pill manual">
                              Manual
                            </span>
                          }
                        </td>

                        <td>
                          @if (cat.linkedCategory) {
                            <span class="linked-category-pill">
                              <lucide-icon [img]="icons.Tag" [size]="12"></lucide-icon>
                              {{ cat.linkedCategory.name }}
                            </span>
                          } @else {
                            <span class="text-subtle">Standalone</span>
                          }
                        </td>

                        <td>
                          <span class="unit-pill">
                            {{ cat.unitType }}
                          </span>
                        </td>

                        <td>
                          <span class="price-value">
                            {{ cat.defaultResalePrice | money:{ minimumFractionDigits: 2, maximumFractionDigits: 2 } }} / {{ cat.unitType }}
                          </span>
                        </td>

                        <td>
                          <span 
                            class="status-pill" 
                            [class.status-active]="cat.isActive" 
                            [class.status-inactive]="!cat.isActive"
                          >
                            <span class="status-dot"></span>
                            {{ cat.isActive ? 'Active' : 'Inactive' }}
                          </span>
                        </td>

                        <td class="text-right">
                          <div class="action-buttons">
                            <button 
                              class="action-icon-btn" 
                              title="Edit Waste Category"
                              (click)="navigateToEdit(cat.id)"
                              *hasPermission="'category.update'"
                            >
                              <lucide-icon [img]="icons.Pencil" [size]="15"></lucide-icon>
                            </button>

                            @if (cat.isActive) {
                              <button 
                                class="action-icon-btn danger" 
                                title="Deactivate Waste Category"
                                (click)="confirmDeactivate(cat)"
                                *hasPermission="'category.update'"
                              >
                                <lucide-icon [img]="icons.Power" [size]="15"></lucide-icon>
                              </button>
                            }

                            @if (!cat.isSystemGenerated && !cat.isActive) {
                              <button 
                                class="action-icon-btn danger" 
                                title="Delete Waste Category"
                                (click)="confirmDelete(cat)"
                                *hasPermission="'category.delete'"
                              >
                                <lucide-icon [img]="icons.Trash2" [size]="15"></lucide-icon>
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </app-section>
      </app-page-body>
    </app-page>

    <!-- Deactivate Modal -->
    <app-dialog
      [open]="deactivateDialog()"
      title="Deactivate Waste Category"
      (closed)="deactivateDialog.set(false)"
    >
      <div class="dialog-content-body">
        <p class="dialog-desc">
          Are you sure you want to deactivate <strong>{{ selectedCategory()?.name }}</strong>?
          Deactivating this waste category removes it from selection in future sorting waste records.
        </p>
      </div>

      <div slot="footer" class="dialog-actions">
        <button class="btn btn-secondary" (click)="deactivateDialog.set(false)">Cancel</button>
        <button class="btn btn-danger" [disabled]="actionLoading()" (click)="executeDeactivate()">
          @if (actionLoading()) { Deactivating... } @else { Deactivate }
        </button>
      </div>
    </app-dialog>

    <!-- Delete Modal -->
    <app-dialog
      [open]="deleteDialog()"
      title="Delete Waste Category"
      (closed)="deleteDialog.set(false)"
    >
      <div class="dialog-content-body">
        <p class="dialog-desc">
          Are you sure you want to permanently delete waste category <strong>{{ selectedCategory()?.name }}</strong>?
          This action cannot be undone. If referenced in waste records, deletion will be blocked.
        </p>
      </div>

      <div slot="footer" class="dialog-actions">
        <button class="btn btn-secondary" (click)="deleteDialog.set(false)">Cancel</button>
        <button class="btn btn-danger" [disabled]="actionLoading()" (click)="executeDelete()">
          @if (actionLoading()) { Deleting... } @else { Delete }
        </button>
      </div>
    </app-dialog>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    /* KPI Summary Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(1, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;

      @media (min-width: 640px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: white;
      border: 1px solid $gray-200;
      border-radius: 0.5rem;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
      transition: border-color 0.15s ease;

      &:hover {
        border-color: $gray-300;
      }
    }

    .kpi-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.375rem;
      flex-shrink: 0;

      &-purple {
        background-color: $primary-soft;
        color: $primary;
      }

      &-emerald {
        background-color: hsl(142 76% 96%);
        color: hsl(142 71% 40%);
      }

      &-blue {
        background-color: hsl(215 100% 96%);
        color: hsl(217 91% 45%);
      }
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: $gray-500;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .kpi-value {
      font-size: 1.375rem;
      font-weight: 700;
      color: $gray-900;
      line-height: 1.2;
    }

    /* Toolbar & Search */
    .table-toolbar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1rem;

      @media (min-width: 768px) {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .toolbar-title {
      display: flex;
      align-items: center;
      gap: 0.625rem;

      .section-label {
        font-size: 0.9375rem;
        font-weight: 600;
        color: $gray-900;
      }

      .results-count {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
        background: $gray-100;
        color: $gray-600;
      }
    }

    .search-box {
      position: relative;
      width: 100%;

      @media (min-width: 768px) {
        width: 320px;
      }
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: $gray-400;
      width: 1rem;
      height: 1rem;
    }

    .search-input {
      width: 100%;
      padding: 0.4375rem 2rem 0.4375rem 2.25rem;
      font-size: 0.875rem;
      border: 1px solid $gray-300;
      border-radius: 0.375rem;
      background: white;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 3px $primary-soft;
      }
    }

    .search-clear-btn {
      position: absolute;
      right: 0.6rem;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: $gray-400;
      cursor: pointer;
      padding: 0.2rem;
      display: inline-flex;
      align-items: center;

      &:hover {
        color: $gray-700;
      }
    }

    /* Table Card & Data Table */
    .table-card {
      background: white;
      border: 1px solid $gray-200;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .waste-table {
      width: 100%;
      border-collapse: collapse;

      th {
        padding: 0.625rem 1rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: $gray-500;
        background: $gray-50;
        border-bottom: 1px solid $gray-200;
        text-align: left;
      }

      td {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        color: $gray-700;
        border-bottom: 1px solid $gray-100;
        vertical-align: middle;
      }

      tr:last-child td {
        border-bottom: none;
      }

      .text-right {
        text-align: right;
      }

      .text-subtle {
        color: $gray-500;
        font-size: 0.8125rem;
      }
    }

    /* Badges & Pills */
    .waste-name-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.625rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 700;
      background: $primary-soft;
      color: $primary;
    }

    .type-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;

      &.system {
        background: hsl(38 92% 95%);
        color: hsl(38 92% 35%);
        border: 1px solid hsl(38 92% 85%);
      }

      &.manual {
        background: $gray-100;
        color: $gray-700;
        border: 1px solid $gray-200;
      }
    }

    .linked-category-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      background: hsl(215 100% 96%);
      color: hsl(217 91% 40%);
      border: 1px solid hsl(215 100% 88%);
    }

    .unit-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: monospace;
      background: $gray-100;
      color: $gray-800;
    }

    .price-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: $gray-900;
    }

    /* Status Pills */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 9999px;
    }

    .status-active {
      background-color: hsl(142 76% 96%);
      color: hsl(142 71% 33%);

      .status-dot {
        background-color: hsl(142 71% 45%);
      }
    }

    .status-inactive {
      background-color: $gray-100;
      color: $gray-600;

      .status-dot {
        background-color: $gray-400;
      }
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
    }

    .action-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.875rem;
      height: 1.875rem;
      border-radius: 0.375rem;
      border: 1px solid $gray-200;
      background: white;
      color: $gray-600;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: $gray-50;
        color: $gray-900;
        border-color: $gray-300;
      }

      &.danger:hover:not(:disabled) {
        background: hsl(0 84% 96%);
        color: hsl(0 72% 45%);
        border-color: hsl(0 84% 88%);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    /* Dialog Styles */
    .dialog-content-body {
      padding: 0.5rem 0;

      .dialog-desc {
        font-size: 0.875rem;
        color: $gray-600;
        line-height: 1.5;
        margin: 0;
      }
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    /* General Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4375rem;
      padding: 0.4375rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 0.375rem;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

      &-primary {
        background: $primary;
        color: white;
        box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 1px 2px 0 rgba(113, 75, 103, 0.3);

        &:hover:not(:disabled) {
          background: $primary-hover;
          transform: translateY(-1px);
        }
      }

      &-secondary {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #334155;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

        &:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }

      &-danger {
        background: hsl(0 72% 51%);
        color: white;

        &:hover:not(:disabled) {
          background: hsl(0 72% 43%);
        }
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    lucide-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;

      svg {
        display: block;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasteCategoryListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly service = inject(WasteCategoryService);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Waste Categories' },
  ];

  readonly categories = signal<WasteCategory[]>([]);
  readonly loading = signal(false);

  readonly searchQuery = signal('');

  readonly icons = {
    Recycle,
    Link2,
    Layers,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Power,
    X,
    Tag,
    DollarSign,
  };

  // KPI Calculations
  readonly totalCategoriesCount = computed(() => this.categories().length);
  readonly autoLinkedCount = computed(
    () => this.categories().filter((c) => c.isSystemGenerated).length
  );
  readonly manualCategoriesCount = computed(
    () => this.categories().filter((c) => !c.isSystemGenerated).length
  );

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

  ngOnInit(): void {
    this.loadCategories();
  }

  refresh(): void {
    this.loadCategories();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/app/admin/waste-categories/new']);
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/app/admin/waste-categories', id, 'edit']);
  }

  confirmDeactivate(category: WasteCategory): void {
    this.selectedCategory.set(category);
    this.deactivateDialog.set(true);
  }

  confirmDelete(category: WasteCategory): void {
    this.selectedCategory.set(category);
    this.deleteDialog.set(true);
  }

  executeDeactivate(): void {
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
      },
    });
  }

  executeDelete(): void {
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
      },
    });
  }
}
