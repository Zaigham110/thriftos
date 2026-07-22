import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  TemplateRef,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AppButtonComponent } from '../button/app-button.component';
import { AppEmptyStateComponent } from '../app-empty-state/app-empty-state.component';
import { AppFormFieldComponent } from '../form-field/app-form-field.component';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { AppInputComponent } from '../app-input/app-input.component';
import { AppSelectComponent, type SelectOption } from '../app-select/app-select.component';
import { AppTableComponent } from '../table/app-table.component';

export type DataTableAlign = 'left' | 'center' | 'right';
export type DataTableSortDir = 'asc' | 'desc';
export type DataTableFilterType = 'text' | 'select' | 'number';

export interface DataTableColumn {
  key: string;
  label: string;
  /** Optional accessor for nested/derived values (used for search/sort/filter). */
  getValue?: (row: unknown) => unknown;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: DataTableFilterType;
  filterOptions?: SelectOption[];
  align?: DataTableAlign;
  width?: string;
}

export interface DataTableState {
  pageIndex: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: DataTableSortDir;
  search: string;
  filters: Record<string, string>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppEmptyStateComponent,
    AppFormFieldComponent,
    AppIconComponent,
    AppInputComponent,
    AppSelectComponent,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDataTableComponent<T = unknown> {
  // Presentation
  readonly title = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  readonly stickyHeader = input<boolean>(true);

  // Data
  readonly columns = input<DataTableColumn[]>([]);
  readonly data = input<T[]>([]);
  readonly loading = input<boolean>(false);

  // Behavior
  readonly enableSearch = input<boolean>(true);
  /** Optional external search term (e.g., from a page-level filter bar). */
  readonly externalSearch = input<string | null>(null);
  readonly enableColumnFilters = input<boolean>(true);
  /** If true, pagination is driven by parent; component still renders controls and emits state changes. */
  readonly serverSide = input<boolean>(true);
  readonly totalCount = input<number | null>(null);
  /** Optional sync from parent (useful for server-driven pagination state). */
  readonly externalPageIndex = input<number | null>(null);
  readonly externalPageSize = input<number | null>(null);
  readonly initialPageSize = input<number>(20);
  readonly pageSizeOptions = input<number[]>([10, 20, 50, 100]);

  // Events
  readonly rowClick = output<T>();
  readonly stateChange = output<DataTableState>();

  // Templates
  @ContentChild('cellTemplate') cellTemplate?: TemplateRef<{ $implicit: T; column: DataTableColumn }>;
  @ContentChild('rowActions') rowActionsTemplate?: TemplateRef<{ $implicit: T }>; // optional

  // Controls
  readonly searchControl = new FormControl<string>('');
  readonly pageSizeControl = new FormControl<number>(this.initialPageSize());

  private readonly searchText = signal<string>('');
  private readonly pageSize = signal<number>(this.initialPageSize());

  private readonly sortKey = signal<string | null>(null);
  private readonly sortDir = signal<DataTableSortDir>('asc');
  readonly pageIndex = signal<number>(1);
  private readonly columnFilterValues = signal<Record<string, string>>({});

  readonly hasAnyFilters = computed(() => {
    const search = (this.searchText() ?? '').trim();
    const filters = this.columnFilterValues();
    return Boolean(search) || Object.values(filters).some((v) => String(v ?? '').trim().length > 0);
  });

  readonly filterableColumns = computed(() => this.columns().filter((c) => Boolean(c.filterable)));

  readonly totalPages = computed(() => {
    const pageSize = this.pageSize();
    const total = this.serverSide()
      ? (this.totalCount() ?? 0)
      : this.filteredData().length;

    if (!pageSize || pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  });

  readonly pageSizeSelectOptions = computed<SelectOption[]>(() =>
    this.pageSizeOptions().map((n) => ({ value: n, label: String(n) }))
  );

  readonly filteredData = computed<T[]>(() => {
    const raw = this.data();
    const search = (this.searchText() ?? '').trim().toLowerCase();
    const filters = this.columnFilterValues();
    const cols = this.columns();

    let rows = raw;

    // Global search (applies locally even for serverSide tables; filters current page).
    if (search) {
      rows = rows.filter((row) => {
        const haystack = cols
          .map((c) => this.getCellValue(row, c))
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v).toLowerCase())
          .join(' ');
        return haystack.includes(search);
      });
    }

    // Column filters
    for (const col of cols) {
      if (!col.filterable) continue;
      const value = String(filters[col.key] ?? '').trim();
      if (!value) continue;

      const filterType: DataTableFilterType = col.filterType ?? (col.filterOptions?.length ? 'select' : 'text');
      if (filterType === 'select') {
        rows = rows.filter((row) => String(this.getCellValue(row, col) ?? '') === value);
      } else {
        const needle = value.toLowerCase();
        rows = rows.filter((row) => String(this.getCellValue(row, col) ?? '').toLowerCase().includes(needle));
      }
    }

    // Sorting (local)
    const sortKey = this.sortKey();
    const sortDir = this.sortDir();
    if (sortKey) {
      const sortCol = cols.find((c) => c.key === sortKey);
      const dirFactor = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = this.getCellValue(a, sortCol ?? { key: sortKey, label: sortKey });
        const bv = this.getCellValue(b, sortCol ?? { key: sortKey, label: sortKey });
        if (av === bv) return 0;
        if (av === null || av === undefined) return -1 * dirFactor;
        if (bv === null || bv === undefined) return 1 * dirFactor;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dirFactor;
      });
    }

