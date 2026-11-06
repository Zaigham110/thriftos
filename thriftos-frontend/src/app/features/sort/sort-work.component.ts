import { Component, DestroyRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { WsPageHeaderComponent } from '../../shared/ui/workspace/page-header.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, Minus, Plus, Printer } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { CategoryRow, FloorDataService, Named, ReadyRow, SessionOutput, SortSummary, WasteType, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

type Stage = 1 | 2;
type Mode = 'bales' | 'kg';
const WASTE_TILE = '__waste__';
const BALE_KG_KEY = 'thriftos.baleKg';
const GRADE_KEY = 'thriftos.sortGrade';

/** One tile while sorting: a category (stage 1, v2 6.6) or a grade (stage 2). */
interface Kind {
  id: string;
  name: string;
  categoryId: string;
  gradeId: string | null;
  baleKg: number | null;
}

/**
 * The sheet: sorting an entry for the tile just tapped (bales or loose kg, grade optional), or making bales from
 * this lot's sorted kg ("Make bales" on a ready row).
 */
interface Entry {
  purpose: 'sort' | 'bale';
  kind: Kind;
  /** For "Make bales": the sorted kg it takes from. */
  ready: ReadyRow | null;
  mode: Mode;
  /** Grade given now; null = no grade. */
  gradeId: string | null;
  bales: number;
  baleKg: number | null;
  kg: number | null;
}

const kindKey = (categoryId: string, gradeId: string | null) => `${categoryId}:${gradeId ?? ''}`;

/**
 * Journey 2 — sorting a lot (gaari). Since v2 6.6 one step sorts, grades and bales: big tiles are category + grade
 * (CCR 1, Baby 2…); tap one, then enter bales (count × kg per bale, pre-filled) or loose kg. Bales go straight into
 * stock with QR stickers; loose kg can be baled at once. The lot stays open for days; Today shows what came out today.
 * "Close lot" when the gaari is finished: what is left is kat — into stock, to sell or throw away.
 * Stage 2 (grading a category output separately) is kept for lots sorted before.
 * Every entry goes through the offline queue; Undo takes the last one back for 10 s.
 */
@Component({
  selector: 'app-sort-work',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent, TilesComponent, WsPageHeaderComponent],
  template: `
    <section class="floor" [class.wide]="desktop">
      @if (desktop) {
        <!-- Laptop: the shared header (breadcrumb lined up with the heading) and the way to the lot's page. -->
        <ws-page-header [heading]="title()" [subtitle]="(stage() === 1 ? 'sort.title' : 'sort.grading') | t">
          @if (stage() === 1) {
            <a actions class="ws-btn" [routerLink]="['/sort/records', id()]" [state]="nav.trailState()">{{ 'ws.sortRecord.openLot' | t }}</a>
          }
        </ws-page-header>
      } @else {
        <header class="floor-head">
          <a class="icon-btn back" routerLink="/sort" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
          <h1>{{ title() }}<span class="sub">{{ (stage() === 1 ? 'sort.title' : 'sort.grading') | t }}</span></h1>
        </header>
      }

      @if (result(); as r) {
        <section class="card">
          <h2><lucide-icon [img]="icons.CheckCircle2" [size]="22" class="good" /> {{ 'sort.closed' | t }} · {{ 'sort.yield' | t }}</h2>
          <ul class="list">
            @for (o of r; track o.id) {
              <li class="row"><span><strong>{{ o.name }}</strong><small>{{ 'unit.percent' | t: { n: pct(o.weightKg) } }}@if (o.bales) { · {{ o.bales | num }} {{ (o.bales === 1 ? 'unit.bale' : 'unit.bales') | t }} }</small></span>
                <span class="amount">{{ o.weightKg | kg }}@if (o.costPerKg) { <small>{{ 'sort.costPerKg' | t: { rs: (o.costPerKg | rs) } }}</small> }</span></li>
            }
            <li class="row"><span><strong>{{ 'sort.kat' | t }}</strong><small>{{ 'unit.percent' | t: { n: pct(wasteAtClose()) } }}</small></span><span class="amount">{{ wasteAtClose() | kg }}</span></li>
          </ul>
          @if (!closedOnline()) { <p class="hint">{{ 'sync.savedOnPhone' | t }}</p> }
        </section>
        @if (kat(); as k) {
          <section class="card kat">
            @if (+k.leftKg > 0) {
              <h2>{{ 'sort.katInStock' | t: { kg: (k.leftKg | kg) } }}</h2>
              <p class="hint">{{ 'sort.katHint' | t }}</p>
              <button type="button" class="btn" [disabled]="throwing()" (click)="throwAway(k.id)">{{ 'sort.katThrowAway' | t }}</button>
            } @else {
              <p class="hint">{{ 'sort.katDone' | t }}</p>
            }
          </section>
        }
        <a class="btn primary block" [routerLink]="desktop && stage() === 1 ? ['/sort/records', id()] : '/sort'">{{ (desktop && stage() === 1 ? 'ws.sortRecord.openLot' : 'common.done') | t }}</a>
      } @else {
        <div class="work">
        <div class="side">
        <div class="totals" aria-live="polite">
          <div><small>{{ 'sort.sortedLabel' | t }}</small><strong>{{ sortedKg() | kg }}</strong></div>
          <div [class.warn]="leftKg() < 0"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ leftKg() | kg }}</strong></div>
        </div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="donePct()" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="donePct()"></i></div>
        @if (stage() === 1 && today(); as td) {
          <p class="today">{{ 'sort.today' | t: { bales: (td.bales | num), kg: (td.kg | kg) } }}@if (totalBales()) { · {{ 'sort.allBales' | t: { n: (totalBales() | num) } }} }</p>
        }

        @if (lastBales(); as lb) {
          <a class="card printed" [routerLink]="['/stock/labels']" [queryParams]="{ ids: lb.ids.join(',') }">
            <lucide-icon [img]="icons.Printer" [size]="20" /><span>{{ 'sort.printStickers' | t: { n: (lb.ids.length | num), name: lb.name } }}</span>
          </a>
        }

        @if (stage() === 1 && (ready().length || madeBales().length)) {
          <section class="card ready">
            <h2>{{ 'sort.readyTitle' | t }}</h2>
            @if (ready().length) {
              <ul class="list">
                @for (r of ready(); track readyKey(r)) {
                  <li class="row">
                    <span><strong>{{ rowName(r) }}</strong><small>{{ 'sort.readyKg' | t: { kg: (r.availableKg | kg) } }}</small></span>
                    <button type="button" class="btn" (click)="startBales(r)">{{ 'sort.makeBales' | t }}</button>
                  </li>
                }
              </ul>
            } @else {
              <p class="hint">{{ 'sort.nothingReady' | t }}</p>
            }
            @if (madeBales().length) {
              <p class="made"><strong>{{ 'sort.balesMade' | t }}</strong>
                @for (b of madeBales(); track $index) { <span>{{ rowName(b) }} · {{ b.bales | num }}</span> }
              </p>
            }
          </section>
        }

        @if (confirmClose()) {
          <section class="card confirm" role="alertdialog" [attr.aria-label]="'sort.closeLot' | t">
            <p><strong>{{ (stage() === 1 ? 'sort.closeConfirmKat' : 'sort.closeConfirm') | t: { kg: (leftKg() | kg) } }}</strong></p>
            <div class="row2">
              <button type="button" class="btn" (click)="confirmClose.set(false)">{{ 'common.cancel' | t }}</button>
              <button type="button" class="btn primary" (click)="close()">{{ 'sort.closeLot' | t }}</button>
            </div>
          </section>
        }

        <footer class="action-bar">
          <div class="summary"><small>{{ 'common.total' | t }}</small><strong>{{ inputKg() | kg }}</strong></div>
          <button type="button" class="btn primary" [disabled]="sortedKg() <= 0 || inputKg() <= 0 || closing()" (click)="askClose()">{{ 'sort.closeLot' | t }}</button>
        </footer>
        </div>
        <div class="main">
        <p class="hint">{{ 'sort.tapTile' | t }}</p>
        <tos-tiles [items]="tiles()" [limit]="80" [columns]="desktop ? 'auto' : 2" (pick)="startLine($event)" />
        </div>
        </div>

        @if (entry(); as e) {
          <div class="entry-backdrop" (click)="entry.set(null)" aria-hidden="true"></div>
          <section class="card entry" role="group" [attr.aria-label]="e.kind.name">
            @if (e.purpose === 'bale') {
              <h2>{{ 'sort.makeBalesOf' | t: { name: rowName(e.ready!) } }}</h2>
              <p class="sum">{{ 'sort.readyKg' | t: { kg: (e.ready!.availableKg | kg) } }}</p>
            } @else {
              <h2>{{ e.kind.name }}</h2>
            }
            @if (canPickGrade(e)) {
              <div class="grades" role="group" [attr.aria-label]="'sort.grade' | t">
                <button type="button" class="chip" [class.on]="!e.gradeId" [attr.aria-pressed]="!e.gradeId" (click)="patch({ gradeId: null })">{{ 'sort.noGrade' | t }}</button>
                @for (g of gradeOptions(); track g.id) {
                  <button type="button" class="chip" [class.on]="e.gradeId === g.id" [attr.aria-pressed]="e.gradeId === g.id" (click)="patch({ gradeId: g.id })">{{ g.name }}</button>
                }
              </div>
            }
            @if (e.purpose === 'sort') {
              <div class="seg" role="group" [attr.aria-label]="'sort.howEntered' | t">
                <button type="button" [class.on]="e.mode === 'bales'" [attr.aria-pressed]="e.mode === 'bales'" (click)="setMode('bales')">{{ 'sort.modeBales' | t }}</button>
                <button type="button" [class.on]="e.mode === 'kg'" [attr.aria-pressed]="e.mode === 'kg'" (click)="setMode('kg')">{{ 'sort.modeLoose' | t }}</button>
              </div>
            }
            @if (e.mode === 'bales') {
              <div class="count">
                <span>{{ 'sort.howManyBales' | t }}</span>
                <div class="stepper">
                  <button type="button" [attr.aria-label]="'sort.fewer' | t" [disabled]="e.bales <= 1" (click)="step(-1)"><lucide-icon [img]="icons.Minus" [size]="22" /></button>
                  <output aria-live="polite">{{ e.bales | num }}</output>
                  <button type="button" [attr.aria-label]="'sort.more' | t" (click)="step(1)"><lucide-icon [img]="icons.Plus" [size]="22" /></button>
                </div>
              </div>
              <tos-number label="sort.kgPerBale" unit="unit.kgShort" [value]="e.baleKg" (valueChange)="patch({ baleKg: $event })" />
              @if (e.baleKg) { <p class="sum">{{ 'sort.balesTotal' | t: { n: (e.bales | num), kg: (entryKg() | kg) } }}</p> }
            } @else {
              <tos-number label="sort.looseKg" unit="unit.kgShort" [max]="leftKg()" maxMessage="sort.tooMuch" [value]="e.kg" (valueChange)="patch({ kg: $event })" />
            }
            @if (tooMuch()) { <p class="err" role="alert">{{ (e.purpose === 'bale' ? 'sort.tooMuchReady' : 'sort.tooMuch') | t: { kg: (limitKg() | kg) } }}</p> }
            <div class="row2">
              <button type="button" class="btn" (click)="entry.set(null)">{{ 'common.cancel' | t }}</button>
              <button type="button" class="btn primary" [disabled]="!entryKg() || tooMuch()" (click)="save()">{{ (e.purpose === 'bale' ? 'sort.saveBales' : 'common.save') | t }}</button>
            </div>
          </section>
        }

        @if (picking(); as p) {
          <tos-number class="hidden-field" [inline]="false" [label]="p.label" unit="unit.kgShort" [max]="leftKg()" maxMessage="sort.tooMuch" [value]="null" (valueChange)="saveLine(p, $event)" />
        }

      }
    </section>
  `,
  styles: [`
    /* Laptop (v2 review): the page's full width, tiles on the left, totals and what to bale on the right. */
    .floor.wide { max-width:var(--ws-content-max, 1200px); padding-block-end:16px; }
    .work { display:grid; grid-template-columns:minmax(0, 1fr); gap:14px; }
    .work .side, .work .main { display:grid; gap:14px; align-content:start; min-width:0; }
    .wide .work { grid-template-columns:minmax(0, 1fr) 380px; align-items:start; }
    .wide .work .main { order:1; }
    .wide .work .side { order:2; position:sticky; top:calc(var(--ws-topbar-h, 56px) + 16px); }
    .wide .action-bar { position:static; margin:0; }
    .totals { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .totals div { display:grid; padding:12px 14px; border:1px solid var(--tos-line); border-radius:var(--tos-radius); background:var(--tos-card); }
    .totals small { color:var(--tos-ink-soft); font-weight:700; }
    .totals strong { font-size:24px; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .bar { height:8px; border-radius:4px; background:var(--tos-line); overflow:hidden; }
    .bar i { display:block; height:100%; background:var(--tos-primary); }
    .today { margin:0; color:var(--tos-ink-soft); font-weight:700; }
    .printed { display:flex; flex-direction:row; align-items:center; gap:10px; color:var(--tos-primary); font-weight:700; text-decoration:none; }
    .hidden-field ::ng-deep .field-btn { display:none; }
    .confirm { border-color:var(--tos-warn); background:var(--tos-warn-soft); }
    .confirm p { margin:0; }
    /* A sheet at the bottom: it opens over the tiles wherever the list was scrolled to. */
    .entry-backdrop { position:fixed; inset:0; z-index:40; background:rgb(0 0 0 / .35); }
    .entry { position:fixed; z-index:41; inset-inline:0; inset-block-end:0; max-height:85vh; overflow:auto; margin:0 auto; max-width:560px; padding-block-end:calc(16px + env(safe-area-inset-bottom)); border-color:var(--tos-primary); border-radius:18px 18px 0 0; box-shadow:0 -8px 30px rgb(0 0 0 / .2); }
    .entry h2 { margin:0; }
    .seg { display:grid; grid-template-columns:1fr 1fr; padding:4px; border-radius:12px; background:var(--tos-line); }
    .seg button { min-height:44px; border:0; border-radius:9px; background:transparent; color:var(--tos-ink); font:inherit; font-weight:700; cursor:pointer; }
    .seg button.on { background:var(--tos-card); box-shadow:0 1px 3px rgb(0 0 0 / .15); color:var(--tos-primary); }
    .count { display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:700; }
    .stepper { display:flex; align-items:center; gap:6px; }
    .stepper button { display:grid; place-items:center; width:52px; height:52px; border:1px solid var(--tos-line); border-radius:12px; background:var(--tos-card); color:var(--tos-ink); cursor:pointer; }
    .stepper button:disabled { opacity:.4; }
    .stepper output { min-width:56px; text-align:center; font-size:30px; font-weight:800; font-variant-numeric:tabular-nums; }
    .sum { margin:0; color:var(--tos-ink-soft); font-weight:700; }
    .err { margin:0; color:var(--tos-danger, #b3261e); font-weight:600; }
    .kat h2 { margin:0; }
    .ready h2 { margin:0; }
    .ready .row { align-items:center; }
    .ready .row .btn { flex:none; min-height:44px; padding:0 14px; }
    .made { display:flex; flex-wrap:wrap; gap:4px 12px; margin:0; color:var(--tos-ink-soft); font-size:14px; }
    .grades { display:flex; flex-wrap:wrap; gap:8px; }
    .grades .chip { min-height:44px; }
  `],
})
export class SortWorkComponent implements OnInit {
  /** Lot id (stage 1) or category output id (stage 2), from the route. */
  readonly id = input.required<string>();
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly tenant = inject(TenantService);
  private readonly i18n = inject(I18nService);
  protected readonly nav = inject(NavService);
  /** A laptop: wide layout, the shared header and typed numbers (phones keep the floor screen). */
  protected readonly desktop = typeof matchMedia === 'function' && matchMedia('(pointer: fine) and (min-width: 1024px)').matches;
  protected readonly icons = { ArrowLeft, CheckCircle2, Minus, Plus, Printer };
  protected readonly stage = signal<Stage>(1);

