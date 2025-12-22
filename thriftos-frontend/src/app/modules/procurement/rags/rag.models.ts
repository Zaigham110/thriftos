/**
 * Rag/Bale Models
 * Phase 2.5: Container Breakdown
 * 
 * TypeScript interfaces matching backend DTOs and Prisma models
 */

// =============================================================
// ENUMS (Phase 2.5)
// =============================================================

export type RagStatus = 'NOT_STARTED' | 'IN_SORTING' | 'SORTED';
export type RagSourceType = 'CONTAINER' | 'LOOSE_BALE';
export type RagBaleType = 'RAG' | 'BALE' | 'BOTH';

// =============================================================
// RAG/BALE ENTITY
// =============================================================

export interface Rag {
  id: string;
  tenantId: string;
  containerId: string | null;
  ragCode: string;
  ragBaleType: RagBaleType;
  rawCategoryId: string | null;
  weightKg: number;
  allocatedCost: number;
  sourceType: RagSourceType;
  status: RagStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested relations
  container?: {
    id: string;
    containerNumber: string;
    purchaseOrder?: {
      id: string;
      poNumber: string;
    };
  };
  rawCategory?: {
    id: string;
    name: string;
    rawType: RagBaleType;
  } | null;
  sortSession?: {
    id: string;
    status: string;
  };
}

// =============================================================
// CREATE RAG REQUEST
// =============================================================

export interface CreateRagRequest {
  ragBaleType: RagBaleType;
  rawCategoryId: string;
  weightKg: number;
  notes?: string;
}

// =============================================================
// UPDATE RAG REQUEST
// =============================================================

export interface UpdateRagRequest {
  rawCategoryId?: string;
  weightKg?: number;
  notes?: string;
}

// =============================================================
// RAW CATEGORY
// =============================================================

export interface RawCategory {
  id: string;
  tenantId: string;
  name: string;
  rawType: RagBaleType;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// RAG LIST RESPONSE
// =============================================================

export interface RagListResponse {
  data: Rag[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================
// RAG FILTERS
// =============================================================

export interface RagFilters {
  containerId?: string;
  status?: RagStatus;
  sortableOnly?: boolean;
  showSorted?: boolean;
  page?: number;
  limit?: number;
}

// =============================================================
// STATUS BADGE CONFIGURATION
// =============================================================

export const RAG_STATUS_CONFIG: Record<RagStatus, {
  label: string;
  variant: 'default' | 'warning' | 'success' | 'danger';
}> = {
  NOT_STARTED: { label: 'Not Started', variant: 'default' },
  IN_SORTING: { label: 'In Sorting', variant: 'warning' },
  SORTED: { label: 'Sorted', variant: 'success' },
};

// =============================================================
// SOURCE TYPE LABELS
// =============================================================

export const RAG_SOURCE_TYPE_LABELS: Record<RagSourceType, string> = {
  CONTAINER: 'Container',
  LOOSE_BALE: 'Loose Bale',
};
