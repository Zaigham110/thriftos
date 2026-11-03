import { Component, DestroyRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { FloorDataService, Named, SessionOutput, SortSummary, WasteType, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

type Stage = 1 | 2;
const WASTE_TILE = '__waste__';

/**
 * Journey 2 — sorting (< 10 s per line). Grid of big tiles (categories, or grades when grading),
 * tap → kg keypad → saved; repeat. Sorted / left are always on top. The Waste tile is always there.
 * Every line goes through the offline queue (works with no network); Undo takes the last line back for 10 s.
 * "Close lot" shows the yield and the cost per kg of each output; a remainder goes to waste after a confirm.
 */
@Component({
  selector: 'app-sort-work',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent, TilesComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/sort" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ title() }}<span class="sub">{{ (stage() === 1 ? 'sort.title' : 'sort.grading') | t }}</span></h1>
      </header>

      @if (result(); as r) {
        <section class="card">
          <h2><lucide-icon [img]="icons.CheckCircle2" [size]="22" class="good" /> {{ 'sort.closed' | t }} · {{ 'sort.yield' | t }}</h2>
          <ul class="list">
            @for (o of r; track o.name) {
              <li class="row"><span><strong>{{ o.name }}</strong><small>{{ 'unit.percent' | t: { n: pct(o.weightKg) } }}</small></span>
                <span class="amount">{{ o.weightKg | kg }}@if (o.costPerKg) { <small>{{ 'sort.costPerKg' | t: { rs: (o.costPerKg | rs) } }}</small> }</span></li>
            }
            <li class="row"><span><strong>{{ 'sort.waste' | t }}</strong><small>{{ 'unit.percent' | t: { n: pct(wasteAtClose()) } }}</small></span><span class="amount">{{ wasteAtClose() | kg }}</span></li>
          </ul>
          @if (!closedOnline()) { <p class="hint">{{ 'sync.savedOnPhone' | t }}</p> }
          <a class="btn primary block" routerLink="/sort">{{ 'common.done' | t }}</a>
        </section>
      } @else {
        <div class="totals" aria-live="polite">
          <div><small>{{ 'sort.sortedLabel' | t }}</small><strong>{{ sortedKg() | kg }}</strong></div>
          <div [class.warn]="leftKg() < 0"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ leftKg() | kg }}</strong></div>
        </div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="donePct()" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="donePct()"></i></div>

        <p class="hint">{{ 'sort.tapTile' | t }}</p>
        <tos-tiles [items]="tiles()" [limit]="60" [columns]="2" (pick)="startLine($event)" />

        @if (picking(); as p) {
          <tos-number class="hidden-field" [label]="p.label" unit="unit.kgShort" [max]="leftKg()" maxMessage="sort.tooMuch" [value]="null" (valueChange)="saveLine(p, $event)" />
        }

        @if (confirmClose()) {
          <section class="card confirm" role="alertdialog" [attr.aria-label]="'sort.closeLot' | t">
            <p><strong>{{ 'sort.closeConfirm' | t: { kg: (leftKg() | kg) } }}</strong></p>
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
      }
    </section>
  `,
  styles: [`
    .totals { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .totals div { display:grid; padding:12px 14px; border:1px solid var(--tos-line); border-radius:var(--tos-radius); background:#fff; }
    .totals small { color:var(--tos-ink-soft); font-weight:700; }
    .totals strong { font-size:24px; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .bar { height:8px; border-radius:4px; background:var(--tos-line); overflow:hidden; }
    .bar i { display:block; height:100%; background:var(--tos-primary); }
    .hidden-field ::ng-deep .field-btn { display:none; }
    .confirm { border-color:var(--tos-warn); background:var(--tos-warn-soft); }
    .confirm p { margin:0; }
  `],
})
export class SortWorkComponent implements OnInit {
  /** Lot id (stage 1) or category output id (stage 2), from the route. */
  readonly id = input.required<string>();
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2 };
  protected readonly stage = signal<Stage>(1);

  protected readonly title = signal('');
  protected readonly inputKg = signal(0);
  private readonly kinds = signal<Named[]>([]);
  private readonly waste = signal<WasteType | null>(null);
  /** Session id from the server, or the id of the queued "start" while offline. */
  private readonly sessionId = signal<string | null>(null);
  private readonly startQueueId = signal<string | null>(null);
  /** kg per kind already on the server (from the summary). */
  private readonly serverKg = signal<Record<string, number>>({});
  private readonly serverWasteKg = signal(0);
  protected readonly picking = signal<Tile | null>(null);
  private readonly kgField = viewChild(NumberFieldComponent);
  protected readonly confirmClose = signal(false);
  protected readonly closing = signal(false);
  protected readonly result = signal<SessionOutput[] | null>(null);
  protected readonly closedOnline = signal(true);
  protected readonly wasteAtClose = signal(0);

  /** Lines saved on this phone but not synced yet, for this session. */
  /** Writes whose answer the server totals already include (their entries leave the pending list a moment later). */
  private readonly inServerTotals = signal<ReadonlySet<string>>(new Set());
  private readonly pendingLines = computed(() =>
    this.queue
      .pendingOf('sort', (m) => m['target'] === this.id() && m['stage'] === this.stage() && (m['type'] === 'line' || m['type'] === 'undo' || m['type'] === 'waste'))
      // Counting such a line twice would make the lot look fully sorted, and "Close lot" would skip the waste question.
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
  private readonly wasteKg = computed(() => this.serverWasteKg() + this.pendingLines().filter((w) => w.meta?.['type'] === 'waste').reduce((s, w) => s + Number(w.meta?.['kg'] ?? 0), 0));
  protected readonly sortedKg = computed(() => round(Object.values(this.kgByKind()).reduce((s, v) => s + v, 0) + this.wasteKg()));
  protected readonly leftKg = computed(() => round(this.inputKg() - this.sortedKg()));
  protected readonly donePct = computed(() => (this.inputKg() ? Math.min(100, Math.round((this.sortedKg() / this.inputKg()) * 100)) : 0));

  protected readonly tiles = computed<Tile[]>(() => {
    const kg = this.kgByKind();
    const tiles: Tile[] = usageOrder(this.kinds(), this.usageKey()).map((k) => ({ id: k.id, label: k.name, sub: kg[k.id] ? this.i18n.kg(kg[k.id]) : '' }));
    tiles.push({ id: WASTE_TILE, label: this.waste()?.name || this.i18n.t('sort.waste'), sub: this.wasteKg() ? this.i18n.kg(this.wasteKg()) : '', tone: 'waste' });
    return tiles;
  });

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
    const waste$ = this.data.wasteTypes();
    // Each part shows as soon as it arrives: tiles first (cached on the phone), totals when the session loads.
    this.data.wasteTypes().subscribe((w) => this.setWaste(w));
    if (this.stage() === 1) {
      this.data.categories().subscribe((c) => this.kinds.set(c));
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
      this.data.grades().subscribe((g) => this.kinds.set(g));
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
    this.picking.set(tile);
    // Open the keypad straight away: one tap on the tile, then the kg.
    setTimeout(() => this.kgField()?.open());
  }

  protected async saveLine(tile: Tile, kg: number | null): Promise<void> {
    this.picking.set(null);
    if (!kg) return;
    const isWaste = tile.id === WASTE_TILE;
    const base = `/api/sorting/stage-${this.stage()}`;
    const sessionId = await this.ensureSession();
    const body = isWaste
      ? { sessionId, wasteCategoryId: this.waste()?.id, amount: kg }
      : { sessionId, [this.stage() === 1 ? 'categoryId' : 'gradeId']: tile.id, amountKg: kg };
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
      this.toast.show(this.i18n.t('sort.added', { kg: this.i18n.kg(kg), name: tile.label }), isWaste ? {} : { undo: () => void this.undo(tile, kg) });
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  private async undo(tile: Tile, kg: number): Promise<void> {
    const base = `/api/sorting/stage-${this.stage()}`;
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${tile.label} · −${this.i18n.kg(kg)}`,
        url: `${base}/unallocate`,
        body: { sessionId: await this.ensureSession(), [this.stage() === 1 ? 'categoryId' : 'gradeId']: tile.id, amountKg: kg },
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
      const local = Object.entries(this.kgByKind())
        .filter(([, kg]) => kg > 0)
        .map(([id, kg]) => ({ id, name: this.kinds().find((k) => k.id === id)?.name ?? '', weightKg: String(kg), cost: '', costPerKg: '' }));
      let outputs: SessionOutput[] = local;
      if (r.saved) {
        const summary = 'outputs' in r.response ? r.response : null;
        const fresh = summary?.outputs?.length ? summary : await this.reload();
        if (fresh?.outputs?.length) {
          outputs = fresh.outputs;
          // The server's outputs are the truth: waste is what the lot weighed minus what came out.
          this.wasteAtClose.set(round(this.inputKg() - outputs.reduce((s, o) => s + Number(o.weightKg), 0)));
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
    if (Number(lot.weightKg) > 0) this.inputKg.set(Number(lot.weightKg));
  }

  private applySummary(summary: SortSummary | null): void {
    if (!summary?.session) return;
    if (!this.inputKg() && Number(summary.session.totalInputWeight) > 0) this.inputKg.set(Number(summary.session.totalInputWeight));
    this.sessionId.set(summary.session.id);
    const kg: Record<string, number> = {};
    for (const b of summary.buckets) kg[(b.categoryId ?? b.gradeId)!] = Number(b.outputWeightKg);
    this.serverKg.set(kg);
    this.serverWasteKg.set(summary.wasteLineItems.reduce((s, w) => s + Number(w.amount), 0));
    if (summary.session.status === 'CLOSED' && summary.outputs?.length && !this.result()) {
      this.result.set(summary.outputs);
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

  private usageKey(): string {
    return this.stage() === 1 ? 'category' : 'grade';
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

