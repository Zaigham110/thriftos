import { HttpClient } from '@angular/common/http';
import { TenantService } from '../../core/tenant/tenant.service';
import { NavService } from '../../core/nav/nav.service';
import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Clock, Coins, Layers3, LucideAngularModule, Percent, Play, Scale, Trash2, Pencil } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsBarChartComponent,
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSmartButtonComponent,
  WsStateComponent,
  WsStatusPipelineComponent,
} from '../../shared/ui/workspace';
import { withTones } from '../../shared/ui/workspace/status-tone';

type Money = string | null;
/** GET /api/workspace/sorting/:lotId (money is null without cost.view). */
export interface SortingRecord {
  lot: { id: string; code: string; status: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED'; kg: string; createdAt: string; source: string; origin: string | null; rawCategory: string | null; container: { id: string; number: string } | null; supplier: { id: string; name: string } | null; cost: Money; costPerKg: Money; labour?: Money };
  /** A loose lot's price and extra charges (only for people who may see cost). */
  purchase: { price: string; ratePerKg: string | null; pieces?: number | null; ratePerPiece?: string | null; charges: { kind: string; amount: string; note: string | null }[]; total: string } | null;
  session: { id: string; status: string; worker: string; supervisor: string; startTime: string; endTime: string | null; inputKg: string; outputKg: string; wasteKg: string } | null;
  categories: { id: string; name: string; kg: string; pieces: number; cost: Money; costPerKg: Money; sharePercent: number | null; usedKg: string; grading: { id: string; status: string; worker: string } | null; gradeTarget: string | null; gradedKg: string; gradedAs: { name: string; kg: string }[]; gradedWhileSorting: boolean; wasteKg: string }[];
  grades: { name: string; kg: string; pieces: number; sharePercent: number | null; cost: Money }[];
  waste: { stage: string; category: string; amount: string; unit: string; value: Money }[];
  totals: { sortedKg: string; stage1WasteKg: string; stage2WasteKg: string; yieldPercent: number | null; topGradePercent: number | null; minutes: number | null; notBaledKg?: string | null; leftKg: string; progressPercent: number | null; sortedPieces?: number | null; piecesLeft?: number | null };
  /** What the lot has earned so far (profit only with cost.view). */
  sold?: { revenue: string; profit: Money };
  bales: { id: string; itemId: string | null; code: string; category: string | null; grade: string | null; kg: string; sold: boolean; cost: Money }[];
}

const STEPS = ['NOT_STARTED', 'IN_SORTING', 'SORTED'] as const;

/**
 * A lot's sorting record (enterprise plan E3.2): what went in, what came out by category (with its cost and
 * share) and by grade, the waste at each stage, yield and A grade, who sorted it and how long it took.
 */
@Component({
  selector: 'app-sorting-record',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsBarChartComponent, WsDataGridComponent, WsPageHeaderComponent, WsRecordActivityComponent, WsSmartButtonComponent, WsStateComponent, WsStatusPipelineComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.sortRecord.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="d.lot.code + (d.lot.supplier ? ' · ' + d.lot.supplier.name : '')" [subtitle]="subtitle()">
            @if (d.lot.source === 'LOOSE_BALE' && can('rag.create')) {
              <a actions class="ws-btn" [routerLink]="['/receive/records/lots', d.lot.id, 'edit']" [state]="nav.trailState()"><lucide-icon [img]="icons.Pencil" [size]="16" aria-hidden="true" />{{ 'ws.container.edit' | t }}</a>
            }
            @if (d.lot.status !== 'SORTED') {
              <a actions class="ws-btn primary" [routerLink]="['/sort', d.lot.id]" [state]="nav.trailState()"><lucide-icon [img]="icons.Play" [size]="16" aria-hidden="true" />{{ (d.lot.status === 'NOT_STARTED' ? 'ws.sortRecord.start' : 'ws.sortRecord.continue') | t }}</a>
            }
          </ws-page-header>
          <ws-status-pipeline [steps]="steps()" [current]="stepIndex()" [label]="'ws.col.status' | t" />

          <section class="smart">
            <ws-smart-button [label]="'ws.sortRecord.input' | t" [value]="i18n.kg(d.lot.kg)" [icon]="icons.Scale" [link]="[]" />
            <ws-smart-button [label]="'ws.lots.col.sorted' | t" [value]="amount(d.totals.sortedPieces, d.totals.sortedKg)" [icon]="icons.Layers3" [link]="[]" />
            @if (d.lot.status === 'SORTED') {
              <ws-smart-button [label]="'ws.lots.col.waste' | t" [value]="i18n.kg(wasteTotal())" [icon]="icons.Trash2" [link]="[]" />
            } @else {
              <ws-smart-button [label]="'ws.lots.col.left' | t" [value]="amount(d.totals.piecesLeft, d.totals.leftKg)" [icon]="icons.Scale" [link]="[]" />
            }
            <!-- While sorting: how far it has got; once sorted: the yield (v2 cycle review: it showed "—" while sorting). -->
            <ws-smart-button [label]="'ws.containers.col.yield' | t" [value]="d.lot.status === 'NOT_STARTED' ? '—' : pct(d.totals.yieldPercent ?? d.totals.progressPercent)" [icon]="icons.Percent" [tone]="d.lot.status === 'SORTED' && (d.totals.yieldPercent ?? 100) < 80 ? 'bad' : 'plain'" [link]="[]" />
            <ws-smart-button [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.totals.topGradePercent)" [icon]="icons.Percent" [link]="[]" />
            @if (d.lot.costPerKg !== null) { <ws-smart-button [label]="'ws.sortRecord.boughtPerKg' | t" [value]="i18n.money(d.lot.costPerKg)" [icon]="icons.Coins" [link]="[]" /> }
            @if (sortedCostPerKg(); as c) { <ws-smart-button [label]="'ws.sortRecord.sortedCostPerKg' | t" [value]="i18n.money(c)" [icon]="icons.Coins" [link]="[]" /> }
            <!-- What the lot earned (v2 review). "Time taken" is gone: it was the minutes between Start and Close on the screen. -->
            @if (d.sold && d.bales.length) {
              <ws-smart-button [label]="'ws.containers.col.revenue' | t" [value]="rs(d.sold.revenue)" [icon]="icons.Coins" [link]="[]" />
              @if (d.sold.profit !== null) { <ws-smart-button [label]="'ws.containers.col.profit' | t" [value]="rs(d.sold.profit)" [icon]="icons.Coins" [tone]="+d.sold.profit < 0 ? 'bad' : 'plain'" [link]="[]" /> }
            }
          </section>
          @if (d.purchase; as p) {
            <section class="paid" [attr.aria-label]="'ws.sortRecord.paid' | t">
              <h2>{{ 'ws.sortRecord.paid' | t }}</h2>
              <dl>
                <div><dt>{{ 'ws.lf.pricePaid' | t }}@if (p.ratePerKg) { <small>{{ i18n.kg(d.lot.kg) }} × {{ i18n.money(p.ratePerKg) }}</small> } @else if (p.ratePerPiece && p.pieces) { <small>{{ 'ws.lf.piecesN' | t: { n: i18n.num(p.pieces) } }} × {{ i18n.money(p.ratePerPiece) }}</small> }</dt><dd>{{ i18n.money(p.price) }}</dd></div>
                @for (c of p.charges; track $index) {
                  <div><dt>{{ ('ws.lf.kind.' + c.kind) | t }}@if (c.note) { <small>{{ c.note }}</small> }</dt><dd>{{ i18n.money(c.amount) }}</dd></div>
                }
                <div class="total"><dt>{{ 'ws.lf.lotCost' | t }}</dt><dd>{{ i18n.money(p.total) }}</dd></div>
                @if (d.lot.labour && +d.lot.labour > 0) { <div><dt>{{ 'pay.lotLabour' | t }}<small>{{ 'pay.lotLabourHint' | t }}</small></dt><dd>{{ i18n.money(d.lot.labour) }}</dd></div> }
                @if (p.pieces) { <div><dt>{{ 'ws.lf.costPerPiece' | t }}<small>{{ 'ws.lf.piecesN' | t: { n: i18n.num(p.pieces) } }}</small></dt><dd>{{ i18n.money(round2(+p.total / p.pieces)) }}</dd></div> }
              </dl>
              <p class="hint">{{ 'ws.sortRecord.papersHint' | t }}</p>
            </section>
          }

          @if (d.categories.length) {
            <div class="two">
              <ws-bar-chart [heading]="'ws.container.categories' | t" [categories]="categoryNames()" [series]="categorySeries()" format="kg" />
              <ws-data-grid [caption]="'ws.container.categories' | t" [columns]="categoryColumns()" [rows]="categoryRows()" [clickable]="true" (rowClick)="grade($event)" />
            </div>
            <div class="two">
              <section class="block"><h2>{{ 'ws.container.grades' | t }}</h2><ws-data-grid [caption]="'ws.container.grades' | t" [columns]="gradeColumns()" [rows]="gradeRows()" [emptyHeading]="'ws.container.notGraded' | t" /></section>
              <section class="block"><h2>{{ 'ws.sortRecord.waste' | t }}</h2><ws-data-grid [caption]="'ws.sortRecord.waste' | t" [columns]="wasteColumns()" [rows]="wasteRows()" [emptyHeading]="'ws.sortRecord.noWaste' | t" /></section>
            </div>
            <section class="block">
              <h2>{{ 'ws.sortRecord.bales' | t }}</h2>
              @if (d.totals.notBaledKg && +d.totals.notBaledKg >= 0.05) { <p class="note">{{ 'ws.sortRecord.notBaled' | t: { kg: i18n.kg(d.totals.notBaledKg) } }}</p> }
              <!-- One row per item (v2 review: 41 bales were 41 rows); the full list opens on demand. -->
              <ws-data-grid [caption]="'ws.sortRecord.bales' | t" [columns]="baleSummaryColumns()" [rows]="baleSummaryRows()" [emptyHeading]="'ws.container.noBales' | t" />
              @if (d.bales.length) {
                <button type="button" class="ws-btn more" [attr.aria-expanded]="allBales()" (click)="allBales.set(!allBales())">{{ (allBales() ? 'ws.sortRecord.hideBales' : 'ws.sortRecord.showBales') | t: { n: i18n.num(d.bales.length) } }}</button>
              }
              @if (allBales()) {
                <ws-data-grid [caption]="'ws.sortRecord.bales' | t" [columns]="baleColumns()" [rows]="baleRows()" [clickable]="stockOn()" (rowClick)="openBale($event)" />
              }
            </section>
          } @else {
            <ws-state kind="empty" [heading]="'ws.container.notSorted' | t" />
          }
        </div>
        <aside class="side"><ws-record-activity type="lot" [recordId]="d.lot.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .paid { padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg, 12px); background:var(--ws-surface); }
    .paid h2 { margin:0 0 var(--ws-2); font-size:var(--ws-text-md, 15px); }
    .paid dl { display:grid; gap:6px; margin:0; }
    .paid dl > div { display:flex; justify-content:space-between; gap:var(--ws-3); }
    .paid dt { display:grid; color:var(--ws-ink-2, inherit); }
    .paid dt small { color:var(--ws-muted); font-size:12px; }
    .paid dd { margin:0; font-variant-numeric:tabular-nums; }
    .paid .total { padding-top:6px; border-top:1px solid var(--ws-line); font-weight:700; }
    .paid .hint { margin:var(--ws-2) 0 0; color:var(--ws-muted); font-size:12px; }
    .block { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-2); }
    .block h2 { margin:0; font-size:var(--ws-text-md, 15px); font-weight:600; }
    .block .note { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .block .more { justify-self:start; }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--ws-3); }
    /* Side by side only when each half fits its whole table (v2 sorting review: cost per kg was cut off). */
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap:var(--ws-4); align-items:start; }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class SortingRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly id = input.required<string>();
  protected readonly nav = inject(NavService);
  /** The breadcrumb and browser tab name this record once it has loaded. */
  private readonly crumbName = effect(() => {
    const d = this.data();
    const id = this.id();
    if (d && id) this.nav.setName(id, d.lot.code);
  });
  private readonly auth = inject(AuthService);
  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }
  protected readonly icons = { Clock, Coins, Layers3, Pencil, Percent, Play, Scale, Trash2 };
  protected readonly data = signal<SortingRecord | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);

  protected readonly steps = computed(() => STEPS.map((s) => this.i18n.t(`ws.lotStatus.${s}`)));
  protected readonly stepIndex = computed(() => Math.max(0, STEPS.indexOf(this.data()?.lot.status ?? 'NOT_STARTED')));
  protected readonly subtitle = computed(() => {
    const d = this.data();
    if (!d) return '';
    const s = d.session;
    // Each date says what it is (v2 review): when the lot was bought (or received in its container) and when it was sorted.
    const got = this.i18n.t(d.lot.container ? 'ws.sortRecord.receivedOn' : 'ws.sortRecord.boughtOn', { date: this.date(d.lot.createdAt) });
    const sorted = s?.endTime ? `${this.i18n.t('ws.sortRecord.sortedOn', { date: this.date(s.endTime) })} ${this.i18n.t('ws.sortRecord.by', { name: s.worker })}` : s ? this.i18n.t('ws.sortRecord.by', { name: s.worker }) : null;
    return [d.lot.container?.number, d.lot.origin, d.lot.rawCategory, got, sorted].filter(Boolean).join(' · ');
  });
  protected readonly wasteTotal = computed(() => {
    const t = this.data()?.totals;
    return t ? String(Number(t.stage1WasteKg) + Number(t.stage2WasteKg)) : '0';
  });
  protected readonly categoryNames = computed(() => (this.data()?.categories ?? []).map((c) => c.name));
  protected readonly categorySeries = computed(() => [{ label: this.i18n.t('ws.containers.col.kg'), values: (this.data()?.categories ?? []).map((c) => Number(c.kg)) }]);

  private col(key: string, label: string, format?: WsColumn['format'], total?: boolean): WsColumn {
    return { key, label: this.i18n.t(label), format, total };
  }
  private readonly cost = computed(() => this.data()?.lot.cost !== null);
  private readonly tenants = inject(TenantService);
  /** Bales open their stock page only when this business uses Stock. */
  protected readonly stockOn = computed(() => this.tenants.isModuleEnabled('STOCK', this.tenants.tenant()));
  protected readonly baleColumns = computed<WsColumn[]>(() => [
    { key: 'code', label: this.i18n.t('ws.container.bale') },
    { key: 'category', label: this.i18n.t('ws.container.category') },
    { key: 'grade', label: this.i18n.t('ws.container.grade') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
    { key: 'state', label: this.i18n.t('ws.col.status') },
    ...(this.data()?.lot.cost !== null ? [{ key: 'cost', label: this.i18n.t('ws.cr.baleCost'), format: 'money' as const, total: true, round: true, info: this.i18n.t('ws.sortRecord.baleCostInfo') }] : []),
  ]);
  protected readonly baleRows = computed<WsRow[]>(() =>
    (this.data()?.bales ?? []).map((b) => withTones({ ...b, state: this.i18n.t(b.sold ? 'ws.container.sold' : 'ws.container.inStock') }, { state: b.sold ? 'SOLD' : 'AVAILABLE' })) as unknown as WsRow[],
  );
  /** The full bale list is closed until asked for. */
  protected readonly allBales = signal(false);
  protected readonly baleSummaryColumns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('bill.item') },
    { key: 'bales', label: this.i18n.t('ws.sortRecord.baleCount'), format: 'number', total: true },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
    { key: 'sold', label: this.i18n.t('ws.container.sold'), format: 'number', total: true },
    { key: 'inStock', label: this.i18n.t('ws.container.inStock'), format: 'number', total: true },
    ...(this.data()?.lot.cost !== null ? [{ key: 'cost', label: this.i18n.t('ws.cr.baleCost'), format: 'money' as const, total: true, round: true, info: this.i18n.t('ws.sortRecord.baleCostInfo') }] : []),
  ]);
  /** Bales of one category and grade are one row: how many, their kg, how many sold and still in stock. */
  protected readonly baleSummaryRows = computed<WsRow[]>(() => {
    const by = new Map<string, { id: string; name: string; bales: number; kg: number; sold: number; inStock: number; cost: number }>();
    for (const b of this.data()?.bales ?? []) {
      const name = [b.category, b.grade].filter(Boolean).join(' · ') || '—';
      const r = by.get(name) ?? { id: name, name, bales: 0, kg: 0, sold: 0, inStock: 0, cost: 0 };
      r.bales += 1;
      r.kg += Number(b.kg);
      r.sold += b.sold ? 1 : 0;
      r.inStock += b.sold ? 0 : 1;
      r.cost += Number(b.cost ?? 0);
      by.set(name, r);
    }
    return [...by.values()].sort((a, b) => b.kg - a.kg) as unknown as WsRow[];
  });
  protected rs(v: string | number | null | undefined): string {
    return v === null || v === undefined || v === '' ? '—' : this.i18n.money(Math.round(Number(v)));
  }
  protected openBale(row: WsRow): void {
    if (row['itemId']) void this.nav.open(['/stock/items', row['itemId']]);
  }

  protected readonly categoryColumns = computed(() => [
    this.col('name', 'ws.container.category'), this.col('kg', 'ws.containers.col.kg', 'kg', true), this.col('sharePercent', 'ws.sortRecord.share', 'percent'),
    ...(this.cost() ? [this.col('costPerKg', 'ws.containers.col.costPerKg', 'money')] : []), this.col('graded', 'ws.sortRecord.graded'),
  ]);
  protected readonly categoryRows = computed<WsRow[]>(() =>
    (this.data()?.categories ?? []).map((c) => ({
      ...c, graded: this.gradedText(c),
    })) as unknown as WsRow[],
  );
  protected readonly gradeColumns = computed(() => [
    this.col('name', 'ws.container.grade'), this.col('kg', 'ws.containers.col.kg', 'kg', true), this.col('sharePercent', 'ws.sortRecord.share', 'percent'),
    ...(this.cost() ? [this.col('cost', 'ws.col.cost', 'money', true)] : []),
  ]);
  protected readonly gradeRows = computed<WsRow[]>(() => (this.data()?.grades ?? []).map((g) => ({ id: g.name, ...g })));
  protected readonly wasteColumns = computed(() => [
    this.col('stage', 'ws.sortRecord.stage'), this.col('category', 'ws.container.category'), this.col('amount', 'ws.sortRecord.amount'),
    ...(this.cost() ? [this.col('value', 'ws.sortRecord.resale', 'money', true)] : []),
  ]);
  protected readonly wasteRows = computed<WsRow[]>(() =>
    (this.data()?.waste ?? []).map((w, i) => ({
      id: String(i), ...w, stage: this.i18n.t(`ws.sortRecord.stage${w.stage === 'STAGE_1' ? 1 : 2}`), amount: w.unit === 'KG' ? this.i18n.kg(w.amount) : this.i18n.num(w.amount),
    })),
  );

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) => this.http.get<SortingRecord>(`/api/workspace/sorting/${id}`).pipe(map((d) => ({ ok: true as const, d })), catchError(() => of({ ok: false as const })))),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.d);
      });
  }

  /**
   * The Graded column: what a grading made of the row ("A 200.0 kg · B 80.0 kg"), grading still going on, "While
   * sorting" for a row given its grade as it was sorted (Bedsheets · A), "Grade it →" where grading can start.
   */
  private gradedText(c: SortingRecord['categories'][number]): string {
    if (c.grading?.status === 'CLOSED') return c.gradedAs.length ? c.gradedAs.map((g) => `${g.name} ${this.i18n.kg(g.kg)}`).join(' · ') : this.i18n.t('ws.sortRecord.done');
    if (c.grading) return `${this.i18n.kg(c.gradedKg)} · ${this.i18n.t('ws.sortRecord.gradingNow')}`;
    if (c.gradedWhileSorting) return this.i18n.t('ws.sortRecord.gradedWhileSorting');
    if (c.gradeTarget) return `${this.i18n.t('sort.gradeIt')} →`;
    return '—';
  }

  /** Once sorted: what each sellable kg cost (the lot's cost over the kg that came out). */
  protected readonly sortedCostPerKg = computed(() => {
    const d = this.data();
    if (!d || d.lot.status !== 'SORTED' || d.lot.cost === null || !Number(d.totals.sortedKg)) return null;
    return String(Math.round((Number(d.lot.cost) / Number(d.totals.sortedKg)) * 100) / 100);
  });

  protected pct(v: number | null): string {
    return v === null ? '—' : `${this.i18n.num(v, 0)}%`;
  }
  private date(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
  }
  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }
  /** Grade a category (or continue grading) on the sorting screen. */
  protected grade(row: WsRow): void {
    const c = (this.data()?.categories ?? []).find((x) => x.id === row.id);
    // Only an entry that can be graded opens grading (one ungraded entry, not in bales, not graded yet).
    if (c?.gradeTarget) void this.router.navigate(['/sort/grade', c.gradeTarget]);
  }

  protected round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Pieces for a lot bought by the piece ("320 pcs"), else kg. */
  protected amount(pieces: number | null | undefined, kg: string): string {
    return pieces !== null && pieces !== undefined ? this.i18n.t('ws.lf.piecesN', { n: this.i18n.num(pieces) }) : this.i18n.kg(kg);
  }
}
