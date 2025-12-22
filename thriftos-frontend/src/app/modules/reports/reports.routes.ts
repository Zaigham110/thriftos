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
    path: 'yield',
    loadComponent: () =>
      import('./pages/yield-report/yield-report').then((m) => m.YieldReportComponent),
    title: 'Yield Report - ThriftOS',
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
    path: 'procurement',
    loadComponent: () =>
      import('./pages/procurement-report/procurement-report').then((m) => m.ProcurementReportComponent),
    title: 'Procurement Report - ThriftOS',
  },
];
