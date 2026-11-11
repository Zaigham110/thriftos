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

type Money = string | null;
/** GET /api/workspace/sorting/:lotId (money is null without cost.view). */
export interface SortingRecord {
  lot: { id: string; code: string; status: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED'; kg: string; createdAt: string; source: string; origin: string | null; rawCategory: string | null; container: { id: string; number: string } | null; supplier: { id: string; name: string } | null; cost: Money; costPerKg: Money };
  session: { id: string; status: string; worker: string; supervisor: string; startTime: string; endTime: string | null; inputKg: string; outputKg: string; wasteKg: string } | null;
  categories: { id: string; name: string; kg: string; pieces: number; cost: Money; costPerKg: Money; sharePercent: number | null; usedKg: string; grading: { id: string; status: string; worker: string } | null; gradeTarget: string | null; gradedKg: string; wasteKg: string }[];
  grades: { name: string; kg: string; pieces: number; sharePercent: number | null; cost: Money }[];
  waste: { stage: string; category: string; amount: string; unit: string; value: Money }[];
  totals: { sortedKg: string; stage1WasteKg: string; stage2WasteKg: string; yieldPercent: number | null; topGradePercent: number | null; minutes: number | null; leftKg: string; progressPercent: number | null };
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
            <ws-smart-button [label]="'ws.lots.col.sorted' | t" [value]="i18n.kg(d.totals.sortedKg)" [icon]="icons.Layers3" [link]="[]" />
            @if (d.lot.status === 'SORTED') {
              <ws-smart-button [label]="'ws.lots.col.waste' | t" [value]="i18n.kg(wasteTotal())" [icon]="icons.Trash2" [link]="[]" />
            } @else {
              <ws-smart-button [label]="'ws.lots.col.left' | t" [value]="i18n.kg(d.totals.leftKg)" [icon]="icons.Scale" [link]="[]" />
            }
            <ws-smart-button [label]="'ws.containers.col.yield' | t" [value]="pct(d.totals.yieldPercent)" [icon]="icons.Percent" [tone]="(d.totals.yieldPercent ?? 100) < 80 ? 'bad' : 'plain'" [link]="[]" />
            <ws-smart-button [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.totals.topGradePercent)" [icon]="icons.Percent" [link]="[]" />
            @if (d.lot.costPerKg !== null) { <ws-smart-button [label]="'ws.containers.col.costPerKg' | t" [value]="i18n.money(d.lot.costPerKg)" [icon]="icons.Coins" [link]="[]" /> }
            @if (d.totals.minutes !== null) { <ws-smart-button [label]="'ws.sortRecord.time' | t" [value]="'ws.sortRecord.minutes' | t: { n: d.totals.minutes }" [icon]="icons.Clock" [link]="[]" /> }
          </section>
          @if (d.lot.status !== 'SORTED') {
            <div class="progress" role="progressbar" [attr.aria-label]="'ws.sortRecord.progress' | t" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="d.totals.progressPercent ?? 0">
              <i [style.width.%]="d.totals.progressPercent ?? 0"></i>
              <span>{{ 'ws.sortRecord.progressText' | t: { pct: i18n.num(d.totals.progressPercent ?? 0, 0), sorted: i18n.kg(d.totals.sortedKg), left: i18n.kg(d.totals.leftKg) } }}</span>
            </div>
          }

          @if (d.categories.length) {
            <div class="two">
              <ws-bar-chart [heading]="'ws.container.categories' | t" [categories]="categoryNames()" [series]="categorySeries()" format="kg" />
              <ws-data-grid [caption]="'ws.container.categories' | t" [columns]="categoryColumns()" [rows]="categoryRows()" [clickable]="true" (rowClick)="grade($event)" />
            </div>
            <div class="two">
              <ws-data-grid [caption]="'ws.container.grades' | t" [columns]="gradeColumns()" [rows]="gradeRows()" [emptyHeading]="'ws.container.notGraded' | t" />
              <ws-data-grid [caption]="'ws.sortRecord.waste' | t" [columns]="wasteColumns()" [rows]="wasteRows()" [emptyHeading]="'ws.sortRecord.noWaste' | t" />
            </div>
            <ws-data-grid [caption]="'ws.sortRecord.bales' | t" [columns]="baleColumns()" [rows]="baleRows()" [clickable]="stockOn()" (rowClick)="openBale($event)" [emptyHeading]="'ws.container.noBales' | t" />
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
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--ws-3); }
    .progress { position:relative; height:28px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); overflow:hidden; }
    .progress i { position:absolute; inset-block:0; inset-inline-start:0; background:var(--ws-brand-soft); }
    .progress span { position:relative; display:flex; align-items:center; height:100%; padding-inline:var(--ws-3); font-size:var(--ws-text-sm); color:var(--ws-ink); font-variant-numeric:tabular-nums; }
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
    return [d.lot.container?.number, d.lot.origin, d.lot.rawCategory, s ? this.i18n.t('ws.sortRecord.by', { name: s.worker }) : null, s?.endTime ? this.date(s.endTime) : null].filter(Boolean).join(' · ');
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
    (this.data()?.bales ?? []).map((b) => ({ ...b, state: this.i18n.t(b.sold ? 'ws.container.sold' : 'ws.container.inStock') })) as unknown as WsRow[],
  );
  protected openBale(row: WsRow): void {
    if (row['itemId']) void this.nav.open(['/stock/items', row['itemId']]);
  }

  protected readonly categoryColumns = computed(() => [
    this.col('name', 'ws.container.category'), this.col('kg', 'ws.containers.col.kg', 'kg', true), this.col('sharePercent', 'ws.sortRecord.share', 'percent'),
    ...(this.cost() ? [this.col('costPerKg', 'ws.containers.col.costPerKg', 'money')] : []), this.col('graded', 'ws.sortRecord.graded'),
  ]);
  protected readonly categoryRows = computed<WsRow[]>(() =>
    (this.data()?.categories ?? []).map((c) => ({
      ...c, graded: c.grading ? `${this.i18n.kg(c.gradedKg)} · ${this.i18n.t(c.grading.status === 'CLOSED' ? 'ws.sortRecord.done' : 'ws.lotStatus.IN_SORTING')}` : c.gradeTarget ? `${this.i18n.t('sort.gradeIt')} →` : '—',
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
}
