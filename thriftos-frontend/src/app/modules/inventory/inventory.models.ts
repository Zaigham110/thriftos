/**
 * Sellable stock: bales made here (PROCESSED) and stock bought ready to sell (PURCHASED),
 * counted in kg, bales or pieces. Money and quantities arrive as decimal strings.
 */

export type StockSource = 'PROCESSED' | 'PURCHASED';
export type StockUnit = 'KG' | 'BALE' | 'PIECE';

export interface InventoryItem {
  id: string;
  source: StockSource;
  name?: string | null;
  unit: StockUnit;
  quantity: string;
  usedQuantity: string;
  remainingQuantity?: string;
  totalCost: string;
  unitCost: string;
  salePrice?: string | null;
  priceTier?: string | null;
  parentItemId?: string | null;
  unitCode?: string;
  repackUnitId?: string | null;
  category?: { id: string; name: string } | null;
  categoryName?: string | null;
  grade?: { id: string; name: string } | null;
  gradeName?: string | null;
  vendor?: { id: string; name: string } | null;
  categoryId?: string | null;
  gradeId?: string | null;
  measurementType: 'WEIGHT' | 'QUANTITY';
  weightKg: number;
  pcsCount: number;
  avgCost?: number;
  warehouseId?: string | null;
  warehouseName?: string | null;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  createdAt: string;
  updatedAt: string;

  // Relations
  warehouse?: { id: string; name: string; code: string } | null;
  repackUnit?: {
    id: string;
    unitCode: string;
    status: string;
    qrLabel?: { qrCode: string };
  };
}

export interface ReceiveReadyStockRequest {
  name?: string;
  categoryId?: string;
  gradeId?: string;
  vendorId?: string;
  unit: StockUnit;
  quantity: number;
  totalCost: number;
  weightKg?: number;
  salePrice?: number;
}

export interface OpenBaleRequest {
  bales?: number;
  tiers: { price: number; pieces: number; label?: string }[];
}

export interface InventorySummary {
  totalItems: number;
  totalWeight: number;
  totalPcs: number;
  warehouseCount: number;
  warehouses: Array<{ id: string; name: string; code: string }>;
}

export interface TraceabilityChain {
  inventoryItem: {
    id: string;
    createdAt: string;
  };
  repackUnit: {
    id: string;
    unitCode: string;
    status: string;
    createdAt: string;
  };
  sourceAllocations: TraceabilityAllocation[];
}

export interface TraceabilityAllocation {
  allocationId: string;
  amountUsed: number;
  measurementType: string;
  gradingOutput: {
    id: string;
    weightKg: number;
    count: number;
    grade: { id: string; name: string };
    gradeSession: {
      id: string;
      startTime: string;
      endTime: string;
    };
    categoryOutput: {
      id: string;
      weightKg: number;
      category: { id: string; name: string };
      sortSession: {
        id: string;
        sessionCode: string;
        startTime: string;
        endTime: string;
        rag: {
          id: string;
          ragCode: string;
          ragType: string;
          initialWeightKg: number;
          container: {
            id: string;
            containerNumber: string;
            purchaseOrder: {
              id: string;
              poNumber: string;
              vendor: {
                id: string;
                name: string;
                code: string;
              };
            };
          } | null;
        } | null;
      };
    };
  };
}

export type MovementType = 'INTAKE' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE' | 'SALE';

export interface StockMovement {
  id: string;
  movementType: MovementType;
  quantityKg: number | string;
  quantityPcs?: number | null;
  referenceId?: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface InventoryLineage {
  containerId?: string | null;
  containerCode?: string | null;
  ragId?: string | null;
  ragCode?: string | null;
  sortSessionId?: string | null;
  sortSessionCode?: string | null;
  gradeSessionId?: string | null;
  gradeSessionCode?: string | null;
  repackUnitCode: string;
}
