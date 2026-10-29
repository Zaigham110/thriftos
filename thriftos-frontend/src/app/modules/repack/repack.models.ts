/**
 * REPACK MODELS — CLEAN REBUILD
 * =============================
 * Simplified types for manual-only allocation
 */

// ============================================
// STATUS ENUMS
// ============================================

export type RepackStatus = 'DRAFT' | 'READY' | 'SEALED' | 'SOLD' | 'RESERVED';
export type MeasurementType = 'WEIGHT' | 'QUANTITY';

// ============================================
// DOMAIN MODELS
// ============================================

/** Repack Unit (The main document) */
export interface RepackUnit {
  id: string;
  repackSessionId?: string;
  unitCode: string;
  status: RepackStatus;
  categoryId: string;
  gradeId: string;
  measurementType: MeasurementType;
  targetAmount: number;
  allocatedAmount: number;
  category?: { id: string; name: string };
  grade?: { id: string; name: string };
  allocations?: RepackAllocation[];
  inputAllocations?: RepackAllocation[]; // Backend returns this name
  createdAt: string;
  sealedAt?: string;
}

/** Repack Allocation (link to grading output) */
export interface RepackAllocation {
  id: string;
  repackUnitId: string;
  gradingOutputId: string;
  amountUsed: number;
  allocatedCost: number;
  // Joined data for display
  containerNumber?: string;
  ragCode?: string;
  sourceLabel?: string;
}

/** Available grading output for allocation */
export interface AvailableStock {
  id: string;
  categoryId: string;
  categoryName: string;
  gradeId: string;
  gradeName: string;
  measurementType: MeasurementType;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  containerNumber?: string;
  ragCode?: string;
  // fifoTimestamp removed - not needed for manual allocation
}

// ============================================
// REQUEST DTOs
// ============================================

/** Create new draft */
export interface CreateDraftRequest {
  categoryId: string;
  gradeId: string;
  measurementType: MeasurementType;
  targetAmount: number;
  manualAllocations?: Array<{ gradingOutputId: string; amountUsed: number }>;
}

/** Add allocation to draft */
export interface AddAllocationRequest {
  gradingOutputId: string;
  amountUsed: number;
}

/** Seal draft */
export interface SealDraftRequest {
  warehouseId: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface DraftListResponse {
  drafts: RepackUnit[];
  total: number;
}

export interface SealedListResponse {
  units: RepackUnit[];
  total: number;
}

// ============================================
// REFERENCE DATA
// ============================================

export interface Category {
  id: string;
  name: string;
}

export interface Grade {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
}

// ============================================
// RE-EXPORTS (for backwards compatibility)
// ============================================

/**
 * GradeOutput - represents grading output from the backend
 * This is the shape returned by GET /sorting/outputs
 */
export interface GradeOutput {
  id: string;
  tenantId: string;
  gradeBucketId: string;
  gradeId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  status: 'AVAILABLE' | 'PARTIALLY_USED' | 'DEPLETED' | 'READY_FOR_REPACK';
  totalAmount?: number;
  usedAmount?: number;
  remainingAmount?: number;
  createdAt: string;
  grade?: { id: string; name: string };
  gradeBucket?: {
    id: string;
    gradeSessionId: string;
    gradeSession?: {
      id: string;
      categoryOutput?: {
        id: string;
        categoryId: string;
        ragId?: string;
        containerId?: string;
        sortSessionId?: string;
        weightKg?: number | string;
        allocatedCost?: number | string;
        category?: { id: string; name: string };
        rag?: { id: string; ragCode: string };
        container?: { id: string; containerNumber: string };
      };
    };
  };
}
