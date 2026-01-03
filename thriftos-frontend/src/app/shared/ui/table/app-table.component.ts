import { Component, Input } from '@angular/core';

/**
 * ===============================
 * APP-TABLE - LOCKED TABLE WRAPPER
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - ALL tables MUST use this wrapper
 * - Consistent header styling, row padding, borders
 * - Handles empty/loading/error states
 * - NO raw <table> usage allowed
 * 
 * CONTRACT:
 * - Table header: 13px, 500 weight, slate-600
 * - Table cell: 13px, 400 weight, slate-900
 * - Row height: 48px
 * - Hover state: slate-50
 * - Borders: var(--app-border-subtle)
 * 
 * USAGE:
 * ```html
 * <app-table [loading]="isLoading" [empty]="items.length === 0">
 *   <table>
 *     <thead>
 *       <tr>
 *         <th>Column 1</th>
 *         <th>Column 2</th>
 *         <th class="actions">Actions</th>
 *       </tr>
 *     </thead>
 *     <tbody>
 *       <tr *ngFor="let item of items">
 *         <td>{{ item.name }}</td>
 *         <td>{{ item.value }}</td>
 *         <td class="actions">
 *           <app-button variant="secondary">Edit</app-button>
 *         </td>
 *       </tr>
 *     </tbody>
 *   </table>
 * </app-table>
 * ```
 */
@Component({
  selector: 'app-table',
  standalone: true,
  template: `
    <div class="app-table-wrapper">
      @if (loading) {
        <div class="table-state loading">
          <span>Loading...</span>
        </div>
      } @else if (empty) {
        <div class="table-state empty">
          <span>No data available</span>
        </div>
      } @else {
        <div class="app-table">
          <ng-content />
        </div>
      }
    </div>
  `,
  styleUrls: ['./app-table.component.scss']
})
export class AppTableComponent {
  @Input() loading = false;
  @Input() empty = false;
}
