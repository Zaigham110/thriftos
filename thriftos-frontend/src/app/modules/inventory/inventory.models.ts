/**
 * Inventory Module Models
 * Phase 6: Inventory Management
 * 
 * Based on backend DTOs and Prisma schema.
 * Inventory is created from SEALED Repack Units only.
 * All records are append-only/ledger-based.
 */

// =============================================================
// ENUMS (from Prisma)
// =============================================================

export type InventoryStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type MovementType = 'INTAKE' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE' | 'SALE';

// =============================================================
// WAREHOUSE
// =============================================================

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// INVENTORY ITEM
// =============================================================

export interface InventoryItem {
  id: string;
  tenantId: string;
  repackUnitId: string;
  categoryId: string;
  gradeId: string;
  weightKg: number | string;
  pcsCount: number;
  avgCost: number | string;
  warehouseId: string;
  status: InventoryStatus;
  // Traceability chain (denormalized)
  containerId?: string;
  ragId?: string;
  createdAt: string;
  updatedAt: string;
  // Nested relations when included
  category?: {
    id: string;
    name: string;
  };
  grade?: {
    id: string;
    name: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code?: string;
  };
  repackUnit?: {
    id: string;
    unitCode: string;
    unitType: string;
    weightKg?: number | string;
    pcsCount?: number;
    totalCost?: number | string;
    // Extended traceability from repack unit
    containerId?: string;
    ragId?: string;
    sortSessionId?: string;
    gradeSessionId?: string;
  };
  stockMovements?: StockMovement[];
  _count?: {
    stockMovements: number;
  };
}

export interface InventoryItemListResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface InventoryItemFilters {
  categoryId?: string;
  gradeId?: string;
  warehouseId?: string;
  status?: InventoryStatus;
  page?: number;
  limit?: number;
}

// =============================================================
// STOCK MOVEMENT (LEDGER)
// =============================================================

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  movementType: MovementType;
  quantityKg: number | string;
  quantityPcs: number;
  referenceId?: string;
  metadataJson?: Record<string, unknown>;
  createdAt: string;
  // Nested relations when included
  inventoryItem?: {
    id: string;
    repackUnit?: {
      id: string;
      unitCode: string;
    };
    category?: {
      id: string;
      name: string;
    };
    grade?: {
      id: string;
      name: string;
    };
    warehouse?: {
      id: string;
      name: string;
      code?: string;
    };
    status: InventoryStatus;
  };
}

export interface StockMovementListResponse {
  data: StockMovement[];
  total: number;
  page: number;
  limit: number;
}

export interface StockMovementFilters {
  inventoryItemId?: string;
  movementType?: MovementType;
  page?: number;
  limit?: number;
}

// =============================================================
// LINEAGE (TRACEABILITY)
// =============================================================

/**
 * Full source lineage from Container → Inventory Item
 * MANDATORY for every inventory detail view
 */
export interface InventoryLineage {
  containerId?: string;
  containerCode?: string;
  ragId?: string;
  ragCode?: string;
  sortSessionId?: string;
  sortSessionCode?: string;
  gradeSessionId?: string;
  gradeSessionCode?: string;
  repackUnitId: string;
  repackUnitCode: string;
}

// =============================================================
// DASHBOARD STATS
// =============================================================

export interface InventoryStats {
  totalItems: number;
  totalWeightKg: number;
  totalPcsCount: number;
  byCategory: CategoryStat[];
  byWarehouse: WarehouseStat[];
  byStatus: StatusStat[];
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  count: number;
  weightKg: number;
}

export interface WarehouseStat {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  count: number;
  weightKg: number;
}

export interface StatusStat {
  status: InventoryStatus;
  count: number;
  weightKg: number;
}

// =============================================================
// ADJUSTMENT DTO (for future phase)
// =============================================================

export interface AdjustInventoryRequest {
  quantityKgDelta?: number;
  quantityPcsDelta?: number;
  reason: string;
}
