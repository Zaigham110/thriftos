import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth';
import { IdbStore } from './idb';

/** What a queued write is, for the "Not synced yet" and "Needs attention" lists. */
export type QueueKind = 'receive' | 'sort' | 'bale' | 'customer' | 'sale' | 'payment';

/**
 * A value inside a queued body that is only known once an earlier queued write is saved,
 * e.g. the id of a customer added offline, used by the sale made right after it.
 */
export interface QueueRef {
  $ref: string;
  path?: string;
}

export interface QueuedWrite {
  /** Also the Idempotency-Key, so the server records the write once however often it is sent. */
  id: string;
  owner: string;
  kind: QueueKind;
  /** Short text for the lists ("Sale — Haji Rafiq, Rs 12,000"). */
  label: string;
  method: 'POST' | 'PATCH';
  /** API path (`/api/...`). May contain `{ref:<id>}` for an id saved by an earlier write. */
  url: string;
  body: unknown;
  status: 'pending' | 'failed';
  error?: string;
  createdAt: number;
}

interface SavedResult {
  id: string;
  owner: string;
  response: unknown;
  at: number;
}

export type SendResult<T> = { saved: true; id: string; response: T } | { saved: false; id: string };

/** Network trouble (or the server still saving the same key): keep the write and try later. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return true;
  return error.status === 0 || error.status === 408 || error.status === 409 && /still being saved/i.test(String(error.error?.message)) || error.status >= 502;
}

function messageOf(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const m = error.error?.message;
    return Array.isArray(m) ? m.join(', ') : String(m || error.statusText || 'Not accepted');
  }
  return String((error as Error)?.message || error);
}

const RESULTS_KEEP_MS = 3 * 24 * 3600 * 1000;

/**
 * Every write the floor can make offline (receive, sort line, bale, customer, sale, payment) goes through
 * here. The write is stored on the phone (IndexedDB) first, then sent in order with its idempotency key.
 * Offline, it stays queued and is sent when the connection comes back; a write the server refuses later
 * (e.g. stock already sold) moves to "Needs attention" with Retry and Discard.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly writes = new IdbStore<QueuedWrite>('writes');
  private readonly results = new IdbStore<SavedResult>('results');
  private running: Promise<void> | null = null;

  private readonly items = signal<QueuedWrite[]>([]);
  readonly online = signal(navigator.onLine);
  readonly pending = computed(() => this.items().filter((w) => w.status === 'pending'));
  readonly failed = computed(() => this.items().filter((w) => w.status === 'failed'));
  readonly pendingCount = computed(() => this.pending().length);
  readonly syncing = signal(false);

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.sync();
    });
    window.addEventListener('offline', () => this.online.set(false));
    setInterval(() => {
      if (this.online() && this.pendingCount()) void this.sync();
    }, 30_000);
    void this.refresh().then(() => this.sync());
  }

  /**
   * Store the write on the phone, then try to send it (and anything queued before it).
   * Online and accepted → `saved` with the server's answer. Offline → `saved: false` (queued).
   * Online and refused (validation) → the write is dropped and the error is thrown for the form to show.
   */
  async send<T>(write: { kind: QueueKind; label: string; url: string; body: unknown; method?: 'POST' | 'PATCH'; id?: string }): Promise<SendResult<T>> {
    const entry: QueuedWrite = {
      id: write.id ?? crypto.randomUUID(),
      owner: this.owner(),
      kind: write.kind,
      label: write.label,
      method: write.method ?? 'POST',
      url: write.url,
      body: write.body,
      status: 'pending',
      createdAt: Date.now(),
    };
    await this.writes.put(entry);
    await this.refresh();
    let refusal: unknown;
    if (this.online()) await this.sync((id, error) => (id === entry.id ? (refusal = error) : undefined));
    if (refusal !== undefined) {
      await this.writes.delete(entry.id);
      await this.refresh();
      throw refusal;
    }
    const saved = await this.results.get(entry.id);
    return saved ? { saved: true, id: entry.id, response: saved.response as T } : { saved: false, id: entry.id };
  }

  /** The server's answer to a write sent earlier (also once it synced later). */
  async resultOf<T>(id: string): Promise<T | undefined> {
    return (await this.results.get(id))?.response as T | undefined;
  }

  /** A reference to the id an earlier queued write gets from the server. */
  ref(id: string, path = 'id'): QueueRef {
    return { $ref: id, path };
  }

  async retry(id: string): Promise<void> {
    const w = await this.writes.get(id);
    if (!w) return;
    await this.writes.put({ ...w, status: 'pending', error: undefined });
    await this.refresh();
    await this.sync();
  }

  async discard(id: string): Promise<void> {
    await this.writes.delete(id);
    await this.refresh();
  }

  /** Send queued writes in order. Stops at the first network failure; refused writes move to "failed". */
  sync(onRefused?: (id: string, error: unknown) => void): Promise<void> {
    if (this.running) return this.running.then(() => this.sync(onRefused));
    this.running = this.run(onRefused).finally(() => {
      this.running = null;
      this.syncing.set(false);
    });
    return this.running;
  }

  private async run(onRefused?: (id: string, error: unknown) => void): Promise<void> {
    const owner = this.owner();
    const queue = (await this.writes.all()).filter((w) => w.owner === owner).sort((a, b) => a.createdAt - b.createdAt);
    const failedIds = new Set(queue.filter((w) => w.status === 'failed').map((w) => w.id));
    if (!queue.some((w) => w.status === 'pending')) return;
    this.syncing.set(true);
    for (const w of queue) {
      if (w.status !== 'pending') continue;
      const deps = refsIn(w);
      const blockedBy = deps.find((d) => failedIds.has(d));
      if (blockedBy) {
        failedIds.add(w.id);
        await this.writes.put({ ...w, status: 'failed', error: 'An earlier entry it needs was not saved.' });
        continue;
      }
      let url: string;
      let body: unknown;
      try {
        ({ url, body } = await this.resolve(w));
      } catch {
        break; // an earlier write it needs is still queued
      }
      try {
        const response = await firstValueFrom(
          this.http.request(w.method, url, { body, headers: { 'Idempotency-Key': w.id } }),
        );
        await this.results.put({ id: w.id, owner, response, at: Date.now() });
        await this.writes.delete(w.id);
      } catch (error) {
        if (isTransient(error)) {
          if (error instanceof HttpErrorResponse && error.status === 0) this.online.set(navigator.onLine);
          break;
        }
        failedIds.add(w.id);
        await this.writes.put({ ...w, status: 'failed', error: messageOf(error) });
        onRefused?.(w.id, error);
      }
    }
    await this.pruneResults();
    await this.refresh();
  }

  private async resolve(w: QueuedWrite): Promise<{ url: string; body: unknown }> {
    const lookup = async (id: string, path = 'id') => {
      const r = await this.results.get(id);
      if (!r) throw new Error('waiting');
      return path.split('.').reduce<any>((v, k) => v?.[k], r.response);
    };
    let url = w.url;
    for (const m of w.url.matchAll(/\{ref:([^}]+)\}/g)) url = url.replace(m[0], String(await lookup(m[1])));
    const walk = async (v: unknown): Promise<unknown> => {
      if (Array.isArray(v)) return Promise.all(v.map(walk));
      if (v && typeof v === 'object') {
        if ('$ref' in v) return lookup((v as QueueRef).$ref, (v as QueueRef).path);
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) out[k] = await walk(x);
        return out;
      }
      return v;
    };
    return { url, body: await walk(w.body) };
  }

  private async refresh(): Promise<void> {
    const owner = this.owner();
    const all = await this.writes.all().catch(() => [] as QueuedWrite[]);
    this.items.set(all.filter((w) => w.owner === owner).sort((a, b) => a.createdAt - b.createdAt));
  }

  private async pruneResults(): Promise<void> {
    const old = (await this.results.all()).filter((r) => Date.now() - r.at > RESULTS_KEEP_MS);
    await Promise.all(old.map((r) => this.results.delete(r.id)));
  }

  /** Writes belong to the person who made them; another login on the same phone never sends them. */
  private owner(): string {
    const u = this.auth.user();
    return u ? `${u.impersonatedTenantId || u.tenantId}:${u.id}` : 'anonymous';
  }
}

function refsIn(w: QueuedWrite): string[] {
  const ids = [...w.url.matchAll(/\{ref:([^}]+)\}/g)].map((m) => m[1]);
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if ('$ref' in v) ids.push((v as QueueRef).$ref);
      else Object.values(v).forEach(walk);
    }
  };
  walk(w.body);
  return ids;
}
