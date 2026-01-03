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
  wasteKg?: number;
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

// Required alias endpoint: /reports/inventory/stock returns the same shape as snapshot
export type InventoryStockRow = InventorySnapshotRow;
export type InventoryStockResponse = InventorySnapshotResponse;

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
// PROCUREMENT SUMMARY (REQUIRED)
// =============================================================

export interface ProcurementSummaryRow {
  purchaseOrderId: string;
  poNumber: string;
  poType: string;
  status: string;
  currency: string;
  vendorId?: string | null;
  vendorName?: string | null;
  createdAt: string;

  containers: {
    count: number;
    weightKg: number;
    cost: number;
  };

  looseBales: {
    count: number;
    weightKg: number;
    cost: number;
  };

  poTotalCost: number;
  computedProcurementCost: number;
  costDelta: number;
  matchesPoTotal: boolean;
}

export interface ProcurementSummaryResponse {
  data: ProcurementSummaryRow[];
  summary: {
    currency: string;
    totalPurchaseOrders: number;
    totalPoCost: number;
    totalContainers: number;
    totalContainerWeightKg: number;
    totalContainerCost: number;
    totalLooseBales: number;
    totalLooseBaleWeightKg: number;
    totalLooseBaleCost: number;
    totalComputedProcurementCost: number;
    avgCostPerKg: number;
  };
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
// SORTING OUTPUTS REPORT (REQUIRED)
// =============================================================

export interface SortingStage1OutputRow {
  categoryOutputId: string;
  createdAt: string | Date;
  categoryId: string;
  categoryName: string;
  weightKg: number;
  allocatedCost: number;
  sortSessionId: string;
  sortStatus: string;
  workerId: string;
  ragId: string;
  ragCode: string;
  containerId?: string | null;
  containerNumber?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
}

export interface SortingStage2OutputRow {
  gradingOutputId: string;
  createdAt: string | Date;
  gradeId: string;
  gradeName: string;
  categoryId: string;
  categoryName: string;
  weightKg: number;
  allocatedCost: number;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  measurementType: string;
  status: string;
  gradeSessionId: string;
  gradeStatus: string;
  workerId: string;
  categoryOutputId: string;
  sortSessionId: string;
  ragId: string;
  ragCode: string;
  containerId?: string | null;
  containerNumber?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
}

export interface SortingOutputsResponse {
  stage1: {
    data: SortingStage1OutputRow[];
    summary: {
      totalOutputs: number;
      totalWeightKg: number;
      totalAllocatedCost: number;
    };
  };
  stage2: {
    data: SortingStage2OutputRow[];
    summary: {
      totalOutputs: number;
      totalWeightKg: number;
      totalAllocatedCost: number;
    };
  };
}

// =============================================================
// SORTING WASTE REPORT (REQUIRED)
// =============================================================

export interface SortingWasteLegacyRow {
  sortingWasteId: string;
  createdAt: string | Date;
  sortSessionId: string;
  workerId: string;
  ragId: string;
  ragCode: string;
  containerId?: string | null;
  containerNumber?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  wasteWeightKg: number;
}

export interface SortingWasteCategorizedRow {
  wasteLineItemId: string;
  createdAt: string | Date;
  stage: 'STAGE_1' | 'STAGE_2';
  amount: number;
  unitType: 'KG' | 'PCS';
  estimatedValue: number;
  wasteCategoryId: string;
  wasteCategoryName: string;
  sortSessionId?: string | null;
  gradeSessionId?: string | null;
  workerId?: string | null;
  ragId?: string | null;
  ragCode?: string | null;
  containerId?: string | null;
  containerNumber?: string | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
}

export interface SortingWasteByCategoryRow {
  stage: 'STAGE_1' | 'STAGE_2';
  wasteCategoryId: string;
  wasteCategoryName: string;
  unitType: 'KG' | 'PCS';
  totalAmount: number;
  totalEstimatedValue: number;
  totalRecords: number;
}

export interface SortingWasteResponse {
  data: SortingWasteLegacyRow[];
  summary: {
    totalWasteKg: number;
    totalRecords: number;
  };
  categorized: {
    data: SortingWasteCategorizedRow[];
    byCategory: SortingWasteByCategoryRow[];
    summary: {
      totalKg: number;
      totalPcs: number;
      totalEstimatedValue: number;
      totalRecords: number;
    };
  };
  combinedSummary: {
    totalWasteKg: number;
    totalWastePcs: number;
    totalEstimatedValue: number;
    legacyRecords: number;
    categorizedRecords: number;
  };
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

export interface RepackSummaryRow {
  status: string;
  units: number;
  totalWeightKg: number;
  totalPcs: number;
  totalCost: number;
}

export interface RepackSummaryResponse {
  data: RepackSummaryRow[];
  summary: {
    totalUnits: number;
    totalWeightKg: number;
    totalPcs: number;
    totalCost: number;
  };
}

// =============================================================
// INVENTORY MOVEMENTS (REQUIRED)
// =============================================================

export interface InventoryMovementRow {
  movementId: string;
  createdAt: string | Date;
  movementType: string;
  quantityKg: number;
  quantityPcs: number;
  referenceId?: string | null;
  inventoryItemId: string;
  inventoryStatus: string;
  avgCost: number;
  warehouseId?: string | null;
  warehouseName?: string | null;
  categoryId: string;
  categoryName: string;
  gradeId: string;
  gradeName: string;
  repackUnitId: string;
  unitCode: string;
  unitType: string;
}

export interface InventoryMovementsResponse {
  data: InventoryMovementRow[];
  summary: {
    totalMovements: number;
    totalKg: number;
    totalPcs: number;
  };
}

// =============================================================
// FINAL PRODUCT COST REPORT (REQUIRED)
// =============================================================

export interface FinalProductCostRow {
  repackUnitId: string;
  productCode: string;
  unitType: string;
  categoryId?: string | null;
  category?: string | null;
  gradeId?: string | null;
  grade?: string | null;
  totalWeightKg: number;
  totalQty: number;
  totalCost: number;
  repackUnitTotalCost: number;
  costPerKg: number;
  costPerUnit: number;
  sourceContainers: number;
  sourceBales: number;
  allocationsCount: number;
  dateSealed: string;
}

export interface FinalProductCostResponse {
  data: FinalProductCostRow[];
  summary: {
    totalUnits: number;
    totalWeightKg: number;
    totalCost: number;
  };
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