  protected readonly title = signal('');
  protected readonly inputKg = signal(0);
  private readonly categories = signal<CategoryRow[]>([]);
  private readonly grades = signal<Named[]>([]);
  private readonly waste = signal<WasteType | null>(null);
  /** Session id from the server, or the id of the queued "start" while offline. */
  private readonly sessionId = signal<string | null>(null);
  private readonly startQueueId = signal<string | null>(null);
  /** kg and bales per kind already on the server (from the summary). */
  private readonly serverKg = signal<Record<string, number>>({});
  private readonly serverBales = signal<Record<string, number>>({});
  private readonly serverWasteKg = signal(0);
  protected readonly today = signal<{ kg: number; bales: number } | null>(null);
  protected readonly picking = signal<Tile | null>(null);
  protected readonly entry = signal<Entry | null>(null);
  protected readonly lastBales = signal<{ ids: string[]; name: string } | null>(null);
  /** This lot's sorted kg not baled yet, and the bales made from it (v2 6.6). */
  protected readonly ready = signal<ReadyRow[]>([]);
  protected readonly madeBales = signal<NonNullable<SortSummary['madeBales']>>([]);
  private readonly kgField = viewChild(NumberFieldComponent);
  protected readonly confirmClose = signal(false);
  protected readonly closing = signal(false);
  protected readonly throwing = signal(false);
  protected readonly result = signal<SessionOutput[] | null>(null);
  protected readonly kat = signal<SortSummary['kat'] | null>(null);
  protected readonly closedOnline = signal(true);
  protected readonly wasteAtClose = signal(0);

