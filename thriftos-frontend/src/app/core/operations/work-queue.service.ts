import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';

export interface OperationalTask {
  id: string;
  type: 'SORTING_SESSION' | string;
  title: string;
  route: string;
  updatedAt: string;
}

export interface OperationalWorkQueue {
  summary: {
    readyRags: number;
    activeSorting: number;
    activeGrading: number;
    draftRepacks: number;
    availableInventory: number;
    blockedRepacks: number;
  };
  tasks: OperationalTask[];
  nextAction: { label: string; route: string };
  blockers: Array<{ type: string; count: number; title: string; detail: string; route: string }>;
}

/** Shared operational data state. Layout shells only decide how to present it. */
@Injectable({ providedIn: 'root' })
export class WorkQueueService {
  private readonly http = inject(HttpClient);

  readonly queue = signal<OperationalWorkQueue | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<OperationalWorkQueue>(`${API_ENDPOINTS.tenant}/work-queue`).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (queue) => this.queue.set(queue),
      error: () => this.error.set('My Work could not be refreshed. Check your connection and try again.'),
    });
  }
}
