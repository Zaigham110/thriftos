import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-table, ui-table',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table w-full caption-bottom text-sm' },
})
export class TableComponent {}

@Component({
  selector: 'app-table-header, ui-table-header',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-header-group' },
})
export class TableHeaderComponent {}

@Component({
  selector: 'app-table-body, ui-table-body',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-row-group' },
})
export class TableBodyComponent {}

@Component({
  selector: 'app-table-row, ui-table-row',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-row border-b transition-colors' },
})
export class TableRowComponent {}

@Component({
  selector: 'app-table-head, ui-table-head',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-cell h-12 px-4 text-left align-middle font-medium text-muted-foreground' },
})
export class TableHeadComponent {}

@Component({
  selector: 'app-table-cell, ui-table-cell',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-cell p-4 align-middle' },
})
export class TableCellComponent {}
