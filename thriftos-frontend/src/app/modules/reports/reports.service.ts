/**
 * Reports Service
 * Phase 7: Reports & Analytics
 * 
 * Backend APIs (AUTHORITATIVE):
 * 
 * Cost Reports:
 *   GET /reports/cost/cascade           - Cost flow through stages
 *   GET /reports/cost/cascade/export    - Export cost cascade CSV
 *   GET /reports/cost/readiness         - Cost readiness by category/grade
 *   GET /reports/cost/readiness/export  - Export cost readiness CSV
 * 
 * Grading Reports:
 *   GET /reports/grading/distribution        - Grade distribution
 *   GET /reports/grading/distribution/export - Export CSV
 *   GET /reports/grading/loss                - Grading loss report
 *   GET /reports/grading/loss/export         - Export CSV
 * 
 * Inventory Reports:
 *   GET /reports/inventory/snapshot        - Inventory snapshot
 *   GET /reports/inventory/snapshot/export - Export CSV
 *   GET /reports/inventory/aging           - Inventory aging
 *   GET /reports/inventory/aging/export    - Export CSV
 * 
 * Procurement Reports:
 *   GET /reports/procurement/vendors/summary              - Vendor summary
 *   GET /reports/procurement/vendors/summary/export       - Export CSV
 *   GET /reports/procurement/containers/:id/cost-breakdown - Container cost breakdown
 * 
 * Sorting Reports:
 *   GET /reports/sorting/category-yield        - Category yield report
 *   GET /reports/sorting/category-yield/export - Export CSV
 *   GET /reports/sorting/efficiency            - Sorting efficiency
 *   GET /reports/sorting/efficiency/export     - Export CSV
 * 
 * Waste Reports:
 *   GET /reports/waste/by-stage        - Waste by stage
 *   GET /reports/waste/by-stage/export - Export CSV
 *   GET /reports/waste/cost-impact     - Waste cost impact
 *   GET /reports/waste/cost-impact/export - Export CSV
 * 
 * Repack Reports:
 *   GET /reports/repack/efficiency        - Repack efficiency
 *   GET /reports/repack/efficiency/export - Export CSV
 *   GET /reports/repack/sku-summary       - SKU production summary
 *   GET /reports/repack/sku-summary/export - Export CSV
 * 
 * NOTE: This module is READ-ONLY. No data mutation occurs.
 * All export endpoints require REPORTS_EXPORT permission.
 * All view endpoints require REPORTS_VIEW permission.
 */

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, forkJoin, of, map } from 'rxjs';
import {
  ReportFilters,
  YieldReportResponse,
  YieldReportRow,
  WasteByStageData,
  WasteCostImpactData,
  WasteReportRow,
  InventorySnapshotResponse,
  InventoryAgingResponse,
  VendorSummaryResponse,
  VendorSummaryRow,
  ContainerCostBreakdown,
  CostCascadeData,
  CostReadinessResponse,
  GradeDistributionResponse,
  GradeLossResponse,
  SortingEfficiencyResponse,
  RepackEfficiencyResponse,
  ReportsDashboardSummary,
} from './reports.models';
import { API_ENDPOINTS } from '../../core/config/api.config';

