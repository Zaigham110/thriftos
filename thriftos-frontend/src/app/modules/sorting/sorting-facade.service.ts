import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_ENDPOINTS } from '../../core/config/api.config';
import type { Rag } from '../procurement/rags/rag.models';
import type { SortCategoryBucket, SortSession } from '../sorting-stage1/sorting-stage1.models';
import type { AvailableForGrading, Grade, GradeBucket, GradeSession, GradeOutput } from '../sorting-stage2/sorting-stage2.models';

export type WasteUnitType = 'KG' | 'PCS';

export interface WasteCategory {
  id: string;
  name: string;
  unitType: WasteUnitType;
  defaultResalePrice: string | number;
  isActive: boolean;
}

export interface WasteLineItem {
  id: string;
  stage: 'STAGE_1' | 'STAGE_2';
  amount: string | number;
  unitType: WasteUnitType;
  estimatedValue: string | number;
  updatedAt: string;
  wasteCategory?: WasteCategory;
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OutputsQuery {
  search?: string;
  status?: string;
  gradeId?: string;
  ragCode?: string;
  containerNumber?: string;
  categoryId?: string;
}

export interface Stage1Summary {
  session:
    | (SortSession & {
        computedWasteWeight?: string;
        declaredWasteAmount?: string;
        remainingWasteAmount?: string;
      })
    | null;
  buckets: SortCategoryBucket[];
  wasteLineItems?: WasteLineItem[];
}

export interface Stage1QueueQuery {
  status?: string;
}

export interface Stage1QueueItem {
  id: string;
  sourceType?: 'RAG' | 'LOOSE_BALE';
  sourceId?: string;
  ragCode?: string;
  baleCode?: string;
  weightKg: number;
  status: string;
  container?: {
    id: string;
    containerNumber: string;
    purchaseOrder?: {
      id: string;
      poNumber: string;
    };
  };
  purchaseOrder?: {
    id: string;
    poNumber: string;
  };
  rawCategory?: {
    id: string;
    name: string;
  };
  containerId?: string | null;
}

export interface Stage2Summary {
  session: {
    id: string;
    status: string;
    categoryOutputId: string;
    totalGradeOutputWeight: string;
    wasteWeight: string;
    declaredWasteAmount?: string;
    remainingWasteAmount?: string;
    gradeYieldPercent: number;
  } | null;
  buckets: GradeBucket[];
  wasteLineItems?: WasteLineItem[];
}

@Injectable({ providedIn: 'root' })
export class SortingFacadeService {
  private readonly http = inject(HttpClient);

  wasteCategories() {
    return this.http.get<WasteCategory[]>(API_ENDPOINTS.wasteCategories);
  }

  stage1Queue(page: number, limit: number, query?: Stage1QueueQuery) {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<PagedResponse<Stage1QueueItem>>(`${API_ENDPOINTS.sortingFacadeStage1}/queue`, { params });
  }

  stage1Summary(ragId: string) {
    const params = new HttpParams().set('ragId', ragId);
    return this.http.get<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/summary`, { params });
  }

  stage1Start(sourceId: string, sourceType: 'RAG' | 'LOOSE_BALE', workerId?: string, supervisorId?: string) {
    const body: any = { workerId, supervisorId };
    if (sourceType === 'RAG') {
      body.ragId = sourceId;
    } else {
      body.incomingBaleId = sourceId;
    }
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/start`, body);
  }

