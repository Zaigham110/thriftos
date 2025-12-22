/**
 * Repack Module Models
 * Phase 5: Repack & QR Code Generation
 * 
 * Based on backend DTOs and Prisma schema.
 * Repacking operates on CLOSED Grade Outputs from Stage 2.
 */

// =============================================================
// ENUMS (from Prisma)
// =============================================================

export type RepackSessionStatus = 'OPEN' | 'CLOSED';
export type RepackStatus = 'READY' | 'SOLD' | 'RESERVED';
export type UnitType = 'KG_BALE' | 'PCS_PACK' | 'MIXED_BALE';

// =============================================================
// REPACK SESSION
// =============================================================

export interface RepackSession {
  id: string;
  tenantId: string;
  workerId: string;
  supervisorId: string;
  startTime: string;
  endTime?: string;
  status: RepackSessionStatus;
  createdAt: string;
  updatedAt: string;
  // Nested relations when included
  worker?: UserSummary;
  supervisor?: UserSummary;
  repackUnits?: RepackUnit[];
  _count?: {
    repackUnits: number;
  };
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface CreateRepackSessionRequest {
  workerId?: string;
  supervisorId?: string;
}

export interface UpdateRepackSessionRequest {
  workerId?: string;
  supervisorId?: string;
}

export interface RepackSessionListResponse {
  data: RepackSession[];
  total: number;
  page: number;
  limit: number;
}

export interface RepackSessionFilters {
  status?: RepackSessionStatus;
  page?: number;
  limit?: number;
}

// =============================================================
// REPACK UNIT
// =============================================================

export interface RepackUnit {
  id: string;
  tenantId: string;
  repackSessionId: string;
  categoryId?: string;
  gradeId?: string;
  unitCode: string;
  unitType: UnitType;
  weightKg: number | string;
  pcsCount: number;
  totalCost: number | string;
  status: RepackStatus;
  // Traceability chain
  containerId?: string;
  ragId?: string;
  sortSessionId?: string;
  gradeSessionId?: string;
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
  qrLabel?: QRLabel;
  repackSession?: {
    id: string;
    status: RepackSessionStatus;
  };
  repackItems?: RepackItem[];
  _count?: {
    repackItems: number;
  };
}

export interface CreateRepackUnitRequest {
  unitType: UnitType;
  categoryId?: string;
  gradeId?: string;
  weightKg: number;
  pcsCount?: number;
}

export interface RepackUnitListResponse {
  data: RepackUnit[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================
// REPACK ITEM (Line items within a unit)
// =============================================================

export type SourceType = 'CATEGORY_OUTPUT' | 'GRADE_OUTPUT';

export interface RepackItem {
  id: string;
  repackUnitId: string;
  sourceType: SourceType;
  sourceId: string;
  weightKg: number | string;
  pcsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRepackItemRequest {
  sourceType: SourceType;
  sourceId: string;
  weightKg: number;
  pcsCount?: number;
}

// =============================================================
// QR LABEL
// =============================================================

export interface QRLabel {
  id: string;
  repackUnitId: string;
  qrCode: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QRLabelResponse {
  qr: {
    encoded: string;
    pngDataUrl: string;
    generatedAt: string;
  };
  unit: {
    id: string;
    unitCode: string;
    unitType: UnitType;
    category: string | null;
    grade: string | null;
    weightKg: string;
    pcsCount: number;
    totalCost: string;
    createdAt: string;
  };
}

// =============================================================
// LINEAGE (Traceability display)
// =============================================================

export interface RepackLineage {
  containerId?: string;
  containerNumber?: string;
  ragId?: string;
  ragCode?: string;
  stage1SessionId?: string;
  stage2SessionId?: string;
  categoryId?: string;
  categoryName?: string;
  gradeId?: string;
  gradeName?: string;
}

// =============================================================
// TOTALS (Computed)
// =============================================================

export interface RepackTotals {
  totalInputWeight: number;
  totalRepackedWeight: number;
  totalPcsCount: number;
  remainingWeight: number;
  unitCount: number;
  // UI display aliases
  totalWeight: number;
  totalPcs: number;
  kgBales: number;
  pcsPacks: number;
  mixedBales: number;
}

// =============================================================
// GRADE (for dropdown selection)
// =============================================================

export interface Grade {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rank: number;
  isActive: boolean;
}

// =============================================================
// CATEGORY (for dropdown selection)
// =============================================================

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
}

// =============================================================
// GRADE OUTPUT (Available for Repack from Stage 2)
// =============================================================

export interface GradeOutput {
  id: string;
  tenantId: string;
  gradeId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  createdAt: string;
  // Nested relations
  grade?: {
    id: string;
    name: string;
  };
  gradeBucket?: {
    id: string;
    gradeId: string;
    outputWeightKg: number | string;
    grade?: {
      id: string;
      name: string;
    };
    gradeSession?: {
      id: string;
      status: string;
      categoryOutput?: {
        id: string;
        categoryId: string;
        containerId?: string;
        ragId?: string;
        sortSessionId?: string;
        weightKg: number | string;
        allocatedCost: number | string;
        category?: {
          id: string;
          name: string;
        };
        container?: {
          id: string;
          containerNumber: string;
        };
        rag?: {
          id: string;
          ragCode: string;
        };
        sortSession?: {
          id: string;
        };
      };
    };
  };
  // Computed fields for UI
  consumedWeightKg?: number;
  remainingWeightKg?: number;
  consumedPcs?: number;
  remainingPcs?: number;
}

export interface GradeOutputListResponse {
  data: GradeOutput[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================
// REPACK SESSION WITH LINEAGE (for proper tracking)
// =============================================================

export interface RepackSessionWithLineage extends RepackSession {
  // Lineage data derived from linked grade outputs
  sourceGradeSessionId?: string;
  sourceCategoryOutputId?: string;
  sourceContainerId?: string;
  sourceRagId?: string;
  sourceSortSessionId?: string;
  // Display data
  sourceContainerNumber?: string;
  sourceRagCode?: string;
  sourceCategoryName?: string;
}

// =============================================================
// ADD ITEM TO UNIT (Consuming Grade Output)
// =============================================================

export interface AddRepackItemRequest {
  gradeOutputId: string;
  weightKg: number;
  pcsCount: number;
}

export interface AddRepackItemResponse {
  item: RepackItem;
  unit: RepackUnit;
  itemCost: string;
}

// =============================================================
// AVAILABLE FOR REPACK SUMMARY
// =============================================================

export interface AvailableForRepackSummary {
  gradeOutputId: string;
  gradeName: string;
  categoryName: string;
  totalWeightKg: number;
  consumedWeightKg: number;
  remainingWeightKg: number;
  totalPcs: number;
  consumedPcs: number;
  remainingPcs: number;
}
