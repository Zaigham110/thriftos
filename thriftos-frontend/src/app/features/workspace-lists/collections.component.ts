import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, MessageCircle } from 'lucide-angular';
import { I18nService, serverLang } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { KhataService, WhatsappMessage } from '../../modules/sales/khata.service';
import { ToastService } from '../../shared/floor/toast.service';
import {
  WsBarChartComponent,
  WsColumn,
  WsDataGridComponent,
  WsFilterBarComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsRow,
  WsSideSheetComponent,
  WsStateComponent,
} from '../../shared/ui/workspace';

export const AGE_KEYS = ['0-30', '31-60', '61-90', '90+'] as const;
type Buckets = Record<(typeof AGE_KEYS)[number], string>;
type PromiseStatus = 'OPEN' | 'DUE_TODAY' | 'KEPT' | 'BROKEN' | 'CANCELLED';
export interface WorklistRow {
  id: string; name: string; phone: string | null; city: string | null; balance: string; buckets: Buckets; overdueDays: number;
  creditLimit: string | null; overLimit: boolean; lastPayment: { date: string; amount: string } | null; lastReminder: string | null;
  promise: { id: string; amount: string; promisedFor: string; status: PromiseStatus; paid: string } | null;
}
export interface Worklist {
  totals: { owed: string; advance: string; customers: number; buckets: Buckets };
  rows: WorklistRow[];
}

type View = 'all' | 'today' | 'broken' | 'old' | 'overLimit' | 'notReminded';
const WEEK = 7 * 86_400_000;

