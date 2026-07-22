/**
 * REPACK SERVICE — CLEAN REBUILD
 * ==============================
 * Manual allocation only. No FIFO. No preview logic.
 * 
 * Backend Endpoints Used:
 *   GET    /repack/available-stock
 *   GET    /repack/units/drafts
 *   GET    /repack/units/sealed
 *   GET    /repack/units/:id
 *   POST   /repack/units/manual
 *   PATCH  /repack/units/:id/allocate
 *   PATCH  /repack/units/:id/deallocate
 *   PATCH  /repack/units/:id/seal
 *   DELETE /repack/units/:id
 */

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  RepackUnit,
  AvailableStock,
  CreateDraftRequest,
  AddAllocationRequest,
  SealDraftRequest,
  Category,
  Grade,
  Warehouse,
  MeasurementType,
} from './repack.models';
import { API_ENDPOINTS } from '../../core/config/api.config';

const API = API_ENDPOINTS.repack;

@Injectable({
  providedIn: 'root',
})
export class RepackService {
  constructor(private readonly http: HttpClient) {}

  // ============================================
  // AVAILABLE STOCK
  // ============================================

  /**
   * Get available grading outputs for allocation
   */
  getAvailableStock(
    categoryId: string,
    gradeId: string,
    measurementType: MeasurementType
  ): Observable<AvailableStock[]> {
    const params = new HttpParams()
      .set('categoryId', categoryId)
      .set('gradeId', gradeId)
      .set('measurementType', measurementType);

    return this.http.get<AvailableStock[]>(`${API}/available-stock`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  // ============================================
  // DRAFT OPERATIONS
  // ============================================

  /**
   * Get all draft units
   */
  getDrafts(): Observable<RepackUnit[]> {
    return this.http.get<RepackUnit[]>(`${API}/units/drafts`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get all sealed units
   */
  getSealedUnits(): Observable<RepackUnit[]> {
    return this.http.get<RepackUnit[]>(`${API}/units/sealed`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get all units (drafts + sealed) — for table view
   */
  getAllUnits(): Observable<RepackUnit[]> {
    // Combine both endpoints and merge results
    return new Observable<RepackUnit[]>(subscriber => {
      const allUnits: RepackUnit[] = [];
      let completed = 0;

      const checkComplete = () => {
        completed++;
        if (completed === 2) {
          // Sort by createdAt descending (newest first)
          allUnits.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          subscriber.next(allUnits);
          subscriber.complete();
        }
      };

      this.getDrafts().subscribe({
        next: (drafts) => { allUnits.push(...(drafts || [])); },
        error: () => { /* ignore partial failures */ },
        complete: checkComplete,
      });

      this.getSealedUnits().subscribe({
        next: (sealed) => { allUnits.push(...(sealed || [])); },
        error: () => { /* ignore partial failures */ },
        complete: checkComplete,
      });
    });
  }

  /**
   * Get single unit by ID
   */
  getUnit(id: string): Observable<RepackUnit> {
    return this.http.get<RepackUnit>(`${API}/units/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Create a new draft (manual mode)
   */
  createDraft(dto: CreateDraftRequest): Observable<RepackUnit> {
    const body = {
      categoryId: dto.categoryId,
      gradeId: dto.gradeId,
      measurementType: dto.measurementType,
      targetAmount: dto.targetAmount,
      manualAllocations: [],
    };

    return this.http.post<{ repackUnit: RepackUnit }>(`${API}/units/manual`, body).pipe(
      map(res => res.repackUnit),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new draft WITH first allocation
   * This solves the backend requirement for non-empty manualAllocations
   */
  createDraftWithAllocation(
    dto: CreateDraftRequest,
    firstAllocation: { gradingOutputId: string; amountUsed: number }
  ): Observable<RepackUnit> {
    const body = {
      categoryId: dto.categoryId,
      gradeId: dto.gradeId,
      measurementType: dto.measurementType,
      targetAmount: dto.targetAmount,
      manualAllocations: [firstAllocation]
    };

    return this.http.post<{ repackUnit: RepackUnit }>(`${API}/units/manual`, body).pipe(
      map(res => res.repackUnit),
      catchError(this.handleError)
    );
  }

  /**
   * Add allocation to draft
   */
  addAllocation(draftId: string, allocation: AddAllocationRequest): Observable<RepackUnit> {
    const body = {
      allocations: [allocation],
    };

    return this.http.patch<RepackUnit>(`${API}/units/${draftId}/allocate`, body).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Remove allocation from draft
   */
  removeAllocation(draftId: string, allocationId: string): Observable<RepackUnit> {
    const body = { allocationId };

    return this.http.patch<RepackUnit>(`${API}/units/${draftId}/deallocate`, body).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Delete draft
   */
  deleteDraft(draftId: string): Observable<void> {
    return this.http.delete<void>(`${API}/units/${draftId}`).pipe(
      catchError(this.handleError)
    );
  }

  // ============================================
  // SEAL OPERATIONS
  // ============================================

  /**
   * Seal draft (creates inventory)
   * warehouseId is optional - can be assigned later
   */
  sealDraft(draftId: string, warehouseId?: string | null): Observable<RepackUnit> {
    const body: Partial<SealDraftRequest> = {};
    if (warehouseId) {
      body.warehouseId = warehouseId;
    }

    return this.http.patch<RepackUnit>(`${API}/units/${draftId}/seal`, body).pipe(
      catchError(this.handleError)
    );
  }

  // ============================================
  // REFERENCE DATA
  // ============================================

  /**
   * Get categories
   */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_ENDPOINTS.tenant}/categories`).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Get grades
   */
  getGrades(): Observable<Grade[]> {
    return this.http.get<Grade[]>(`${API_ENDPOINTS.tenant}/grades`).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Get warehouses
   */
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${API_ENDPOINTS.tenant}/warehouses`).pipe(
      catchError(() => of([]))
    );
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  private handleError(error: any): Observable<never> {
    const message = error?.error?.message || error?.message || 'An error occurred';
    return throwError(() => new Error(message));
  }
}
