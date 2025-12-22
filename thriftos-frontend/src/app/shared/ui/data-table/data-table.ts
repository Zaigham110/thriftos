import { ChangeDetectionStrategy, Component, input, output, TemplateRef, ContentChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

@Component({
  selector: 'ui-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T = unknown> {
  readonly columns = input<TableColumn[]>([]);
  readonly data = input<T[]>([]);
  readonly loading = input<boolean>(false);
  readonly striped = input<boolean>(true);
  readonly hoverable = input<boolean>(true);
  readonly stickyHeader = input<boolean>(true);

  readonly rowClick = output<T>();

  @ContentChild('cellTemplate') cellTemplate?: TemplateRef<{ $implicit: T; column: TableColumn }>;

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  getCellValue(row: T, column: TableColumn): unknown {
    return (row as Record<string, unknown>)[column.key];
  }

  getAlignClass(column: TableColumn): string {
    if (column.align === 'right') return 'text-right';
    if (column.align === 'center') return 'text-center';
    return 'text-left';
  }
}