const API_BASE = API_ENDPOINTS.reports;

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _exporting = signal(false);

  // Dashboard summary
  private readonly _dashboardSummary = signal<ReportsDashboardSummary | null>(null);

  // Yield report data
  private readonly _yieldData = signal<YieldReportRow[]>([]);

  // Waste report data
  private readonly _wasteByStage = signal<WasteReportRow[]>([]);
  private readonly _wasteCostImpact = signal<WasteReportRow[]>([]);

  // Inventory report data
  private readonly _inventorySnapshot = signal<InventorySnapshotResponse | null>(null);
  private readonly _inventoryAging = signal<InventoryAgingResponse | null>(null);

  // Procurement report data
  private readonly _vendorSummary = signal<VendorSummaryRow[]>([]);
  private readonly _vendorTotal = signal(0);

  // Cost report data
  private readonly _costCascade = signal<CostCascadeData | null>(null);
  private readonly _costReadiness = signal<CostReadinessResponse | null>(null);

  // Grading report data
  private readonly _gradeDistribution = signal<GradeDistributionResponse | null>(null);
  private readonly _gradeLoss = signal<GradeLossResponse | null>(null);

  // Sorting efficiency data
  private readonly _sortingEfficiency = signal<SortingEfficiencyResponse | null>(null);

  // Repack efficiency data
  private readonly _repackEfficiency = signal<RepackEfficiencyResponse | null>(null);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly exporting = this._exporting.asReadonly();
  readonly dashboardSummary = this._dashboardSummary.asReadonly();
  readonly yieldData = this._yieldData.asReadonly();
  readonly wasteByStage = this._wasteByStage.asReadonly();
  readonly wasteCostImpact = this._wasteCostImpact.asReadonly();
  readonly inventorySnapshot = this._inventorySnapshot.asReadonly();
  readonly inventoryAging = this._inventoryAging.asReadonly();
  readonly vendorSummary = this._vendorSummary.asReadonly();
  readonly vendorTotal = this._vendorTotal.asReadonly();
  readonly costCascade = this._costCascade.asReadonly();
  readonly costReadiness = this._costReadiness.asReadonly();
  readonly gradeDistribution = this._gradeDistribution.asReadonly();
  readonly gradeLoss = this._gradeLoss.asReadonly();
  readonly sortingEfficiency = this._sortingEfficiency.asReadonly();
  readonly repackEfficiency = this._repackEfficiency.asReadonly();

  constructor(private readonly http: HttpClient) {}

  // =============================================================
  // DASHBOARD SUMMARY (Aggregated)
  // =============================================================

  loadDashboardSummary(filters?: ReportFilters): Observable<ReportsDashboardSummary> {
    this._loading.set(true);
    this._error.set(null);

    // Fetch multiple reports in parallel and aggregate
    return forkJoin({
      yield: this.fetchYieldReport(filters).pipe(catchError(() => of({ data: [] }))),
      waste: this.fetchWasteCostImpact(filters).pipe(catchError(() => of({ data: { procurement: { wasteKg: 0, wasteCost: 0 }, sortingStage1: { wasteKg: 0, wasteCost: 0 }, gradingStage2: { wasteKg: 0, wasteCost: 0 } } }))),
      inventory: this.fetchInventorySnapshot(filters).pipe(catchError(() => of({ data: [], summary: { totalUnits: 0, totalWeightKg: 0, totalPcs: 0 } }))),
      vendors: this.fetchVendorSummary(filters).pipe(catchError(() => of({ data: [], total: 0 }))),
    }).pipe(
      map(({ yield: yieldData, waste, inventory, vendors }) => {
        // Calculate total yield percentage
        const yieldRows = yieldData.data || [];
        const totalInput = yieldRows.reduce((sum, r) => sum + (r.inputWeightKg || 0), 0);
        const totalOutput = yieldRows.reduce((sum, r) => sum + (r.outputWeightKg || 0), 0);
        const totalYieldPct = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

        // Calculate total waste
        const wasteData = waste.data as WasteCostImpactData;
        const totalWasteKg = (wasteData.procurement?.wasteKg || 0) + 
                            (wasteData.sortingStage1?.wasteKg || 0) + 
                            (wasteData.gradingStage2?.wasteKg || 0);
        const totalWasteCost = (wasteData.procurement?.wasteCost || 0) + 
                              (wasteData.sortingStage1?.wasteCost || 0) + 
                              (wasteData.gradingStage2?.wasteCost || 0);

        // Inventory summary
        const invSummary = (inventory as InventorySnapshotResponse).summary || { totalUnits: 0, totalWeightKg: 0, totalPcs: 0 };

        // Procurement totals
        const vendorRows = vendors.data || [];
        const procurementCostTotal = vendorRows.reduce((sum, v) => sum + (v.totalCost || 0), 0);
        const procurementWeightKg = vendorRows.reduce((sum, v) => sum + (v.totalWeightKg || 0), 0);
        const avgCostPerKg = procurementWeightKg > 0 ? procurementCostTotal / procurementWeightKg : 0;

        const summary: ReportsDashboardSummary = {
          totalYieldPct,
          totalWasteKg,
          totalWasteCost,
          inventoryUnits: invSummary.totalUnits,
          inventoryWeightKg: invSummary.totalWeightKg,
          procurementCostTotal,
          avgCostPerKg,
        };

        this._dashboardSummary.set(summary);
        return summary;
      }),
      tap(() => this._loading.set(false)),
      catchError((err) => this.handleError(err)),
    );
  }

  // =============================================================
  // YIELD REPORT (Category Yield from Sorting)
  // =============================================================

  loadYieldReport(filters?: ReportFilters): Observable<YieldReportRow[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.fetchYieldReport(filters).pipe(
      tap((response) => {
        this._yieldData.set(response.data || []);
        this._loading.set(false);
      }),
      map((response) => response.data || []),
      catchError((err) => this.handleError(err)),
    );
  }

  private fetchYieldReport(filters?: ReportFilters): Observable<YieldReportResponse> {
    const params = this.buildParams(filters);
    return this.http.get<YieldReportResponse>(`${API_BASE}/sorting/category-yield`, { params });
  }

  exportYieldReport(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/sorting/category-yield/export`, filters, 'category-yield.csv');
  }

  // =============================================================
  // WASTE REPORT (By Stage & Cost Impact)
  // =============================================================

  loadWasteByStage(filters?: ReportFilters): Observable<WasteReportRow[]> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<{ data: WasteByStageData }>(`${API_BASE}/waste/by-stage`, { params }).pipe(
      map((response) => {
        const data = response.data;
        const rows: WasteReportRow[] = [
          { stage: 'Procurement', wasteKg: data.procurementWasteKg || 0 },
          { stage: 'Sorting Stage 1', wasteKg: data.sortingStage1WasteKg || 0 },
          { stage: 'Grading Stage 2', wasteKg: data.gradingStage2WasteKg || 0 },
        ];
        const total = rows.reduce((sum, r) => sum + r.wasteKg, 0);
        rows.forEach((r) => (r.wastePct = total > 0 ? (r.wasteKg / total) * 100 : 0));
        return rows;
      }),
      tap((rows) => {
        this._wasteByStage.set(rows);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  loadWasteCostImpact(filters?: ReportFilters): Observable<WasteReportRow[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.fetchWasteCostImpact(filters).pipe(
      map((response) => {
        const data = response.data as WasteCostImpactData;
        const rows: WasteReportRow[] = [
          { stage: 'Procurement', wasteKg: data.procurement?.wasteKg || 0, wasteCost: data.procurement?.wasteCost || 0 },
          { stage: 'Sorting Stage 1', wasteKg: data.sortingStage1?.wasteKg || 0, wasteCost: data.sortingStage1?.wasteCost || 0 },
          { stage: 'Grading Stage 2', wasteKg: data.gradingStage2?.wasteKg || 0, wasteCost: data.gradingStage2?.wasteCost || 0 },
        ];
        const total = rows.reduce((sum, r) => sum + r.wasteKg, 0);
        rows.forEach((r) => (r.wastePct = total > 0 ? (r.wasteKg / total) * 100 : 0));
        return rows;
      }),
      tap((rows) => {
        this._wasteCostImpact.set(rows);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  private fetchWasteCostImpact(filters?: ReportFilters): Observable<{ data: WasteCostImpactData }> {
    const params = this.buildParams(filters);
    return this.http.get<{ data: WasteCostImpactData }>(`${API_BASE}/waste/cost-impact`, { params });
  }

  exportWasteByStage(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/waste/by-stage/export`, filters, 'waste-by-stage.csv');
  }

  exportWasteCostImpact(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/waste/cost-impact/export`, filters, 'waste-cost-impact.csv');
  }

  // =============================================================
  // INVENTORY REPORT (Snapshot & Aging)
  // =============================================================

  loadInventorySnapshot(filters?: ReportFilters): Observable<InventorySnapshotResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.fetchInventorySnapshot(filters).pipe(
      tap((response) => {
        this._inventorySnapshot.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  private fetchInventorySnapshot(filters?: ReportFilters): Observable<InventorySnapshotResponse> {
    const params = this.buildParams(filters);
    return this.http.get<InventorySnapshotResponse>(`${API_BASE}/inventory/snapshot`, { params });
  }

  loadInventoryAging(filters?: ReportFilters): Observable<InventoryAgingResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<InventoryAgingResponse>(`${API_BASE}/inventory/aging`, { params }).pipe(
      tap((response) => {
        this._inventoryAging.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  exportInventorySnapshot(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/inventory/snapshot/export`, filters, 'inventory-snapshot.csv');
  }

  exportInventoryAging(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/inventory/aging/export`, filters, 'inventory-aging.csv');
  }

  // =============================================================
  // PROCUREMENT REPORT (Vendor Summary & Container Cost)
  // =============================================================

  loadVendorSummary(filters?: ReportFilters): Observable<VendorSummaryRow[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.fetchVendorSummary(filters).pipe(
      tap((response) => {
        this._vendorSummary.set(response.data || []);
        this._vendorTotal.set(response.total || 0);
        this._loading.set(false);
      }),
      map((response) => response.data || []),
      catchError((err) => this.handleError(err)),
    );
  }

  private fetchVendorSummary(filters?: ReportFilters): Observable<VendorSummaryResponse> {
    const params = this.buildParams(filters);
    return this.http.get<VendorSummaryResponse>(`${API_BASE}/procurement/vendors/summary`, { params });
  }

  loadContainerCostBreakdown(containerId: string): Observable<ContainerCostBreakdown> {
    return this.http.get<ContainerCostBreakdown>(`${API_BASE}/procurement/containers/${containerId}/cost-breakdown`);
  }

  exportVendorSummary(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/procurement/vendors/summary/export`, filters, 'vendor-summary.csv');
  }

  // =============================================================
  // COST REPORTS (Cascade & Readiness)
  // =============================================================

  loadCostCascade(filters?: ReportFilters): Observable<CostCascadeData> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<{ data: CostCascadeData }>(`${API_BASE}/cost/cascade`, { params }).pipe(
      tap((response) => {
        this._costCascade.set(response.data);
        this._loading.set(false);
      }),
      map((response) => response.data),
      catchError((err) => this.handleError(err)),
    );
  }

  loadCostReadiness(filters?: ReportFilters): Observable<CostReadinessResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<CostReadinessResponse>(`${API_BASE}/cost/readiness`, { params }).pipe(
      tap((response) => {
        this._costReadiness.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  exportCostCascade(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/cost/cascade/export`, filters, 'cost-cascade.csv');
  }

  exportCostReadiness(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/cost/readiness/export`, filters, 'cost-readiness.csv');
  }

  // =============================================================
  // GRADING REPORTS (Distribution & Loss)
  // =============================================================

  loadGradeDistribution(filters?: ReportFilters): Observable<GradeDistributionResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<GradeDistributionResponse>(`${API_BASE}/grading/distribution`, { params }).pipe(
      tap((response) => {
        this._gradeDistribution.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  loadGradeLoss(filters?: ReportFilters): Observable<GradeLossResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<GradeLossResponse>(`${API_BASE}/grading/loss`, { params }).pipe(
      tap((response) => {
        this._gradeLoss.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  exportGradeDistribution(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/grading/distribution/export`, filters, 'grade-distribution.csv');
  }

  exportGradeLoss(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/grading/loss/export`, filters, 'grade-loss.csv');
  }

  // =============================================================
  // SORTING EFFICIENCY REPORT
  // =============================================================

  loadSortingEfficiency(filters?: ReportFilters): Observable<SortingEfficiencyResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<SortingEfficiencyResponse>(`${API_BASE}/sorting/efficiency`, { params }).pipe(
      tap((response) => {
        this._sortingEfficiency.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  exportSortingEfficiency(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/sorting/efficiency/export`, filters, 'sorting-efficiency.csv');
  }

  // =============================================================
  // REPACK EFFICIENCY REPORT
  // =============================================================

  loadRepackEfficiency(filters?: ReportFilters): Observable<RepackEfficiencyResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildParams(filters);
    return this.http.get<RepackEfficiencyResponse>(`${API_BASE}/repack/efficiency`, { params }).pipe(
      tap((response) => {
        this._repackEfficiency.set(response);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  exportRepackEfficiency(filters?: ReportFilters): void {
    this.triggerExport(`${API_BASE}/repack/efficiency/export`, filters, 'repack-efficiency.csv');
  }

  // =============================================================
  // HELPERS
  // =============================================================

  private buildParams(filters?: ReportFilters): HttpParams {
    let params = new HttpParams();

    if (filters) {
      if (filters.startDate) {
        params = params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params = params.set('endDate', filters.endDate);
      }
      if (filters.categoryId) {
        params = params.set('categoryId', filters.categoryId);
      }
      if (filters.gradeId) {
        params = params.set('gradeId', filters.gradeId);
      }
      if (filters.warehouseId) {
        params = params.set('warehouseId', filters.warehouseId);
      }
      if (filters.workerId) {
        params = params.set('workerId', filters.workerId);
      }
    }

    return params;
  }

  private triggerExport(url: string, filters: ReportFilters | undefined, filename: string): void {
    this._exporting.set(true);

    const params = this.buildParams(filters);
    this.http.get(url, { params, responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, filename);
        this._exporting.set(false);
      },
      error: (err) => {
        console.error('Export failed:', err);
        this._error.set('Export failed. Please try again.');
        this._exporting.set(false);
      },
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    this._loading.set(false);
    const message = error.error?.message || error.message || 'An error occurred';
    this._error.set(message);
    return throwError(() => new Error(message));
  }

  clearError(): void {
    this._error.set(null);
  }
}