    return rows;
  });

  readonly visibleRows = computed<T[]>(() => {
    const rows = this.filteredData();
    const pageSize = this.pageSize();

    if (this.serverSide()) {
      // Parent paginates; we only filter/sort within provided page.
      return rows;
    }

    const pageIndex = this.pageIndex();
    const start = (pageIndex - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  });

  constructor() {
    // Sync initial page size
    effect(() => {
      const size = this.initialPageSize();
      this.pageSize.set(size);
      this.pageSizeControl.setValue(size, { emitEvent: false });
    });

    // Sync external search term from parent
    effect(() => {
      const next = this.externalSearch();
      if (next === null || next === undefined) return;
      if (next === this.searchText()) return;
      this.searchText.set(next);
      this.searchControl.setValue(next, { emitEvent: false });
      this.pageIndex.set(1);
    });

    // Sync external pagination (server mode)
    effect(() => {
      const p = this.externalPageIndex();
      if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
        this.pageIndex.set(p);
      }
    });

    effect(() => {
      const ps = this.externalPageSize();
      if (typeof ps === 'number' && Number.isFinite(ps) && ps > 0) {
        this.pageSize.set(ps);
        this.pageSizeControl.setValue(ps, { emitEvent: false });
      }
    });

    // Emit state changes
    this.searchControl.valueChanges.subscribe((v) => {
      this.searchText.set(String(v ?? ''));
      this.pageIndex.set(1);
      this.emitState();
    });
    this.pageSizeControl.valueChanges.subscribe((v) => {
      const next = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : this.initialPageSize();
      this.pageSize.set(next);
      this.pageIndex.set(1);
      this.emitState();
    });
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  onHeaderClick(column: DataTableColumn): void {
    if (!column.sortable) return;
    const currentKey = this.sortKey();

    if (currentKey !== column.key) {
      this.sortKey.set(column.key);
      this.sortDir.set('asc');
    } else {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    }
    this.emitState();
  }

  setColumnFilter(key: string, value: string | number | null | undefined): void {
    const next = { ...this.columnFilterValues() };
    next[key] = String(value ?? '');
    this.columnFilterValues.set(next);
    this.pageIndex.set(1);
    this.emitState();
  }

  clearFilters(): void {
    this.searchText.set('');
    this.searchControl.setValue('', { emitEvent: false });
    this.columnFilterValues.set({});
    this.pageIndex.set(1);
    this.emitState();
  }

  prevPage(): void {
    const next = Math.max(1, this.pageIndex() - 1);
    if (next === this.pageIndex()) return;
    this.pageIndex.set(next);
    this.emitState();
  }

  nextPage(): void {
    const next = Math.min(this.totalPages(), this.pageIndex() + 1);
    if (next === this.pageIndex()) return;
    this.pageIndex.set(next);
    this.emitState();
  }

  private emitState(): void {
    const state: DataTableState = {
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
      sortKey: this.sortKey(),
      sortDir: this.sortDir(),
      search: (this.searchText() ?? '').trim(),
      filters: this.columnFilterValues(),
    };
    this.stateChange.emit(state);
  }

  getCellValue(row: T, column: DataTableColumn): unknown {
    if (column.getValue) {
      return column.getValue(row);
    }
    return (row as Record<string, unknown>)[column.key];
  }

  getAlignClass(column: DataTableColumn): string {
    if (column.align === 'right') return 'text-right';
    if (column.align === 'center') return 'text-center';
    return 'text-left';
  }

  getColumnWidthAttr(column: DataTableColumn): string | null {
    const width = column.width;
    if (!width) return null;
    const trimmed = width.trim();
    if (!trimmed) return null;

    if (trimmed.endsWith('%')) return trimmed;
    const pxMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)px$/i);
    if (pxMatch?.[1]) return pxMatch[1];
    const numberMatch = trimmed.match(/^\d+$/);
    if (numberMatch) return trimmed;
    return null;
  }

  isSorted(column: DataTableColumn): boolean {
    return this.sortKey() === column.key;
  }

  sortIconName(column: DataTableColumn): string {
    if (!this.isSorted(column)) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  filterControlFor(column: DataTableColumn): FormControl<string> {
    // Lightweight per-column filter control; mirrored into signal map.
    const key = column.key;
    const current = this.columnFilterValues()[key] ?? '';
    const ctrl = new FormControl<string>(current, { nonNullable: true });
    ctrl.valueChanges.subscribe((v) => this.setColumnFilter(key, v));
    return ctrl;
  }
}

// Legacy export name compatibility (deprecated).
export { AppDataTableComponent as DataTableComponent };
export type { DataTableColumn as TableColumn };