  stage1Allocate(sessionId: string, categoryId: string, amountKg: number) {
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/allocate`, {
      sessionId,
      categoryId,
      amountKg,
    });
  }

  stage1Seal(sessionId: string, wasteCategoryId?: string) {
    return this.http.patch<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/${sessionId}/seal`, {
      ...(wasteCategoryId ? { wasteCategoryId } : {}),
    });
  }

  stage1AddWaste(sessionId: string, wasteCategoryId: string, amount: number) {
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/waste`, { sessionId, wasteCategoryId, amount });
  }

  stage1UpdateWaste(wasteLineItemId: string, wasteCategoryId: string, amount: number) {
    return this.http.patch<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/waste/${wasteLineItemId}`, { wasteCategoryId, amount });
  }

  stage1DeleteWaste(wasteLineItemId: string) {
    return this.http.delete<Stage1Summary>(`${API_ENDPOINTS.sortingFacadeStage1}/waste/${wasteLineItemId}`);
  }

  /** Update a category bucket's weight (absolute value, not incremental) */
  stage1UpdateBucket(bucketId: string, outputWeightKg: number, outputCount?: number) {
    return this.http.patch<any>(`${API_ENDPOINTS.sortingStage1}/buckets/${bucketId}`, {
      outputWeightKg,
      ...(outputCount !== undefined ? { outputCount } : {}),
    });
  }

  /** Remove a category bucket from the session */
  stage1DeleteBucket(bucketId: string) {
    return this.http.delete<any>(`${API_ENDPOINTS.sortingStage1}/buckets/${bucketId}`);
  }

  stage2Queue(page: number, limit: number) {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    // Backend returns AvailableForGradingResponse shape (data/total/page/limit/totalPages)
    return this.http.get<any>(`${API_ENDPOINTS.sortingFacadeStage2}/queue`, { params });
  }

  stage2Start(categoryOutputId: string, workerId?: string, supervisorId?: string) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/start`, {
      categoryOutputId,
      workerId,
      supervisorId,
    });
  }

  stage2Allocate(sessionId: string, gradeId: string, amountKg: number) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/allocate`, {
      sessionId,
      gradeId,
      amountKg,
    });
  }

  stage2Seal(sessionId: string, wasteCategoryId?: string) {
    return this.http.patch<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/${sessionId}/seal`, {
      ...(wasteCategoryId ? { wasteCategoryId } : {}),
    });
  }

  stage2AddWaste(sessionId: string, wasteCategoryId: string, amount: number) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/waste`, { sessionId, wasteCategoryId, amount });
  }

  stage2UpdateWaste(wasteLineItemId: string, wasteCategoryId: string, amount: number) {
    return this.http.patch<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/waste/${wasteLineItemId}`, { wasteCategoryId, amount });
  }

  stage2DeleteWaste(wasteLineItemId: string) {
    return this.http.delete<Stage2Summary>(`${API_ENDPOINTS.sortingFacadeStage2}/waste/${wasteLineItemId}`);
  }

  /** Update a grade bucket's weight (absolute value, not incremental) */
  stage2UpdateBucket(bucketId: string, outputWeightKg: number, outputCount?: number) {
    return this.http.patch<any>(`${API_ENDPOINTS.sortingStage2}/buckets/${bucketId}`, {
      outputWeightKg,
      ...(outputCount !== undefined ? { outputCount } : {}),
    });
  }

  /** Remove a grade bucket from the session */
  stage2DeleteBucket(bucketId: string) {
    return this.http.delete<any>(`${API_ENDPOINTS.sortingStage2}/buckets/${bucketId}`);
  }

  grades() {
    return this.http.get<Grade[]>(API_ENDPOINTS.grades);
  }

  outputs(page: number, limit: number, query?: OutputsQuery) {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (query?.search) params = params.set('search', query.search);
    if (query?.status) params = params.set('status', query.status);
    if (query?.gradeId) params = params.set('gradeId', query.gradeId);
    if (query?.ragCode) params = params.set('ragCode', query.ragCode);
    if (query?.containerNumber) params = params.set('containerNumber', query.containerNumber);
    if (query?.categoryId) params = params.set('categoryId', query.categoryId);
    return this.http.get<PagedResponse<GradeOutput>>(API_ENDPOINTS.sortingOutputs, { params });
  }

  output(id: string) {
    return this.http.get<GradeOutput>(`${API_ENDPOINTS.sortingOutputs}/${id}`);
  }

  markOutputReadyForRepack(outputId: string) {
    return this.http.patch<GradeOutput>(`${API_ENDPOINTS.sortingOutputs}/${outputId}/mark-ready`, {});
  }
}
