import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export interface Named { id: string; name: string }
/** A category, with the usual kg of one of its bales (v2 6.6) when set. */
export interface CategoryRow extends Named { baleWeightKg?: string | null }
export interface Supplier extends Named { originCountry?: string | null; country?: string | null }
export interface WasteType extends Named {}
export interface Lot {
  id: string;
  ragCode: string;
  weightKg: string;
  status: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED';
  originCountry?: string | null;
  container?: { containerNumber: string } | null;
  vendor?: { name: string } | null;
  createdAt: string;
}
export interface SessionLine { categoryId?: string; gradeId?: string; outputWeightKg: string; category?: Named; grade?: Named }
export interface SessionOutput { id: string; name: string; weightKg: string; cost: string; costPerKg: string; bales?: number }
/** What a lot gave per kind (category + grade), all of it and today (v2 6.6). */
export interface SortKind { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; kg: string; bales: number; todayKg: string; todayBales: number }
export interface ReadyRow { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; availableKg: string }
export interface SortSummary {
  session: { id: string; status: 'OPEN' | 'CLOSED'; totalInputWeight?: string; totalOutputWeight?: string; totalGradeOutputWeight?: string; categoryOutput?: { weightKg: string; category: Named } } | null;
  buckets: SessionLine[];
  wasteLineItems: { amount: string; wasteCategoryId: string }[];
  outputs: SessionOutput[];
  kinds?: SortKind[];
  today?: { kg: string; bales: number };
  bales?: number;
  /** Kg sorted and not baled yet, per kind: what "Make bales" can take (v2 6.6). */
  ready?: ReadyRow[];
  /** Bales made from this lot, per kind of bale. */
  madeBales?: { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; bales: number; kg: string; todayBales: number }[];
  /** Kat put into stock when the lot closed. */
  kat?: { id: string; name: string; kg: string; leftKg: string; status: string } | null;
  /** Bales made by the entry just saved (for printing stickers). */
  baleIds?: string[];
}
export interface GradeQueueItem { id: string; weightKg: string; category: Named; rag?: { ragCode: string } | null; gradeSessions: { id: string; status: string }[] }
export interface BaleKind { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; availableKg: string }

const list = <T>(r: T[] | { data?: T[]; items?: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : r?.data ?? r?.items ?? []);

/** Reads for the floor screens. All are cached by the service worker, so they work offline after one visit. */
@Injectable({ providedIn: 'root' })
export class FloorDataService {
  private readonly http = inject(HttpClient);

  private get<T>(path: string): Observable<T[]> {
    return this.http.get<T[] | { data?: T[] }>(`${API_BASE_URL}${path}`).pipe(map(list), catchError(() => of([] as T[])));
  }

  suppliers(): Observable<Supplier[]> {
    return this.get<Supplier>('/procurement/vendors');
  }
  categories(): Observable<CategoryRow[]> {
    return this.get<CategoryRow>('/tenant/categories');
  }
  grades(): Observable<Named[]> {
    return this.get<Named>('/tenant/grades');
  }
  wasteTypes(): Observable<WasteType[]> {
    return this.get<WasteType>('/tenant/waste-categories');
  }
  lotsToSort(): Observable<Lot[]> {
    return this.get<Lot>('/sorting/stage-1/queue?limit=50');
  }
  /** One lot, straight from the server (a lot received a moment ago may not be in the cached queue yet). */
  lot(id: string): Observable<Lot | null> {
    return this.http.get<Lot>(`${API_BASE_URL}/procurement/rags/${encodeURIComponent(id)}`).pipe(catchError(() => of(null)));
  }
  toGrade(): Observable<GradeQueueItem[]> {
    return this.get<GradeQueueItem>('/sorting/stage-2/queue?limit=50');
  }
  baleKinds(): Observable<BaleKind[]> {
    return this.get<BaleKind>('/stock/bales/kinds');
  }
  /** The open (or just closed) sort session of a lot; null when not started. */
  sortSummary(lotId: string): Observable<SortSummary | null> {
    return this.http.get<SortSummary>(`${API_BASE_URL}/sorting/stage-1/summary?ragId=${encodeURIComponent(lotId)}`).pipe(catchError(() => of(null)));
  }
  sortSession(sessionId: string): Observable<SortSummary | null> {
    return this.http.get<SortSummary>(`${API_BASE_URL}/sorting/stage-1/sessions/${sessionId}`).pipe(catchError(() => of(null)));
  }
  gradeSession(sessionId: string): Observable<SortSummary | null> {
    return this.http.get<SortSummary>(`${API_BASE_URL}/sorting/stage-2/sessions/${sessionId}`).pipe(catchError(() => of(null)));
  }
}

/** Most-used first: tiles the floor picked recently come first (kept on this phone). */
export function usageOrder<T extends { id: string }>(items: T[], key: string): T[] {
  let counts: Record<string, number> = {};
  try {
    counts = JSON.parse(localStorage.getItem(`thriftos.use.${key}`) || '{}');
  } catch {
    /* ignore */
  }
  return [...items].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
}

export function countUse(key: string, id: string): void {
  try {
    const counts = JSON.parse(localStorage.getItem(`thriftos.use.${key}`) || '{}');
    counts[id] = (counts[id] ?? 0) + 1;
    localStorage.setItem(`thriftos.use.${key}`, JSON.stringify(counts));
  } catch {
    /* ignore */
  }
}
