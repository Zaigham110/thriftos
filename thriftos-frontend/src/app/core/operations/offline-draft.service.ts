import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { fromEvent, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../config/api.config';

export interface OfflineDraft<T = unknown> {
  id: string;
  type: string;
  payload: T;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const STORAGE_KEY = 'thriftos.operational-drafts.v1';
const DRAFT_ENDPOINTS: Record<string, string> = {
  RAG_INTAKE: `${API_BASE_URL}/procurement/rags`,
};

/**
 * Local, recoverable foundation for offline-capable operational forms.
 * Feature flows enqueue idempotency-keyed drafts; only their server endpoint can
 * remove a draft after server-authoritative validation succeeds.
 */
@Injectable({ providedIn: 'root' })
export class OfflineDraftService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly draftsState = signal<OfflineDraft[]>(this.readDrafts());
  private readonly onlineState = signal(navigator.onLine);

  readonly drafts = this.draftsState.asReadonly();
  readonly pendingCount = computed(() => this.draftsState().length);
  readonly conflictedDrafts = computed(() => this.draftsState().filter((draft) => draft.retryCount > 0));
  readonly isOnline = this.onlineState.asReadonly();
  /** Writes are queued on the phone whenever it is offline. */
  readonly canQueueOffline = computed(() => !this.isOnline());

  constructor() {
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.onlineState.set(navigator.onLine);
        if (navigator.onLine) this.syncPending();
      });

    // A reload can happen after connectivity was restored. Browser `online`
    // does not fire in that case, so replay known idempotent drafts once the
    // operational service is constructed for the authenticated Flow session.
    if (navigator.onLine && this.draftsState().length) {
      queueMicrotask(() => this.syncPending());
    }
  }

  enqueue<T>(type: string, payload: T): OfflineDraft<T> {
    if (!this.canQueueOffline()) {
      throw new Error('This tenant requires an active connection for operational changes.');
    }
    const draft: OfflineDraft<T> = {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    this.draftsState.update((drafts) => [...drafts, draft]);
    this.persist();
    return draft;
  }

  remove(id: string): void {
    this.draftsState.update((drafts) => drafts.filter((draft) => draft.id !== id));
    this.persist();
  }

  /** Sync one draft with an idempotency key. Failures remain visible for retry. */
  sync(draft: OfflineDraft, endpoint: string): void {
    if (!this.isOnline()) return;
    this.http.post(endpoint, draft.payload, { headers: { 'Idempotency-Key': draft.id } }).subscribe({
      next: () => this.remove(draft.id),
      error: (error) => {
        this.draftsState.update((drafts) => drafts.map((item) => item.id === draft.id
          ? {
            ...item,
            retryCount: item.retryCount + 1,
            lastError: error?.error?.message || 'The server did not accept this draft yet.',
          }
          : item));
        this.persist();
      },
    });
  }

  /** Replays only draft types with an explicit, server-authoritative endpoint. */
  syncPending(): void {
    if (!this.isOnline()) return;
    for (const draft of this.draftsState()) {
      const endpoint = DRAFT_ENDPOINTS[draft.type];
      if (endpoint) this.sync(draft, endpoint);
    }
  }

  retry(draft: OfflineDraft): void {
    const endpoint = DRAFT_ENDPOINTS[draft.type];
    if (endpoint) this.sync(draft, endpoint);
  }

  private readDrafts(): OfflineDraft[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.draftsState()));
  }
}
