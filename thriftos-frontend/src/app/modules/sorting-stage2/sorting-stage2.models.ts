/**
 * Sorting Stage 2 Models
 * Phase 4: Grading UI
 * 
 * Based on backend DTOs and Prisma schema.
 * Grading operates on CategoryOutput from Stage 1.
 */

// Enum from Prisma
export type GradeStatus = 'OPEN' | 'CLOSED';

// =============================================================
// GRADE (System-defined grades: G1, G2, G3)
// =============================================================

export interface Grade {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rank: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================
// GRADE SESSION
// =============================================================

export interface GradeSession {
  id: string;
  tenantId: string;
  categoryOutputId: string;
  workerId: string;
  supervisorId: string;
  status: GradeStatus;
  createdAt: string;
  updatedAt: string;
  // Nested relations when included
  categoryOutput?: CategoryOutputWithLineage;
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
  gradeBuckets?: GradeBucket[];
  // Computed fields from backend
  totalGradeOutputWeight?: string;
  wasteWeight?: string;
  gradeYieldPercent?: number;
}

export interface CategoryOutputWithLineage {
  id: string;
  sortCategoryBucketId: string;
  categoryId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  containerId?: string;
  ragId?: string;
  sortSessionId?: string;
  category?: {
    id: string;
    name: string;
  };
  // Traceability chain (populated via includes)
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
}

export interface CreateGradeSessionRequest {
  categoryOutputId: string;
  workerId?: string;
  supervisorId?: string;
}

export interface UpdateGradeSessionRequest {
  workerId?: string;
  supervisorId?: string;
}

export interface GradeSessionListResponse {
  data: GradeSession[];
  total: number;
  page: number;
  limit: number;
}

export interface GradeSessionFilters {
  status?: GradeStatus;
  page?: number;
  limit?: number;
}

// =============================================================
// GRADE BUCKET (Grade allocation within a session)
// =============================================================

export interface GradeBucket {
  id: string;
  gradeSessionId: string;
  gradeId: string;
  outputWeightKg: number | string;
  outputCount: number;
  createdAt: string;
  updatedAt: string;
  grade?: Grade;
  gradeOutputs?: GradeOutput[];
}

export interface CreateGradeBucketRequest {
  gradeId: string;
  outputWeightKg: number;
  outputCount: number;
}

export interface UpdateGradeBucketRequest {
  outputWeightKg: number;
  outputCount: number;
}

// =============================================================
// GRADE OUTPUT (Immutable record created on session close)
// =============================================================

export interface GradeOutput {
  id: string;
  tenantId: string;
  gradeBucketId: string;
  gradeId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  createdAt: string;
  grade?: Grade;
}

// =============================================================
// GRADING STATS & COMPUTED VALUES
// =============================================================

export interface GradingTotals {
  totalInputWeight: number;
  totalGradedWeight: number;
  totalItemCount: number;
  wasteWeight: number;
  yieldPercentage: number;
}

// =============================================================
// LINEAGE INFO (Traceability display)
// =============================================================

export interface GradingLineage {
  containerId?: string;
  containerNumber?: string;
  ragId?: string;
  ragCode?: string;
  stage1SessionId?: string;
  categoryId?: string;
  categoryName?: string;
  originalWeight: number;
}

// =============================================================
// AVAILABLE FOR GRADING (Category outputs from Stage 1)
// =============================================================

export interface AvailableForGrading {
  id: string;
  tenantId: string;
  categoryId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  containerId?: string;
  ragId?: string;
  sortSessionId?: string;
  createdAt: string;
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
  sortCategoryBucket?: {
    id: string;
    sortSession?: {
      id: string;
      status: string;
      startTime: string;
      endTime?: string;
      worker?: {
        id: string;
        name: string;
      };
    };
  };
}

export interface AvailableForGradingResponse {
  data: AvailableForGrading[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