  /** Writes whose answer the server totals already include (their entries leave the pending list a moment later). */
  private readonly inServerTotals = signal<ReadonlySet<string>>(new Set());
  /** Lines saved on this phone but not synced yet, for this session. */
  private readonly pendingLines = computed(() =>
    this.queue
      .pendingOf('sort', (m) => m['target'] === this.id() && m['stage'] === this.stage() && (m['type'] === 'line' || m['type'] === 'undo' || m['type'] === 'waste'))
      // Counting such a line twice would make the lot look fully sorted, and "Close lot" would skip the kat question.
      .filter((w) => !this.inServerTotals().has(w.id)),
  );
  private readonly kgByKind = computed(() => {
    const kg = { ...this.serverKg() };
    for (const w of this.pendingLines()) {
      const m = w.meta as { kind: string; kg: number; type: string };
      if (m.type === 'waste') continue;
      kg[m.kind] = (kg[m.kind] ?? 0) + (m.type === 'undo' ? -m.kg : m.kg);
    }
    return kg;
  });
  private readonly balesByKind = computed(() => {
    const n = { ...this.serverBales() };
    for (const w of this.pendingLines()) {
      const m = w.meta as { kind: string; bales?: number; type: string };
      if (!m.bales) continue;
      n[m.kind] = (n[m.kind] ?? 0) + (m.type === 'undo' ? -m.bales : m.bales);
    }
    return n;
  });
  protected readonly totalBales = computed(() => Object.values(this.balesByKind()).reduce((s, v) => s + v, 0));
  private readonly wasteKg = computed(() => this.serverWasteKg() + this.pendingLines().filter((w) => w.meta?.['type'] === 'waste').reduce((s, w) => s + Number(w.meta?.['kg'] ?? 0), 0));
  protected readonly sortedKg = computed(() => round(Object.values(this.kgByKind()).reduce((s, v) => s + v, 0) + this.wasteKg()));
  protected readonly leftKg = computed(() => round(this.inputKg() - this.sortedKg()));
  protected readonly donePct = computed(() => (this.inputKg() ? Math.min(100, Math.round((this.sortedKg() / this.inputKg()) * 100)) : 0));

