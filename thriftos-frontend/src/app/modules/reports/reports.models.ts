/**
 * Reports Module Models
 * Phase 7: Reports & Analytics
 * 
 * READ-ONLY reporting module for analyzing operational data.
 * All data is fetched from /api/reports/* endpoints.
 * NO data mutation - purely analytical views.
 */

// =============================================================
// COMMON FILTER TYPES
// =============================================================

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  gradeId?: string;
  warehouseId?: string;
  workerId?: string;
}

export interface ExportFormat {
  type: 'csv' | 'pdf';
}

// =============================================================
// REPORT CARD / DASHBOARD SUMMARY
// =============================================================

export interface ReportCard {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon: string;
  route: string;
  color: 'primary' | 'blue' | 'green' | 'amber' | 'red';
}

// =============================================================
// YIELD REPORT (Sorting Category Yield)
// =============================================================

export interface YieldReportRow {
  categoryId: string;
  categoryName?: string;
  inputWeightKg: number;
  outputWeightKg: number;
  wasteWeightKg: number;
  yieldPct: number;
}

export interface YieldReportResponse {
  data: YieldReportRow[];
}

// =============================================================
// WASTE REPORT (By Stage & Cost Impact)
// =============================================================

export interface WasteByStageData {
  procurementWasteKg: number;
  sortingStage1WasteKg: number;
  gradingStage2WasteKg: number;
}

export interface WasteCostImpactStage {
  wasteKg: number;
  wasteCost: number;
}

export interface WasteCostImpactData {
  procurement: WasteCostImpactStage;
  sortingStage1: WasteCostImpactStage;
  gradingStage2: WasteCostImpactStage;
}

export interface WasteReportRow {
  stage: string;
  wasteKg: number;
  wasteCost?: number;
  wastePct?: number;
}

// =============================================================
// INVENTORY REPORT (Snapshot & Aging)
// =============================================================

export interface InventorySnapshotRow {
  categoryId: string;
  categoryName?: string;
  gradeId?: string;
  gradeName?: string;
  warehouseId?: string;
  warehouseName?: string;
  status: string;
  totalUnits: number;
  totalWeightKg: number;
  totalPcs: number;
  avgCost: number;
}

export interface InventorySnapshotResponse {
  data: InventorySnapshotRow[];
  summary: {
    totalUnits: number;
    totalWeightKg: number;
    totalPcs: number;
  };
}

export interface InventoryAgingRow {
  ageRangeDays: string;
  unitsCount: number;
  totalWeightKg: number;
  totalValue: number;
}

export interface InventoryAgingResponse {
  data: InventoryAgingRow[];
}

// =============================================================
// PROCUREMENT COST REPORT
// =============================================================

export interface VendorSummaryRow {
  vendorId: string;
  vendorName: string;
  vendorCode?: string;
  totalContainers: number;
  totalWeightKg: number;
  totalCost: number;
  avgCostPerKg: number;
}

export interface VendorSummaryResponse {
  data: VendorSummaryRow[];
  total: number;
}

export interface ContainerCostBreakdown {
  containerId: string;
  containerCode: string;
  vendorName: string;
  landingDate?: string;
  purchaseCost: number;
  shippingCost: number;
  dutiesCost: number;
  otherCosts: number;
  totalCost: number;
  totalWeightKg: number;
  costPerKg: number;
}

// =============================================================
// COST REPORTS (Cost Cascade & Readiness)
// =============================================================

export interface CostCascadeData {
  procurement: {
    totalCost: number;
    weightKg: number;
    costPerKg: number;
  };
  sorting: {
    totalCost: number;
    weightKg: number;
    costPerKg: number;
  };
  grading: {
    totalCost: number;
    weightKg: number;
    costPerKg: number;
  };
  repack: {
    totalCost: number;
    weightKg: number;
    costPerKg: number;
  };
  final: {
    totalCost: number;
    weightKg: number;
    costPerKg: number;
  };
}

export interface CostReadinessRow {
  categoryId: string;
  categoryName?: string;
  gradeId?: string;
  gradeName?: string;
  unitsReady: number;
  totalWeightKg: number;
  totalCost: number;
  avgCostPerKg: number;
}

export interface CostReadinessResponse {
  data: CostReadinessRow[];
}

// =============================================================
// GRADING REPORTS
// =============================================================

export interface GradeDistributionRow {
  gradeId: string;
  gradeName: string;
  unitsCount: number;
  totalWeightKg: number;
  percentOfTotal: number;
}

export interface GradeDistributionResponse {
  data: GradeDistributionRow[];
}

export interface GradeLossRow {
  gradeId: string;
  gradeName: string;
  inputWeightKg: number;
  outputWeightKg: number;
  lossWeightKg: number;
  lossPct: number;
}

export interface GradeLossResponse {
  data: GradeLossRow[];
}

// =============================================================
// SORTING EFFICIENCY REPORT
// =============================================================

export interface SortingEfficiencyRow {
  workerId: string;
  workerName?: string;
  sessionsHandled: number;
  inputWeightKg: number;
  outputWeightKg: number;
  wasteWeightKg: number;
  avgYieldPct: number;
  avgWastePct: number;
}

export interface SortingEfficiencyResponse {
  data: SortingEfficiencyRow[];
}

// =============================================================
// REPACK REPORTS
// =============================================================

export interface RepackEfficiencyRow {
  day: string;
  gradeInputWeightKg: number;
  repackOutputWeightKg: number;
  unitsProduced: number;
  avgUnitWeightKg: number;
}

export interface RepackEfficiencyResponse {
  data: RepackEfficiencyRow[];
}

// =============================================================
// DASHBOARD SUMMARY
// =============================================================

export interface ReportsDashboardSummary {
  totalYieldPct: number;
  totalWasteKg: number;
  totalWasteCost: number;
  inventoryUnits: number;
  inventoryWeightKg: number;
  procurementCostTotal: number;
  avgCostPerKg: number;
}

// =============================================================
// LINEAGE PREVIEW (Reused from Inventory)
// =============================================================

export interface LineagePreview {
  containerId?: string;
  containerCode?: string;
  ragId?: string;
  ragCode?: string;
  sortSessionId?: string;
  gradeSessionId?: string;
  repackUnitId?: string;
  repackUnitCode?: string;
}
