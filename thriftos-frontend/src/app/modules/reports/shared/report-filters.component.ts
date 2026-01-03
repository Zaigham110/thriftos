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
import { ReportFilters } from '../reports.models';
import { 
  AppButtonComponent, 
  AppGridComponent,
  AppStackComponent,
  AppInputComponent,
  AppSelectComponent,
  type SelectOption
} from '../../../shared/ui';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AppButtonComponent, 
    AppGridComponent,
    AppStackComponent,
    AppInputComponent,
    AppSelectComponent
  ],
  template: `
    <app-stack direction="vertical" spacing="md">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold">Filters</div>
        @if (hasActiveFilters() || (showSearch && searchText())) {
          <app-button variant="secondary" (click)="clearAll()">Clear</app-button>
        }
      </div>

      <app-grid [columns]="4" gap="md">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium">Start Date</label>
          <app-input type="date" [(ngModel)]="filtersModel.startDate" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium">End Date</label>
          <app-input type="date" [(ngModel)]="filtersModel.endDate" />
        </div>

        @if (showSearch) {
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium">Search</label>
            <app-input placeholder="Search..." [(ngModel)]="searchModel" (ngModelChange)="emitSearch($event)" />
          </div>
        }

        @if (showCategory) {
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium">Category</label>
            <app-select [options]="categoryOptions" (ngModelChange)="updateFilter('categoryId', $event)" [(ngModel)]="filtersModel.categoryId" />
          </div>
        }

        @if (showGrade) {
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium">Grade</label>
            <app-select [options]="gradeOptions" (ngModelChange)="updateFilter('gradeId', $event)" [(ngModel)]="filtersModel.gradeId" />
          </div>
        }

        @if (showWarehouse) {
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium">Warehouse</label>
            <app-select [options]="warehouseOptions" (ngModelChange)="updateFilter('warehouseId', $event)" [(ngModel)]="filtersModel.warehouseId" />
          </div>
        }
      </app-grid>

      <div class="flex items-center gap-3">
        <app-button variant="primary" (click)="applyFilters()">Apply Filters</app-button>

        @if (showExport) {
          <app-button variant="secondary" [disabled]="exporting" (click)="onExport.emit()">
            {{ exporting ? 'Exporting...' : 'Export CSV' }}
          </app-button>
        }
      </div>
    </app-stack>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportFiltersComponent {
  @Input() showCategory = false;
  @Input() showGrade = false;
  @Input() showWarehouse = false;
  @Input() showSearch = true;
  @Input() showExport = true;
  @Input() exporting = false;
  @Input() categories: { id: string; name: string }[] = [];
  @Input() grades: { id: string; name: string }[] = [];
  @Input() warehouses: { id: string; name: string }[] = [];

  @Output() filtersChange = new EventEmitter<ReportFilters>();
  @Output() onExport = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  readonly filters = signal<ReportFilters>({});
  readonly searchText = signal<string>('');

  // For ngModel binding in template (kept in sync with signal)
  filtersModel: ReportFilters = {};
  searchModel: string = '';

  get categoryOptions(): SelectOption[] {
    return [{ value: '', label: 'All Categories' }, ...this.categories.map((c) => ({ value: c.id, label: c.name }))];
  }

  get gradeOptions(): SelectOption[] {
    return [{ value: '', label: 'All Grades' }, ...this.grades.map((g) => ({ value: g.id, label: g.name }))];
  }

  get warehouseOptions(): SelectOption[] {
    return [{ value: '', label: 'All Warehouses' }, ...this.warehouses.map((w) => ({ value: w.id, label: w.name }))];
  }

  hasActiveFilters(): boolean {
    const f = this.filters();
    return !!(f.startDate || f.endDate || f.categoryId || f.gradeId || f.warehouseId);
  }

  updateFilter(key: keyof ReportFilters, value: string): void {
    this.filters.update((f) => ({
      ...f,
      [key]: value || undefined,
    }));

    this.filtersModel = this.filters();
  }

  applyFilters(): void {
    // Pull from the ngModel binding first
    this.filters.set({
      startDate: this.filtersModel.startDate || undefined,
      endDate: this.filtersModel.endDate || undefined,
      categoryId: this.filtersModel.categoryId || undefined,
      gradeId: this.filtersModel.gradeId || undefined,
      warehouseId: this.filtersModel.warehouseId || undefined,
      workerId: this.filtersModel.workerId || undefined,
    });
    this.filtersChange.emit(this.filters());
  }

  emitSearch(value: string): void {
    this.searchText.set(value || '');
    this.searchModel = this.searchText();
    this.searchChange.emit(this.searchText());
  }

  clearAll(): void {
    this.filters.set({});
    this.filtersModel = {};
    this.searchText.set('');
    this.searchModel = '';
    this.filtersChange.emit({});
    this.searchChange.emit('');
  }
}