  /** Stage 1: one tile per category (the grade, if any, is picked in the sheet). Stage 2: grades. */
  private readonly kinds = computed<Kind[]>(() => {
    if (this.stage() === 2) return this.grades().map((g) => ({ id: g.id, name: g.name, categoryId: '', gradeId: g.id, baleKg: null }));
    return this.categories().map((c) => ({ id: c.id, name: c.name, categoryId: c.id, gradeId: null, baleKg: c.baleWeightKg ? Number(c.baleWeightKg) : null }));
  });

  /** Grades a worker may give while sorting or baling — none when the business does not grade. */
  protected readonly gradeOptions = computed(() => ((this.tenant.tenant()?.sortingStages ?? 2) >= 2 ? this.grades() : []));

  protected readonly tiles = computed<Tile[]>(() => {
    const kg = this.kgByKind();
    const bales = this.balesByKind();
    const tiles: Tile[] = usageOrder(this.kinds(), this.usageKey()).map((k) => ({
      id: k.id,
      label: k.name,
      sub: [bales[k.id] ? `${this.i18n.num(bales[k.id])} ${this.i18n.t(bales[k.id] === 1 ? 'unit.bale' : 'unit.bales')}` : '', kg[k.id] ? this.i18n.kg(kg[k.id]) : ''].filter(Boolean).join(' · '),
    }));
    // Grading a category output separately still records its waste; sorting a lot books kat at the end.
    if (this.stage() === 2) tiles.push({ id: WASTE_TILE, label: this.waste()?.name || this.i18n.t('sort.waste'), sub: this.wasteKg() ? this.i18n.kg(this.wasteKg()) : '', tone: 'waste' });
    return tiles;
  });

