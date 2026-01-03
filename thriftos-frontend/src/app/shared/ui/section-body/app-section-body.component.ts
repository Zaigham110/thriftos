import { Component } from '@angular/core';

/**
 * ===============================
 * APP-SECTION-BODY - LOCKED LAYOUT
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Main content area of a section
 * - Uses CSS Grid ONLY (no flexbox)
 * - Contains ONLY: app-card | app-table | app-kpi-card | app-form
 * 
 * CONTRACT:
 * - Display: grid
 * - Gap: var(--space-lg)
 * - Default: single column
 * - Override with grid-cols-* classes if needed
 * 
 * USAGE:
 * ```html
 * <app-section-body>
 *   <app-card>...</app-card>
 *   <app-table>...</app-table>
 * </app-section-body>
 * 
 * <!-- Multi-column KPIs -->
 * <app-section-body class="grid-cols-4">
 *   <app-kpi-card>...</app-kpi-card>
 *   <app-kpi-card>...</app-kpi-card>
 *   <app-kpi-card>...</app-kpi-card>
 *   <app-kpi-card>...</app-kpi-card>
 * </app-section-body>
 * ```
 */
@Component({
  selector: 'app-section-body',
  standalone: true,
  template: `
    <div class="app-section-body">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-section-body.component.scss']
})
export class AppSectionBodyComponent {}
