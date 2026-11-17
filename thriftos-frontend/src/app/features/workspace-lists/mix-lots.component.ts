import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

/** A lot waiting to be sorted, from the lots list (cost is absent without cost.view). */
interface WaitingLot { id: string; code: string; supplier: string | null; container: string | null; kg: string; cost?: string | null; date: string }

/**
 * Mix lots (owner, 2026-11-17: "received two containers or loose lots and mix those for workers to sort"): tick
 * two or more lots that are waiting, see what the mix will weigh and each lot's share, and make the mix. It is
 * then sorted as one lot; what it gives is shared back to each lot by weight.
 */
@Component({
  selector: 'app-mix-lots',
  standalone: true,
  imports: [TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.mix.title' | t" [subtitle]="'ws.mix.subtitle' | t" />
      @if (failed()) {
        <ws-state kind="error" [heading]="'common.couldNotLoad' | t" (retry)="load()" />
      } @else if (lots(); as list) {
        @if (list.length < 2) {
          <p class="note">{{ 'ws.mix.needTwo' | t }}</p>
        } @else {
          <ul class="rows" [attr.aria-label]="'ws.mix.waiting' | t">
            @for (l of list; track l.id) {
              <li>
                <label>
                  <input type="checkbox" [checked]="picked().has(l.id)" (change)="toggle(l.id)" />
                  <span class="what"><strong class="ltr">{{ l.code }}</strong><small>{{ [l.supplier, l.container].filter(isText).join(' · ') }}</small></span>
                  <span class="num">{{ i18n.kg(l.kg) }}@if (picked().has(l.id) && totalKg()) { <small>{{ i18n.num(share(l), 1) }}%</small> }</span>
                </label>
              </li>
            }
          </ul>
          <section class="sum" aria-live="polite">
            @if (chosen().length >= 2) {
              <p><strong>{{ 'ws.mix.summary' | t: { n: chosen().length, kg: i18n.kg(totalKg()) } }}</strong>@if (costPerKg(); as c) { · {{ 'ws.mix.costPerKg' | t: { amount: i18n.money(c) } }} }</p>
            } @else {
              <p>{{ 'ws.mix.pickTwo' | t }}</p>
            }
            <p class="hint">{{ 'ws.mix.shareHint' | t }}</p>
            <button type="button" class="ws-btn primary" [disabled]="chosen().length < 2 || busy()" (click)="mix()">{{ 'ws.mix.do' | t }}</button>
          </section>
        }
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-4); max-width:960px; margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .rows { display:grid; margin:0; padding:0; list-style:none; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .rows li + li { border-block-start:1px solid var(--ws-line); }
    .rows label { display:flex; align-items:center; gap:var(--ws-3); min-height:56px; padding:var(--ws-2) var(--ws-4); cursor:pointer; }
    .rows input { width:20px; height:20px; flex:none; }
    .what { display:grid; flex:1; min-width:0; }
    .what small, .num small, .hint, .note { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .num { display:grid; justify-items:end; font-variant-numeric:tabular-nums; }
    .sum { display:grid; gap:var(--ws-2); justify-items:start; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .sum p, .note { margin:0; }
  `],
})
export class MixLotsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly lots = signal<WaitingLot[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly picked = signal<Set<string>>(new Set());
  protected readonly isText = (v: string | null): v is string => !!v;

  protected readonly chosen = computed(() => (this.lots() ?? []).filter((l) => this.picked().has(l.id)));
  protected readonly totalKg = computed(() => this.chosen().reduce((t, l) => t + Number(l.kg), 0));
  /** What a kg of the mix will cost, when this person may see costs. */
  protected readonly costPerKg = computed(() => {
    const lots = this.chosen();
    if (!lots.length || lots.some((l) => l.cost == null) || !this.totalKg()) return null;
    return Math.round((lots.reduce((t, l) => t + Number(l.cost), 0) / this.totalKg()) * 100) / 100;
  });

  constructor() {
    this.load();
  }

  protected share(l: WaitingLot): number {
    return (Number(l.kg) / this.totalKg()) * 100;
  }

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (!next.delete(id)) next.add(id);
    this.picked.set(next);
  }

  protected load(): void {
    this.failed.set(false);
    // Lots still waiting; a mix is not mixed again (take it apart first).
    const params = new HttpParams().set('pageSize', '200').append('f', 'status:eq:NOT_STARTED').append('f', 'source:ne:MIXED').set('sort', 'date:asc');
    this.http.get<{ rows: WaitingLot[] }>('/api/lists/lots', { params }).subscribe({ next: (r) => this.lots.set(r.rows), error: () => this.failed.set(true) });
  }

  protected mix(): void {
    this.busy.set(true);
    this.http.post<{ id: string; code: string }>('/api/sorting/stage-1/mix', { ragIds: this.chosen().map((l) => l.id) }).subscribe({
      next: (m) => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('ws.mix.done', { code: m.code }));
        void this.router.navigate(['/sort/records', m.id]);
      },
      error: (e: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.toast.error(e.error?.message ?? this.i18n.t('common.couldNotSave'));
        this.load();
      },
    });
  }
}