  protected readonly entryKg = computed(() => {
    const e = this.entry();
    if (!e) return 0;
    return e.mode === 'bales' ? round(e.bales * (e.baleKg ?? 0)) : e.kg ?? 0;
  });
  /** Sorting can take what is left of the lot; "Make bales" what is sorted and not baled. */
  protected readonly limitKg = computed(() => {
    const e = this.entry();
    return e?.purpose === 'bale' && e.ready ? Number(e.ready.availableKg) : this.leftKg();
  });
  protected readonly tooMuch = computed(() => this.entryKg() > this.limitKg() + 0.001);

  constructor() {
    // Lines are sent in the background: when one reaches the server, its answer is the session's new state.
    const stop = this.queue.onSynced((write, response) => {
      const m = write.meta;
      if (m?.['target'] !== this.id() || m?.['stage'] !== this.stage()) return;
      if (response && typeof response === 'object' && 'buckets' in response) {
        this.inServerTotals.update((ids) => new Set(ids).add(write.id));
        this.applySummary(response as SortSummary);
      }
    });
    inject(DestroyRef).onDestroy(stop);
  }

  ngOnInit(): void {
    this.stage.set(this.route.snapshot.data['stage'] === 2 ? 2 : 1);
    // Each part shows as soon as it arrives: tiles first (cached on the phone), totals when the session loads.
    this.data.wasteTypes().subscribe((w) => this.setWaste(w));
    this.data.grades().subscribe((g) => this.grades.set(g));
    if (this.stage() === 1) {
      this.data.categories().subscribe((c) => this.categories.set(c));
      this.data.lotsToSort().subscribe((lots) => {
        const lot = lots.find((l) => l.id === this.id());
        if (lot) this.setLot(lot);
        // Not in the (possibly cached) queue, e.g. received a moment ago: ask for this lot itself.
        else this.data.lot(this.id()).subscribe((one) => one && this.setLot(one));
      });
      this.data.sortSummary(this.id()).subscribe((summary) => {
        if (!this.inputKg() && summary?.session?.totalInputWeight) this.inputKg.set(Number(summary.session.totalInputWeight));
        this.applySummary(summary);
      });
    } else {
      this.data.toGrade().subscribe((outputs) => {
        const output = outputs.find((o) => o.id === this.id());
        this.title.set(output?.category.name ?? '');
        this.inputKg.set(Number(output?.weightKg ?? 0));
        const open = output?.gradeSessions.find((s) => s.status === 'OPEN');
        if (open) this.data.gradeSession(open.id).subscribe((s) => this.applySummary(s));
      });
    }
  }

  protected pct(kg: string | number): number {
    return this.inputKg() ? Math.round((Number(kg) / this.inputKg()) * 100) : 0;
  }

