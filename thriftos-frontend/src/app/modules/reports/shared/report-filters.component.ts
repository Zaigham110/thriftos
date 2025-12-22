/**
 * Report Filters Panel Component
 * Phase 7: Reports & Analytics
 * 
 * Reusable filter panel for all report pages.
 * Emits filter changes to parent component.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Filter, X, Calendar, Download } from 'lucide-angular';
import { ReportFilters } from '../reports.models';
import { ButtonComponent, CardComponent } from '../../../shared/ui';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ButtonComponent, CardComponent],
  template: `
    <ui-card class="filters-panel">
      <div class="filters-header">
        <div class="filters-title">
          <lucide-icon [img]="icons.Filter" [size]="18"></lucide-icon>
          <span>Filters</span>
        </div>
        @if (hasActiveFilters()) {
          <button type="button" class="clear-btn" (click)="clearFilters()">
            <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
            Clear
          </button>
        }
      </div>

      <div class="filters-grid">
        <!-- Date Range -->
        <div class="filter-group">
          <label class="filter-label">
            <lucide-icon [img]="icons.Calendar" [size]="14"></lucide-icon>
            Start Date
          </label>
          <input
            type="date"
            class="filter-input"
            [ngModel]="filters().startDate"
            (ngModelChange)="updateFilter('startDate', $event)"
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">
            <lucide-icon [img]="icons.Calendar" [size]="14"></lucide-icon>
            End Date
          </label>
          <input
            type="date"
            class="filter-input"
            [ngModel]="filters().endDate"
            (ngModelChange)="updateFilter('endDate', $event)"
          />
        </div>

        <!-- Category Filter -->
        @if (showCategory) {
          <div class="filter-group">
            <label class="filter-label">Category</label>
            <select
              class="filter-input"
              [ngModel]="filters().categoryId"
              (ngModelChange)="updateFilter('categoryId', $event)"
            >
              <option value="">All Categories</option>
              @for (cat of categories; track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Grade Filter -->
        @if (showGrade) {
          <div class="filter-group">
            <label class="filter-label">Grade</label>
            <select
              class="filter-input"
              [ngModel]="filters().gradeId"
              (ngModelChange)="updateFilter('gradeId', $event)"
            >
              <option value="">All Grades</option>
              @for (grade of grades; track grade.id) {
                <option [value]="grade.id">{{ grade.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Warehouse Filter -->
        @if (showWarehouse) {
          <div class="filter-group">
            <label class="filter-label">Warehouse</label>
            <select
              class="filter-input"
              [ngModel]="filters().warehouseId"
              (ngModelChange)="updateFilter('warehouseId', $event)"
            >
              <option value="">All Warehouses</option>
              @for (wh of warehouses; track wh.id) {
                <option [value]="wh.id">{{ wh.name }}</option>
              }
            </select>
          </div>
        }
      </div>

      <div class="filters-actions">
        <ui-button variant="primary" (click)="applyFilters()">
          Apply Filters
        </ui-button>

        @if (showExport) {
          <ui-button variant="outline" [disabled]="exporting" (click)="onExport.emit()">
            <lucide-icon [img]="icons.Download" [size]="16"></lucide-icon>
            {{ exporting ? 'Exporting...' : 'Export CSV' }}
          </ui-button>
        }
      </div>
    </ui-card>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .filters-panel {
      margin-bottom: 1.5rem;
    }

    .filters-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .filters-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: $gray-700;
    }

    .clear-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: $gray-500;
      background: transparent;
      border: 1px solid $gray-300;
      border-radius: $radius-sm;
      cursor: pointer;

      &:hover {
        background: $gray-50;
        color: $gray-700;
      }
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .filter-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: $gray-600;
    }

    .filter-input {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      color: $gray-900;
      background: $bg-card;
      border: 1px solid $border-default;
      border-radius: $radius-md;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 3px $primary-soft;
      }
    }

    .filters-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid $border-default;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportFiltersComponent {
  @Input() showCategory = false;
  @Input() showGrade = false;
  @Input() showWarehouse = false;
  @Input() showExport = true;
  @Input() exporting = false;
  @Input() categories: { id: string; name: string }[] = [];
  @Input() grades: { id: string; name: string }[] = [];
  @Input() warehouses: { id: string; name: string }[] = [];

  @Output() filtersChange = new EventEmitter<ReportFilters>();
  @Output() onExport = new EventEmitter<void>();

  readonly icons = { Filter, X, Calendar, Download };

  readonly filters = signal<ReportFilters>({});

  hasActiveFilters(): boolean {
    const f = this.filters();
    return !!(f.startDate || f.endDate || f.categoryId || f.gradeId || f.warehouseId);
  }

  updateFilter(key: keyof ReportFilters, value: string): void {
    this.filters.update((f) => ({
      ...f,
      [key]: value || undefined,
    }));
  }

  applyFilters(): void {
    this.filtersChange.emit(this.filters());
  }

  clearFilters(): void {
    this.filters.set({});
    this.filtersChange.emit({});
  }
}
