/** Shapes returned by the /sorting API. */

export type SortStatus = 'OPEN' | 'CLOSED';

export interface SortSession {
  id: string;
  tenantId: string;
  ragId: string | null;
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

export interface CategoryOutputRef {
  id: string;
  weightKg: number;
  count: number;
  allocatedCost: number;
}

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type GradeStatus = 'OPEN' | 'CLOSED';

export type GradingOutputStatus = 'AVAILABLE' | 'PARTIALLY_USED' | 'DEPLETED' | 'READY_FOR_REPACK';

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
  gradeSession?: {
    id: string;
    status: string;
    categoryOutput?: {
      id: string;
      categoryId: string;
      ragId?: string;
      containerId?: string;
      category?: { id: string; name: string };
      rag?: { id: string; ragCode: string };
      container?: { id: string; containerNumber: string };
    };
  };
}

export interface GradeOutput {
  id: string;
  tenantId: string;
  gradeBucketId: string;
  gradeId: string;
  weightKg: number | string;
  count: number;
  allocatedCost: number | string;
  status: GradingOutputStatus;
  createdAt: string;
  grade?: Grade;
  gradeBucket?: GradeBucket;
}

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
  gradeStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'GRADED';
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
  gradeSessions?: Array<{
    id: string;
    status: string;
  }>;
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