  protected startLine(tile: Tile): void {
    if (this.stage() === 2 || tile.id === WASTE_TILE) {
      this.picking.set(tile);
      // Open the keypad straight away: one tap on the tile, then the kg.
      setTimeout(() => this.kgField()?.open());
      return;
    }
    const kind = this.kinds().find((k) => k.id === tile.id);
    if (!kind) return;
    const baleKg = lastBaleKg(kind.id) ?? kind.baleKg;
    // Bales first when this category has a bale weight; the worker can switch to loose kg. The grade is optional.
    this.entry.set({ purpose: 'sort', kind, ready: null, mode: baleKg ? 'bales' : 'kg', gradeId: this.lastGrade(kind.id), bales: 1, baleKg, kg: null });
    if (!baleKg) this.openKgPad();
  }

  /** "Make bales" from this lot's sorted kg of one kind; ungraded kg can be given a grade now. */
  protected startBales(r: ReadyRow): void {
    const kind = this.kinds().find((k) => k.id === r.categoryId) ?? { id: r.categoryId, name: r.categoryName, categoryId: r.categoryId, gradeId: null, baleKg: null };
    this.entry.set({ purpose: 'bale', kind, ready: r, mode: 'bales', gradeId: r.gradeId, bales: 1, baleKg: lastBaleKg(kind.id) ?? kind.baleKg, kg: null });
  }

  protected canPickGrade(e: Entry): boolean {
    return this.gradeOptions().length > 0 && (e.purpose === 'sort' || !e.ready?.gradeId);
  }

  protected readyKey(r: ReadyRow): string {
    return kindKey(r.categoryId, r.gradeId);
  }

  protected rowName(r: { categoryName: string; gradeName: string | null }): string {
    return r.gradeName ? `${r.categoryName} · ${r.gradeName}` : r.categoryName;
  }

  protected save(): void {
    void (this.entry()?.purpose === 'bale' ? this.saveBales() : this.saveEntry());
  }

