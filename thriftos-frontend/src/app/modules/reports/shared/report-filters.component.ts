/**
 * Modern Enterprise Report Filter Toolbar
 * World-Class UI/UX — Inspired by Stripe, Datadog & Linear
 * 
 * High-density horizontal command toolbar with segmented date pills,
 * domain filter popups with active indicators, instant search, and export actions.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportFilters } from '../reports.models';
import { 
  LucideAngularModule, 
  Filter, 
  Search, 
  Calendar, 
  Download, 
  X, 
  RotateCcw, 
  Layers, 
  Tag, 
  Warehouse,
  ChevronDown,
  SlidersHorizontal,
  Check
} from 'lucide-angular';

@Component({
  selector: 'app-report-filters',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    LucideAngularModule,
  ],
  template: `
    <div class="ux-filter-toolbar">
      <!-- 1. Quick Search Box -->
      @if (showSearch) {
        <div class="ux-search-box">
          <lucide-icon [img]="icons.Search" [size]="14" class="search-icon"></lucide-icon>
          <input
            type="text"
            class="ux-search-input"
            placeholder="Search records, codes, PO #... (⌘K)"
            [(ngModel)]="searchModel"
            (ngModelChange)="emitSearch($event)"
          />
          @if (searchModel) {
            <button type="button" class="btn-clear-search" (click)="emitSearch('')" title="Clear search">
              <lucide-icon [img]="icons.X" [size]="12"></lucide-icon>
            </button>
          }
        </div>
      }

      <!-- 2. Segmented Date Preset Pills -->
      <div class="ux-segmented-dates">
        <button type="button" class="ux-seg-btn" [class.active]="selectedDatePreset === 'ALL'" (click)="onDatePresetChange('ALL')">All</button>
        <button type="button" class="ux-seg-btn" [class.active]="selectedDatePreset === '7D'" (click)="onDatePresetChange('7D')">7D</button>
        <button type="button" class="ux-seg-btn" [class.active]="selectedDatePreset === '30D'" (click)="onDatePresetChange('30D')">30D</button>
        <button type="button" class="ux-seg-btn" [class.active]="selectedDatePreset === '90D'" (click)="onDatePresetChange('90D')">90D</button>
        <button type="button" class="ux-seg-btn" [class.active]="selectedDatePreset === 'YTD'" (click)="onDatePresetChange('YTD')">YTD</button>
      </div>

      <!-- 3. Category Domain Select Pill -->
      @if (showCategory) {
        <div class="ux-select-pill" [class.is-active]="!!filtersModel.categoryId">
          <lucide-icon [img]="icons.Layers" [size]="13" class="pill-icon"></lucide-icon>
          <select 
            class="pill-native-select" 
            [(ngModel)]="filtersModel.categoryId" 
            (ngModelChange)="updateFilter('categoryId', $event)"
          >
            <option value="">Category: All</option>
            @for (c of categories; track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
          <lucide-icon [img]="icons.ChevronDown" [size]="12" class="pill-arrow"></lucide-icon>
        </div>
      }

      <!-- 4. Quality Grade Select Pill -->
      @if (showGrade) {
        <div class="ux-select-pill" [class.is-active]="!!filtersModel.gradeId">
          <lucide-icon [img]="icons.Tag" [size]="13" class="pill-icon"></lucide-icon>
          <select 
            class="pill-native-select" 
            [(ngModel)]="filtersModel.gradeId" 
            (ngModelChange)="updateFilter('gradeId', $event)"
          >
            <option value="">Grade: All</option>
            @for (g of grades; track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
          <lucide-icon [img]="icons.ChevronDown" [size]="12" class="pill-arrow"></lucide-icon>
        </div>
      }

      <!-- 5. Warehouse Facility Select Pill -->
      @if (showWarehouse) {
        <div class="ux-select-pill" [class.is-active]="!!filtersModel.warehouseId">
          <lucide-icon [img]="icons.Warehouse" [size]="13" class="pill-icon"></lucide-icon>
          <select 
            class="pill-native-select" 
            [(ngModel)]="filtersModel.warehouseId" 
            (ngModelChange)="updateFilter('warehouseId', $event)"
          >
            <option value="">Warehouse: All</option>
            @for (w of warehouses; track w.id) {
              <option [value]="w.id">{{ w.name }}</option>
            }
          </select>
          <lucide-icon [img]="icons.ChevronDown" [size]="12" class="pill-arrow"></lucide-icon>
        </div>
      }

      <!-- 6. Reset Filters Icon Button -->
      @if (activeFilterCount() > 0) {
        <button type="button" class="btn-reset-ux" (click)="clearAll()" title="Reset all filters">
          <lucide-icon [img]="icons.RotateCcw" [size]="13"></lucide-icon>
          <span class="reset-badge">{{ activeFilterCount() }}</span>
        </button>
      }

      <!-- 7. Primary Export CSV Action -->
      @if (showExport) {
        <button 
          type="button" 
          class="btn-export-ux" 
          [disabled]="exporting" 
          (click)="onExport.emit()"
          title="Export CSV"
        >
          <lucide-icon [img]="icons.Download" [size]="13"></lucide-icon>
          <span>{{ exporting ? 'Exporting...' : 'Export' }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .ux-filter-toolbar {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;

      @media (min-width: 1024px) {
        flex-wrap: nowrap;
      }
    }

    /* Search Box */
    .ux-search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 200px;
      flex-shrink: 0;

      .search-icon {
        position: absolute;
        left: 0.65rem;
        color: $gray-400;
        pointer-events: none;
      }

      .ux-search-input {
        width: 100%;
        height: 2rem;
        padding-left: 2rem;
        padding-right: 1.5rem;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid $gray-200;
        border-radius: 0.375rem;
        background: #ffffff;
        color: $gray-900;
        transition: all 0.15s ease;

        &:focus {
          outline: none;
          border-color: $primary;
          box-shadow: 0 0 0 2.5px rgba(113, 75, 103, 0.12);
        }

        &::placeholder {
          color: $gray-400;
        }
      }

      .btn-clear-search {
        position: absolute;
        right: 0.4rem;
        border: none;
        background: transparent;
        color: $gray-400;
        cursor: pointer;
        display: flex;
        align-items: center;

        &:hover {
          color: $gray-800;
        }
      }
    }

    /* Segmented Date Pills */
    .ux-segmented-dates {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      background: $gray-100;
      padding: 0.125rem;
      border-radius: 0.375rem;
      flex-shrink: 0;
    }

    .ux-seg-btn {
      border: none;
      background: transparent;
      padding: 0.2rem 0.55rem;
      font-size: 0.725rem;
      font-weight: 600;
      color: $gray-600;
      border-radius: 0.25rem;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #ffffff;
        color: $primary;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        font-weight: 700;
      }

      &:hover:not(.active) {
        color: $gray-900;
      }
    }

    /* Select Pill */
    .ux-select-pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 2rem;
      padding: 0 0.5rem 0 0.6rem;
      background: #ffffff;
      border: 1px solid $gray-200;
      border-radius: 0.375rem;
      transition: all 0.15s ease;
      flex-shrink: 0;

      &:hover {
        border-color: $gray-300;
        background: $gray-50;
      }

      &.is-active {
        background: $primary-soft;
        border-color: rgba(113, 75, 103, 0.3);

        .pill-icon, .pill-arrow {
          color: $primary;
        }

        .pill-native-select {
          color: $primary;
          font-weight: 700;
        }
      }

      .pill-icon {
        color: $gray-400;
        margin-right: 0.3rem;
        pointer-events: none;
      }

      .pill-arrow {
        color: $gray-400;
        margin-left: 0.2rem;
        pointer-events: none;
      }

      .pill-native-select {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        border: none;
        background: transparent;
        font-size: 0.75rem;
        font-weight: 600;
        color: $gray-700;
        cursor: pointer;
        padding-right: 0.75rem;

        &:focus {
          outline: none;
        }
      }
    }

    /* Reset Button */
    .btn-reset-ux {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      height: 2rem;
      padding: 0 0.55rem;
      font-size: 0.725rem;
      font-weight: 600;
      color: $gray-600;
      border: 1px dashed $gray-300;
      border-radius: 0.375rem;
      background: #ffffff;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;

      &:hover {
        color: hsl(0 72% 40%);
        border-color: hsl(0 72% 80%);
        background: hsl(0 84% 97%);
      }

      .reset-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: $primary;
        color: #ffffff;
        font-size: 0.65rem;
        font-weight: 700;
      }
    }

    /* Export CTA */
    .btn-export-ux {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      height: 2rem;
      padding: 0 0.7rem;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid $primary;
      border-radius: 0.375rem;
      background: $primary;
      color: #ffffff;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(113, 75, 103, 0.15);

      &:hover:not(:disabled) {
        opacity: 0.92;
        box-shadow: 0 2px 4px rgba(113, 75, 103, 0.25);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `],
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

  readonly icons = {
    Filter,
    Search,
    Calendar,
    Download,
    X,
    RotateCcw,
    Layers,
    Tag,
    Warehouse,
    ChevronDown,
    SlidersHorizontal,
    Check,
  };

  readonly filters = signal<ReportFilters>({});
  readonly searchText = signal<string>('');

  filtersModel: ReportFilters = {};
  searchModel: string = '';
  selectedDatePreset = 'ALL';

  readonly activeFilterCount = computed(() => {
    let count = 0;
    const f = this.filters();
    if (f.startDate) count++;
    if (f.endDate) count++;
    if (f.categoryId) count++;
    if (f.gradeId) count++;
    if (f.warehouseId) count++;
    return count;
  });

  onDatePresetChange(preset: string): void {
    this.selectedDatePreset = preset;
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === 'ALL') {
      this.filtersModel.startDate = undefined;
      this.filtersModel.endDate = undefined;
    } else if (preset === '7D') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      this.filtersModel.startDate = formatDateStr(d);
      this.filtersModel.endDate = formatDateStr(today);
    } else if (preset === '30D') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      this.filtersModel.startDate = formatDateStr(d);
      this.filtersModel.endDate = formatDateStr(today);
    } else if (preset === '90D') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      this.filtersModel.startDate = formatDateStr(d);
      this.filtersModel.endDate = formatDateStr(today);
    } else if (preset === 'YTD') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      this.filtersModel.startDate = formatDateStr(firstDay);
      this.filtersModel.endDate = formatDateStr(today);
    }

    this.applyFilters();
  }

  updateFilter(key: keyof ReportFilters, value: string): void {
    this.filters.update((f) => ({
      ...f,
      [key]: value || undefined,
    }));
    this.filtersModel = { ...this.filters() };
    this.applyFilters();
  }

  applyFilters(): void {
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
    this.selectedDatePreset = 'ALL';
    this.filtersChange.emit({});
    this.searchChange.emit('');
  }
}
