import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

@Component({
  selector: 'app-table-column',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content />`,
  styles: []
})
export class AppTableColumnComponent {
  @Input() key: string = '';
  @Input() label: string = '';
  @Input() sortable: boolean = false;
  @Input() width?: string;
}