  /** Bales from sorted kg of this lot: into stock with stickers, sellable at once; the lot stays in sorting. */
  private async saveBales(): Promise<void> {
    const e = this.entry();
    const kg = this.entryKg();
    if (!e?.ready || !e.baleKg || !kg || this.tooMuch()) return;
    this.entry.set(null);
    rememberBaleKg(e.kind.id, e.baleKg);
    const grade = this.gradeOptions().find((g) => g.id === e.gradeId) ?? null;
    const name = grade ? `${e.kind.name} · ${grade.name}` : e.kind.name;
    const what = `${this.i18n.num(e.bales)} ${this.i18n.t(e.bales === 1 ? 'unit.bale' : 'unit.bales')} · ${this.i18n.kg(kg)}`;
    try {
      const r = await this.queue.send<{ baleIds?: string[] }>({
        kind: 'bale',
        label: `${this.title()} · ${name} · ${what}`,
        url: '/api/stock/bales',
        body: { categoryId: e.kind.categoryId, ...(e.gradeId ? { gradeId: e.gradeId } : {}), fromUngraded: !e.ready.gradeId, ragId: this.id(), count: e.bales, weightKg: e.baleKg },
        meta: { kind: kindKey(e.kind.categoryId, e.ready.gradeId), kg },
      });
      if (r.saved && r.response.baleIds?.length) this.lastBales.set({ ids: r.response.baleIds, name });
      this.toast.show(r.saved ? this.i18n.t('sort.balesSaved', { what, name }) : this.i18n.t('sync.savedOnPhone'));
      this.data.sortSummary(this.id()).subscribe((s) => this.applySummary(s));
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  protected setMode(mode: Mode): void {
    this.patch({ mode });
    if (mode === 'kg' && !this.entry()?.kg) this.openKgPad();
  }

  /** Loose kg: the keypad opens at once (one tap on the tile, then the kg). */
  private openKgPad(): void {
    setTimeout(() => this.kgField()?.open());
  }

  protected step(by: number): void {
    const e = this.entry();
    if (e) this.patch({ bales: Math.max(1, Math.min(200, e.bales + by)) });
  }

  protected patch(change: Partial<Entry>): void {
    this.entry.update((e) => (e ? { ...e, ...change } : e));
  }

  /** Saves the entry: bales (into stock with stickers) or loose kg. */
  protected async saveEntry(): Promise<void> {
    const e = this.entry();
    const kg = this.entryKg();
    if (!e || !kg || this.tooMuch()) return;
    this.entry.set(null);
    const bales = e.mode === 'bales' ? e.bales : 0;
    if (bales) rememberBaleKg(e.kind.id, e.baleKg!);
    rememberGrade(e.kind.id, e.gradeId);
    const grade = this.gradeOptions().find((g) => g.id === e.gradeId) ?? null;
    const kind = { ...e.kind, name: grade ? `${e.kind.name} · ${grade.name}` : e.kind.name };
    const sessionId = await this.ensureSession();
    const body = { sessionId, categoryId: e.kind.categoryId, ...(e.gradeId ? { gradeId: e.gradeId } : {}), ...(bales ? { bales, baleWeightKg: e.baleKg } : { amountKg: kg }) };
    const what = bales ? `${this.i18n.num(bales)} ${this.i18n.t(bales === 1 ? 'unit.bale' : 'unit.bales')} · ${this.i18n.kg(kg)}` : this.i18n.kg(kg);
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${kind.name} · ${what}`,
        url: '/api/sorting/stage-1/allocate',
        body,
        meta: { target: this.id(), stage: 1, type: 'line', kind: e.kind.id, kg, bales },
        background: !bales,
      });
      if (r.saved) {
        this.applySummary(r.response);
        if (r.response.baleIds?.length) this.lastBales.set({ ids: r.response.baleIds, name: kind.name });
      }
      countUse(this.usageKey(), e.kind.id);
      this.toast.show(this.i18n.t('sort.added', { kg: what, name: kind.name }), { undo: () => void this.undoEntry(kind, body, kg, bales, what) });
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  private async undoEntry(kind: Kind, body: Record<string, unknown>, kg: number, bales: number, what: string): Promise<void> {
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${kind.name} · −${what}`,
        url: '/api/sorting/stage-1/unallocate',
        body: { ...body, sessionId: await this.ensureSession() },
        meta: { target: this.id(), stage: 1, type: 'undo', kind: kind.id, kg, bales },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
      if (bales) this.lastBales.set(null);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  /** Stage 2 (and waste while grading): one kg line. */
  protected async saveLine(tile: Tile, kg: number | null): Promise<void> {
    this.picking.set(null);
    if (!kg) return;
    const isWaste = tile.id === WASTE_TILE;
    const base = `/api/sorting/stage-${this.stage()}`;
    const sessionId = await this.ensureSession();
    const body = isWaste ? { sessionId, wasteCategoryId: this.waste()?.id, amount: kg } : { sessionId, gradeId: tile.id, amountKg: kg };
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${tile.label} · ${this.i18n.kg(kg)}`,
        url: `${base}/${isWaste ? 'waste' : 'allocate'}`,
        body,
        meta: { target: this.id(), stage: this.stage(), type: isWaste ? 'waste' : 'line', kind: tile.id, kg },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
      if (!isWaste) countUse(this.usageKey(), tile.id);
      this.toast.show(this.i18n.t('sort.added', { kg: this.i18n.kg(kg), name: tile.label }), isWaste ? {} : { undo: () => void this.undoLine(tile, kg) });
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  private async undoLine(tile: Tile, kg: number): Promise<void> {
    const base = `/api/sorting/stage-${this.stage()}`;
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${tile.label} · −${this.i18n.kg(kg)}`,
        url: `${base}/unallocate`,
        body: { sessionId: await this.ensureSession(), gradeId: tile.id, amountKg: kg },
        meta: { target: this.id(), stage: this.stage(), type: 'undo', kind: tile.id, kg },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  protected askClose(): void {
    if (this.inputKg() <= 0) return; // weight not known yet (the button is disabled meanwhile)
    if (this.leftKg() > 0) this.confirmClose.set(true);
    else void this.close();
  }

  protected async close(): Promise<void> {
    this.confirmClose.set(false);
    this.closing.set(true);
    const left = Math.max(0, this.leftKg());
    const sessionId = await this.ensureSession();
    const url = typeof sessionId === 'string' ? `/api/sorting/stage-${this.stage()}/${sessionId}/seal` : `/api/sorting/stage-${this.stage()}/{ref:${this.startQueueId()}:session.id}/seal`;
    try {
      const r = await this.queue.send<SortSummary | { outputsCreated: number }>({
        kind: 'sort',
        method: 'PATCH',
        label: `${this.title()} · ${this.i18n.t('sort.closeLot')}`,
        url,
        body: this.waste() ? { wasteCategoryId: this.waste()!.id } : {},
        meta: { target: this.id(), stage: this.stage(), type: 'close' },
      });
      this.wasteAtClose.set(round(this.wasteKg() + left));
      const names = new Map(this.kinds().map((k) => [k.id, k.name]));
      const local = Object.entries(this.kgByKind())
        .filter(([, kg]) => kg > 0)
        .map(([id, kg]) => ({ id, name: names.get(id) ?? '', weightKg: String(kg), cost: '', costPerKg: '', bales: this.balesByKind()[id] ?? 0 }));
      let outputs: SessionOutput[] = local;
      if (r.saved) {
        const summary = 'outputs' in r.response ? r.response : null;
        const fresh = summary?.outputs?.length ? summary : await this.reload();
        if (fresh?.outputs?.length) {
          outputs = fresh.outputs;
          // The server's outputs are the truth: kat is what the lot weighed minus what came out.
          this.wasteAtClose.set(round(this.inputKg() - outputs.reduce((s, o) => s + Number(o.weightKg), 0)));
          this.kat.set(fresh.kat ?? null);
        }
      }
      this.closedOnline.set(r.saved);
      this.result.set(outputs);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.closing.set(false);
    }
  }

  /** Kat nobody will buy: out of stock (it cost nothing). */
  protected async throwAway(itemId: string): Promise<void> {
    this.throwing.set(true);
    try {
      await this.queue.send({ kind: 'sort', label: `${this.title()} · ${this.i18n.t('sort.katThrowAway')}`, url: `/api/sorting/stage-1/kat/${itemId}/throw-away`, body: {}, meta: { target: this.id(), stage: 1, type: 'kat' } });
      this.kat.update((k) => (k ? { ...k, leftKg: '0' } : k));
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.throwing.set(false);
    }
  }

  /** The session to write to: the real id, or (offline, first line) a reference to a queued start. */
  private async ensureSession(): Promise<unknown> {
    const id = this.sessionId();
    if (id) return id;
    if (!this.startQueueId()) {
      const pendingStart = this.queue.pendingOf('sort', (m) => m['target'] === this.id() && m['stage'] === this.stage() && m['type'] === 'start')[0];
      if (pendingStart) this.startQueueId.set(pendingStart.id);
      else {
        const r = await this.queue.send<SortSummary>({
          kind: 'sort',
          label: `${this.title()} · ${this.i18n.t('sort.title')}`,
          url: `/api/sorting/stage-${this.stage()}/start`,
          body: this.stage() === 1 ? { ragId: this.id() } : { categoryOutputId: this.id() },
          meta: { target: this.id(), stage: this.stage(), type: 'start' },
        });
        if (r.saved && r.response.session) {
          this.applySummary(r.response);
          return r.response.session.id;
        }
        this.startQueueId.set(r.id);
      }
    }
    return this.queue.ref(this.startQueueId()!, 'session.id');
  }

  private setLot(lot: { ragCode: string; weightKg: string }): void {
    this.title.set(lot.ragCode);
    if (this.stage() === 1) this.nav.setName(this.id(), lot.ragCode);
    if (Number(lot.weightKg) > 0) this.inputKg.set(Number(lot.weightKg));
  }

  private applySummary(summary: SortSummary | null): void {
    if (!summary?.session) return;
    if (!this.inputKg() && Number(summary.session.totalInputWeight) > 0) this.inputKg.set(Number(summary.session.totalInputWeight));
    this.sessionId.set(summary.session.id);
    const kg: Record<string, number> = {};
    const bales: Record<string, number> = {};
    if (this.stage() === 1 && summary.kinds) {
      // Tiles are categories: kg sorted per category (all grades, and kg from before v2 6.6), bales made from it.
      for (const b of summary.buckets) if (b.categoryId) kg[b.categoryId] = Number(b.outputWeightKg);
      for (const k of summary.kinds) bales[k.categoryId] = (bales[k.categoryId] ?? 0) + k.bales;
      if (summary.today) this.today.set({ kg: Number(summary.today.kg), bales: summary.today.bales });
      this.ready.set(summary.ready ?? []);
      this.madeBales.set(summary.madeBales ?? []);
    } else {
      for (const b of summary.buckets) kg[(b.categoryId ?? b.gradeId)!] = Number(b.outputWeightKg);
    }
    this.serverKg.set(kg);
    this.serverBales.set(bales);
    this.serverWasteKg.set(summary.wasteLineItems.reduce((s, w) => s + Number(w.amount), 0));
    if (summary.session.status === 'CLOSED' && summary.outputs?.length && !this.result()) {
      this.result.set(summary.outputs);
      this.kat.set(summary.kat ?? null);
      this.wasteAtClose.set(round(this.inputKg() - summary.outputs.reduce((s, o) => s + Number(o.weightKg), 0)));
    }
  }

  private async reload(): Promise<SortSummary | null> {
    const id = this.sessionId();
    if (!id) return null;
    const obs = this.stage() === 1 ? this.data.sortSession(id) : this.data.gradeSession(id);
    return new Promise((resolve) => obs.subscribe((s) => resolve(s)));
  }

  private setWaste(list: WasteType[]): void {
    this.waste.set(list.find((w) => /katran/i.test(w.name)) ?? list[0] ?? null);
  }

  /** The grade last given to this category on this phone (sorting the same pile again is common). */
  private lastGrade(categoryId: string): string | null {
    try {
      const id = JSON.parse(localStorage.getItem(GRADE_KEY) || '{}')[categoryId];
      return typeof id === 'string' && this.gradeOptions().some((g) => g.id === id) ? id : null;
    } catch {
      return null;
    }
  }

  private usageKey(): string {
    return this.stage() === 1 ? 'category' : 'grade';
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The bale weight last used for a kind on this phone (it beats the category's usual weight). */
function lastBaleKg(kind: string): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(BALE_KG_KEY) || '{}')[kind];
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function rememberBaleKg(kind: string, kg: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(BALE_KG_KEY) || '{}');
    all[kind] = kg;
    localStorage.setItem(BALE_KG_KEY, JSON.stringify(all));
  } catch {
    /* private window */
  }
}

function rememberGrade(categoryId: string, gradeId: string | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(GRADE_KEY) || '{}');
    all[categoryId] = gradeId;
    localStorage.setItem(GRADE_KEY, JSON.stringify(all));
  } catch {
    /* private window */
  }
}
