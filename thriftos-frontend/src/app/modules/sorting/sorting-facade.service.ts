import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_ENDPOINTS } from '../../core/config/api.config';
import type { Rag } from '../procurement/rags/rag.models';
import type { AvailableForGrading, Grade, GradeBucket, GradeSession, SortCategoryBucket, SortSession } from './sorting.models';

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
    categoryOutput?: {
      id: string;
      weightKg: string | number;
      category?: { id: string; name: string };
      rag?: { id: string; ragCode: string } | null;
    };
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

  stage1Queue(page: number = 1, limit: number = 100, query?: Stage1QueueQuery) {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<PagedResponse<Stage1QueueItem>>(`${API_ENDPOINTS.sortingStage1}/queue`, { params });
  }

  stage1Summary(ragId: string) {
    const params = new HttpParams().set('ragId', ragId);
    return this.http.get<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/summary`, { params });
  }

  stage1SessionSummary(sessionId: string) {
    return this.http.get<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/sessions/${sessionId}`);
  }

  stage1Start(sourceId: string, sourceType: 'RAG' | 'LOOSE_BALE', workerId?: string, supervisorId?: string) {
    const body: any = { workerId, supervisorId };
    if (sourceType === 'RAG') {
      body.ragId = sourceId;
    } else {
      body.incomingBaleId = sourceId;
    }
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/start`, body);
  }

  stage1Allocate(sessionId: string, categoryId: string, amountKg: number, outputCount?: number) {
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/allocate`, {
      sessionId,
      categoryId,
      amountKg,
      ...(outputCount !== undefined ? { outputCount } : {}),
    });
  }

  stage1Seal(sessionId: string, wasteCategoryId?: string) {
    return this.http.patch<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/${sessionId}/seal`, {
      ...(wasteCategoryId ? { wasteCategoryId } : {}),
    });
  }

  stage1AddWaste(sessionId: string, wasteCategoryId: string, amount: number) {
    return this.http.post<Stage1Summary>(`${API_ENDPOINTS.sortingStage1}/waste`, { sessionId, wasteCategoryId, amount });
  }





  stage2Queue(page: number, limit: number) {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    // Backend returns AvailableForGradingResponse shape (data/total/page/limit/totalPages)
    return this.http.get<any>(`${API_ENDPOINTS.sortingStage2}/queue`, { params });
  }

  stage2Start(categoryOutputId: string, workerId?: string, supervisorId?: string) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingStage2}/start`, {
      categoryOutputId,
      workerId,
      supervisorId,
    });
  }

  stage2Summary(sessionId: string) {
    return this.http.get<Stage2Summary>(`${API_ENDPOINTS.sortingStage2}/sessions/${sessionId}`);
  }

  stage2Allocate(sessionId: string, gradeId: string, amountKg: number, outputCount?: number) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingStage2}/allocate`, {
      sessionId,
      gradeId,
      amountKg,
      ...(outputCount !== undefined ? { outputCount } : {}),
    });
  }

  stage2Seal(sessionId: string, wasteCategoryId?: string) {
    return this.http.patch<Stage2Summary>(`${API_ENDPOINTS.sortingStage2}/${sessionId}/seal`, {
      ...(wasteCategoryId ? { wasteCategoryId } : {}),
    });
  }

  stage2AddWaste(sessionId: string, wasteCategoryId: string, amount: number) {
    return this.http.post<Stage2Summary>(`${API_ENDPOINTS.sortingStage2}/waste`, { sessionId, wasteCategoryId, amount });
  }





  grades() {
    return this.http.get<Grade[]>(`${API_ENDPOINTS.tenant}/grades`);
  }




}