/**
 * Receivables (enterprise plan E3.5): who owes what and for how long (ageing 0–30 / 31–60 / 61–90 / 90+),
 * promises to pay, last payment and reminder — a worklist for the day's collection calls. Select customers to
 * send WhatsApp reminders one after another (each opens WhatsApp with the message ready).
 */
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe, WsBarChartComponent, WsDataGridComponent, WsFilterBarComponent, WsKpiCardComponent, WsPageHeaderComponent, WsSideSheetComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="page">
        <ws-page-header [heading]="'ws.collections.title' | t" [subtitle]="'ws.collections.subtitle' | t: { n: i18n.num(d.totals.customers) }" />
        <section class="kpis">
          <ws-kpi-card [label]="'ws.collections.owed' | t" [value]="i18n.money(d.totals.owed)" />
          <ws-kpi-card [label]="'ws.collections.over90' | t" [value]="i18n.money(d.totals.buckets['90+'])" [hint]="'ws.collections.over90Hint' | t" />
          <ws-kpi-card [label]="'ws.collections.dueToday' | t" [value]="i18n.num(count('today'))" />
          <ws-kpi-card [label]="'ws.collections.broken' | t" [value]="i18n.num(count('broken'))" />
        </section>
        <div class="two">
          <ws-bar-chart [heading]="'ws.collections.ageing' | t" [categories]="ageLabels()" [series]="ageSeries()" format="money" />
          <ws-data-grid [caption]="'ws.collections.ageing' | t" [columns]="ageColumns()" [rows]="ageRows()" />
        </div>

        <div class="views" role="group" [attr.aria-label]="'ws.collections.show' | t">
          @for (v of views; track v) {
            <button type="button" class="ws-btn" [class.on]="view() === v" [attr.aria-pressed]="view() === v" (click)="view.set(v); selected.set([])">
              {{ 'ws.collections.view.' + v | t }} <span class="n">{{ count(v) }}</span>
            </button>
          }
        </div>
        <ws-filter-bar [query]="query()" (queryChange)="query.set($event)" [placeholder]="'ws.collections.search' | t" [chips]="[]" />

        <ws-data-grid [caption]="'ws.collections.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" [selectable]="true"
          [(selected)]="selected" (rowClick)="open($event)" [emptyHeading]="'ws.collections.empty' | t">
          <button bulk type="button" class="ws-btn primary" (click)="startReminders()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.collections.remind' | t: { n: selected().length } }}</button>
        </ws-data-grid>
      </div>

      <ws-side-sheet [open]="queue().length > 0" [heading]="'ws.collections.reminders' | t" (close)="queue.set([])">
        @if (current(); as c) {
          <div class="queue">
            <p class="step">{{ 'ws.collections.step' | t: { i: position() + 1, n: queue().length } }}</p>
            <h3>{{ c.name }}</h3>
            <p>{{ i18n.money(c.balance) }} · {{ c.phone ?? ('ws.collections.noPhone' | t) }}</p>
            @if (c.lastReminder) { <p class="muted">{{ 'ws.collections.lastReminder' | t: { date: date(c.lastReminder) } }}</p> }
            <div class="row">
              <button type="button" class="ws-btn primary" [disabled]="!c.phone" (click)="remind(c)"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.collections.openWhatsapp' | t }}</button>
              <button type="button" class="ws-btn" (click)="next()">{{ (position() + 1 < queue().length ? 'ws.collections.next' : 'ws.collections.done') | t }}</button>
            </div>
            <p class="muted">{{ 'ws.collections.queueHint' | t }}</p>
          </div>
        }
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:var(--ws-4); align-items:start; }
    .views { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .views .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
    .n { padding:0 6px; border-radius:10px; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .queue { display:grid; gap:var(--ws-2); }
    .queue h3 { margin:0; font-size:var(--ws-text-lg, 1.125rem); }
    .queue p { margin:0; }
    .step, .muted { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .row { display:flex; flex-wrap:wrap; gap:var(--ws-2); margin-block:var(--ws-2); }
  `],
})
export class CollectionsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly khata = inject(KhataService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { MessageCircle };
  protected readonly views: View[] = ['all', 'today', 'broken', 'old', 'overLimit', 'notReminded'];

  protected readonly data = signal<Worklist | null>(null);
  protected readonly failed = signal(false);
  protected readonly view = signal<View>('all');
  protected readonly query = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly queue = signal<WorklistRow[]>([]);
  protected readonly position = signal(0);
  protected readonly current = computed(() => this.queue()[this.position()] ?? null);

  protected readonly ageLabels = computed(() => AGE_KEYS.map((k) => this.i18n.t(`ws.stockValue.age.${k}`)));
  protected readonly ageSeries = computed(() => [{ label: this.i18n.t('ws.collections.owed'), values: AGE_KEYS.map((k) => Number(this.data()?.totals.buckets[k] ?? 0)) }]);

  protected readonly ageColumns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.stockValue.ageCol') },
    { key: 'customers', label: this.i18n.t('ws.collections.customers'), format: 'number' },
    { key: 'amount', label: this.i18n.t('ws.collections.owed'), format: 'money', total: true },
  ]);
  protected readonly ageRows = computed<WsRow[]>(() =>
    AGE_KEYS.map((k) => ({
      id: k, name: this.i18n.t(`ws.stockValue.age.${k}`), amount: this.data()?.totals.buckets[k] ?? '0',
      customers: (this.data()?.rows ?? []).filter((r) => +r.buckets[k] > 0).length,
    })),
  );

  private match(r: WorklistRow, v: View, now = Date.now()): boolean {
    switch (v) {
      case 'today': return r.promise?.status === 'DUE_TODAY';
      case 'broken': return r.promise?.status === 'BROKEN';
      case 'old': return +r.buckets['61-90'] > 0 || +r.buckets['90+'] > 0;
      case 'overLimit': return r.overLimit;
      case 'notReminded': return !r.lastReminder || now - new Date(r.lastReminder).getTime() > WEEK;
      default: return true;
    }
  }
  protected count(v: View): number {
    return (this.data()?.rows ?? []).filter((r) => this.match(r, v)).length;
  }
  private readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.data()?.rows ?? []).filter((r) => this.match(r, this.view()) && (!q || r.name.toLowerCase().includes(q) || (r.city ?? '').toLowerCase().includes(q) || (r.phone ?? '').includes(q)));
  });

  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.col.customer') },
    { key: 'city', label: this.i18n.t('ws.col.city') },
    { key: 'balance', label: this.i18n.t('ws.collections.balance'), format: 'money', total: true },
    ...AGE_KEYS.map((k) => ({ key: `age${k}`, label: this.i18n.t(`ws.stockValue.age.${k}`), format: 'money' as const, total: true })),
    { key: 'promise', label: this.i18n.t('ws.collections.promise') },
    { key: 'lastPayment', label: this.i18n.t('ws.collections.lastPayment') },
    { key: 'lastReminder', label: this.i18n.t('ws.collections.reminded'), format: 'date' },
  ]);
  protected readonly rows = computed<WsRow[]>(() =>
    this.filtered().map((r) => ({
      id: r.id, name: r.overLimit ? `${r.name} · ${this.i18n.t('ws.collections.overLimitTag')}` : r.name, city: r.city, balance: r.balance,
      ...Object.fromEntries(AGE_KEYS.map((k) => [`age${k}`, r.buckets[k]])),
      promise: r.promise ? `${this.i18n.money(r.promise.amount)} · ${this.dayLabel(r.promise.promisedFor)} · ${this.i18n.t(`ws.promise.${r.promise.status}`)}` : null,
      lastPayment: r.lastPayment ? `${this.i18n.money(r.lastPayment.amount)} · ${this.date(r.lastPayment.date)}` : null,
      lastReminder: r.lastReminder,
    })),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Worklist>('/api/workspace/receivables').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }

  protected date(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', numberingSystem: 'latn' });
  }
  protected dayLabel(ymd: string): string {
    return this.date(ymd + 'T12:00:00Z');
  }

  protected open(row: WsRow): void {
    void this.router.navigate(['/khata/records', row.id]);
  }

  protected startReminders(): void {
    const ids = new Set(this.selected());
    this.position.set(0);
    this.queue.set(this.filtered().filter((r) => ids.has(r.id)));
  }

  protected remind(c: WorklistRow): void {
    this.khata.openWhatsapp(this.http.post<WhatsappMessage>(`/api/workspace/customers/${c.id}/remind`, { lang: serverLang(this.i18n.lang()) }), () =>
      this.toast.show(this.i18n.t('common.couldNotLoad')),
    );
  }

  protected next(): void {
    if (this.position() + 1 < this.queue().length) {
      this.position.set(this.position() + 1);
      return;
    }
    this.toast.show(this.i18n.t('ws.collections.sent', { n: this.queue().length }));
    this.queue.set([]);
    this.selected.set([]);
    this.load();
  }
}
