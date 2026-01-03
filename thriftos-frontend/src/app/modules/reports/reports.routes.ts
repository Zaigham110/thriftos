/**
 * Reports Module Routes
 * Phase 7: Reports & Analytics
 * 
 * Route Structure:
 * - /app/reports              - Reports Dashboard (summary cards)
 * - /app/reports/yield        - Yield Report (category yield from sorting)
 * - /app/reports/waste        - Waste Report (by stage & cost impact)
 * - /app/reports/inventory    - Inventory Report (snapshot & aging)
 * - /app/reports/procurement  - Procurement Cost Report (vendor summary)
 * 
 * All routes require REPORTS_VIEW permission.
 * Export actions require REPORTS_EXPORT permission.
 */

import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/reports-dashboard').then((m) => m.ReportsDashboardComponent),
    title: 'Reports - ThriftOS',
  },
  {
    path: 'procurement-summary',
    loadComponent: () =>
      import('./pages/procurement-summary-report/procurement-summary-report').then(
        (m) => m.ProcurementSummaryReportComponent,
      ),
    title: 'Procurement Summary - ThriftOS',
  },
  {
    path: 'yield',
    loadComponent: () =>
      import('./pages/yield-report/yield-report').then((m) => m.YieldReportComponent),
    title: 'Yield Report - ThriftOS',
  },
  {
    path: 'sorting-outputs',
    loadComponent: () =>
      import('./pages/sorting-outputs-report/sorting-outputs-report').then(
        (m) => m.SortingOutputsReportComponent,
      ),
    title: 'Sorting Outputs - ThriftOS',
  },
  {
    path: 'sorting-waste',
    loadComponent: () =>
      import('./pages/sorting-waste-report/sorting-waste-report').then(
        (m) => m.SortingWasteReportComponent,
      ),
    title: 'Sorting Waste - ThriftOS',
  },
  {
    path: 'waste',
    loadComponent: () =>
      import('./pages/waste-report/waste-report').then((m) => m.WasteReportComponent),
    title: 'Waste Report - ThriftOS',
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./pages/inventory-report/inventory-report').then((m) => m.InventoryReportComponent),
    title: 'Inventory Report - ThriftOS',
  },
  {
    path: 'inventory-movements',
    loadComponent: () =>
      import('./pages/inventory-movements-report/inventory-movements-report').then(
        (m) => m.InventoryMovementsReportComponent,
      ),
    title: 'Inventory Movements - ThriftOS',
  },
  {
    path: 'procurement',
    loadComponent: () =>
      import('./pages/procurement-report/procurement-report').then((m) => m.ProcurementReportComponent),
    title: 'Procurement Report - ThriftOS',
  },
  {
    path: 'repack-summary',
    loadComponent: () =>
      import('./pages/repack-summary-report/repack-summary-report').then(
        (m) => m.RepackSummaryReportComponent,
      ),
    title: 'Repack Summary - ThriftOS',
  },
  {
    path: 'final-product-cost',
    loadComponent: () =>
      import('./pages/final-product-cost-report/final-product-cost-report').then(
        (m) => m.FinalProductCostReportComponent,
      ),
    title: 'Final Product Cost - ThriftOS',
  },
];
