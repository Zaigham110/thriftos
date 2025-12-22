/**
 * Sorting Stage 1 Models
 * Phase 3: Category Sorting UI
 * 
 * Based on backend DTOs and Prisma schema
 */

// Enum from Prisma
export type SortStatus = 'OPEN' | 'CLOSED';

// =============================================================
// SORT SESSION
// =============================================================

export interface SortSession {
  id: string;
  tenantId: string;
  ragId: string | null;
  incomingBaleId: string | null;
  workerId: string;
  supervisorId: string;
  totalInputWeight: number;
  totalOutputWeight: number;
  wasteWeight: number;
  status: SortStatus;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested relations when included
  rag?: {
    id: string;
    ragCode: string;
    weightKg: number;
    container?: {
      id: string;
      containerNumber: string;
    };
  };
  incomingBale?: {
    id: string;
    baleCode: string;
    weightKg: number;
  };
  worker?: {
    id: string;
    name: string;
    email: string;
  };
  supervisor?: {
    id: string;
    name: string;
    email: string;
  };
  buckets?: SortCategoryBucket[];
}

export interface CreateSortSessionRequest {
  ragId?: string;
  incomingBaleId?: string;
  workerId?: string;
  supervisorId?: string;
}

export interface UpdateSortSessionRequest {
  workerId?: string;
  supervisorId?: string;
}

export interface SortSessionListResponse {
  data: SortSession[];
  total: number;
  page: number;
  limit: number;
}

export interface SortSessionFilters {
  status?: SortStatus;
  page?: number;
  limit?: number;
}

// =============================================================
// SORT CATEGORY BUCKET
// =============================================================

export interface SortCategoryBucket {
  id: string;
  sortSessionId: string;
  categoryId: string;
  outputWeightKg: number;
  outputCount: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  // CategoryOutputs created when session closes (for Stage 2 grading)
  categoryOutputs?: CategoryOutputRef[];
}

// Reference to CategoryOutput for bucket (lightweight for list display)
export interface CategoryOutputRef {
  id: string;
  weightKg: number;
  count: number;
  allocatedCost: number;
}

export interface CreateSortCategoryBucketRequest {
  categoryId: string;
  outputWeightKg: number;
  outputCount: number;
}

export interface UpdateSortCategoryBucketRequest {
  outputWeightKg: number;
  outputCount: number;
}

// =============================================================
// CATEGORY OUTPUT (Read-only aggregation)
// =============================================================

export interface CategoryOutput {
  id: string;
  sortSessionId: string;
  categoryId: string;
  totalWeight: number;
  totalQuantity: number;
  createdAt: string;
  category?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CategoryOutputListResponse {
  data: CategoryOutput[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// =============================================================
// SORTING STATS & COMPUTED VALUES
// =============================================================

export interface SortingTotals {
  totalInputWeight: number;
  totalSortedWeight: number;
  totalItemCount: number;
  yieldPercentage: number;
}

// =============================================================
// AVAILABLE SOURCES FOR SORTING
// =============================================================

export interface SortableSource {
  type: 'rag' | 'incomingBale';
  id: string;
  code: string;
  weightKg: number;
  description: string;
  hasOpenSession: boolean;
}

// =============================================================
// CATEGORY CONFIG (from tenant settings)
// =============================================================

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
