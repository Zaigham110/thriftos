import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, Minus, Plus, Printer } from 'lucide-angular';
import { TenantService } from '../../core/tenant/tenant.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { BaleKind, FloorDataService, Named, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

interface MadeBale { id: string; unitCode: string; weightKg: string; baleIds?: string[] }

const kindId = (k: { categoryId: string; gradeId: string | null }) => `${k.categoryId}:${k.gradeId ?? ''}`;

/**
 * Journey 3 — make bales: pick what (category or category + grade, with kg available) → how many → kg per bale →
 * Save. Kg sorted without a grade can be given one now (v2 6.6). Stock is taken FIFO from sorted kg, also of lots
 * still being sorted. Then "Print label(s)". Works offline.
 */
@Component({
  selector: 'app-make-bale',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent, TilesComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/stock" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'stock.makeBale' | t }}</h1>
      </header>

      @if (made(); as m) {
        <section class="card done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="34" class="good" />
          <h2>{{ m.code ? ('stock.baleSaved' | t: { code: m.code, kg: (m.kg | kg) }) : ('sync.savedOnPhone' | t) }}</h2>
          @if (m.ids.length > 1) {
            <a class="btn primary block" [routerLink]="['/stock/labels']" [queryParams]="{ ids: m.ids.join(',') }"><lucide-icon [img]="icons.Printer" [size]="20" /> {{ 'stock.printLabels' | t: { n: (m.ids.length | num) } }}</a>
          } @else if (m.id) {
            <a class="btn primary block" [routerLink]="['/stock/label', m.id]"><lucide-icon [img]="icons.Printer" [size]="20" /> {{ 'stock.printLabel' | t }}</a>
          }
          <button type="button" class="btn block" (click)="made.set(null)">{{ 'stock.makeBale' | t }}</button>
        </section>
      } @else {
        <section class="card">
          <h2>{{ 'stock.pickKind' | t }}</h2>
          <tos-tiles [items]="tiles()" [selected]="kind() ? id(kind()!) : null" [limit]="40" [columns]="2" emptyText="stock.empty" (pick)="pick($event)" />
        </section>
        @if (kind(); as k) {
          <section class="card">
            @if (!k.gradeId && gradeOptions().length) {
              <div class="grades" role="group" [attr.aria-label]="'sort.grade' | t">
                <button type="button" class="chip" [class.on]="!gradeId()" [attr.aria-pressed]="!gradeId()" (click)="gradeId.set(null)">{{ 'sort.noGrade' | t }}</button>
                @for (g of gradeOptions(); track g.id) {
                  <button type="button" class="chip" [class.on]="gradeId() === g.id" [attr.aria-pressed]="gradeId() === g.id" (click)="gradeId.set(g.id)">{{ g.name }}</button>
                }
              </div>
            }
            <div class="count">
              <span>{{ 'sort.howManyBales' | t }}</span>
              <div class="stepper">
                <button type="button" [attr.aria-label]="'sort.fewer' | t" [disabled]="count() <= 1" (click)="count.set(count() - 1)"><lucide-icon [img]="icons.Minus" [size]="22" /></button>
                <output aria-live="polite">{{ count() | num }}</output>
                <button type="button" [attr.aria-label]="'sort.more' | t" (click)="count.set(count() + 1)"><lucide-icon [img]="icons.Plus" [size]="22" /></button>
              </div>
            </div>
            <tos-number [label]="count() > 1 ? 'sort.kgPerBale' : 'stock.baleWeight'" unit="unit.kgShort" [max]="available(k) / count()" maxMessage="sort.tooMuch" [(value)]="weightKg" />
            @if (count() > 1 && weightKg()) { <p class="sum">{{ 'sort.balesTotal' | t: { n: (count() | num), kg: (count() * weightKg()! | kg) } }}</p> }
            <details class="more">
              <summary>{{ 'common.more' | t }}</summary>
              <tos-number label="stock.pieces" unit="unit.pcs" [decimals]="0" [optional]="true" [(value)]="pieces" />
            </details>
          </section>
        }
        <footer class="action-bar">
          <button type="button" class="btn primary" [disabled]="!kind() || !weightKg() || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'stock.saveBale') | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .done { justify-items:center; text-align:center; }
    .grades { display:flex; flex-wrap:wrap; gap:8px; }
    .grades .chip { min-height:44px; }
    .count { display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:700; }
    .stepper { display:flex; align-items:center; gap:6px; }
    .stepper button { display:grid; place-items:center; width:52px; height:52px; border:1px solid var(--tos-line); border-radius:12px; background:var(--tos-card); color:var(--tos-ink); cursor:pointer; }
    .stepper button:disabled { opacity:.4; }
    .stepper output { min-width:56px; text-align:center; font-size:30px; font-weight:800; font-variant-numeric:tabular-nums; }
    .sum { margin:0; color:var(--tos-ink-soft); font-weight:700; }
  `],
})
export class MakeBaleComponent implements OnInit {
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2, Minus, Plus, Printer };
  private readonly tenant = inject(TenantService);
  private readonly grades = signal<Named[]>([]);
  /** Grades a bale of ungraded kg can get — none when the business does not grade. */
  protected readonly gradeOptions = computed(() => ((this.tenant.tenant()?.sortingStages ?? 2) >= 2 ? this.grades() : []));
  protected readonly gradeId = signal<string | null>(null);
  protected readonly count = signal(1);
  protected readonly id = kindId;
  private readonly kinds = signal<BaleKind[]>([]);
  protected readonly kind = signal<BaleKind | null>(null);
  protected readonly weightKg = signal<number | null>(null);
  protected readonly pieces = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly made = signal<{ id: string | null; ids: string[]; code: string | null; kg: number } | null>(null);

  /** kg already taken by bales saved on this phone and not synced yet. */
  private readonly pendingKg = computed(() => {
    const kg: Record<string, number> = {};
    for (const w of this.queue.pendingOf('bale', () => true)) kg[String(w.meta?.['kind'])] = (kg[String(w.meta?.['kind'])] ?? 0) + Number(w.meta?.['kg'] ?? 0);
    return kg;
  });

  protected readonly tiles = computed<Tile[]>(() =>
    usageOrder(this.kinds().map((k) => ({ ...k, id: kindId(k) })), 'baleKind')
      .filter((k) => this.available(k) > 0)
      .map((k) => ({ id: k.id, label: [k.categoryName, k.gradeName].filter(Boolean).join(' · '), sub: this.i18n.t('stock.available', { kg: this.i18n.kg(this.available(k)) }) })),
  );

  ngOnInit(): void {
    this.data.baleKinds().subscribe((k) => this.kinds.set(k));
    this.data.grades().subscribe((g) => this.grades.set(g));
  }

  protected available(k: BaleKind): number {
    return Math.round((Number(k.availableKg) - (this.pendingKg()[kindId(k)] ?? 0)) * 100) / 100;
  }

  protected pick(tile: Tile): void {
    this.kind.set(this.kinds().find((k) => kindId(k) === tile.id) ?? null);
    this.weightKg.set(null);
    this.gradeId.set(null);
    this.count.set(1);
  }

  protected async save(): Promise<void> {
    const k = this.kind();
    const kg = this.weightKg();
    const count = this.count();
    if (!k || !kg) return;
    // Ungraded kg given a grade now: the bale gets the grade, the kg comes from the ungraded pile.
    const regrade = !k.gradeId && this.gradeId();
    const gradeName = regrade ? this.gradeOptions().find((g) => g.id === this.gradeId())?.name : k.gradeName;
    this.saving.set(true);
    try {
      const r = await this.queue.send<MadeBale>({
        kind: 'bale',
        label: `${[k.categoryName, gradeName].filter(Boolean).join(' · ')} · ${count > 1 ? `${this.i18n.num(count)} × ` : ''}${this.i18n.kg(kg)}`,
        url: '/api/stock/bales',
        body: {
          categoryId: k.categoryId,
          ...(k.gradeId ? { gradeId: k.gradeId } : regrade ? { gradeId: this.gradeId(), fromUngraded: true } : {}),
          weightKg: kg,
          ...(count > 1 ? { count } : {}),
          ...(this.pieces() ? { pieces: this.pieces() } : {}),
        },
        meta: { kind: kindId(k), kg: kg * count },
      });
      countUse('baleKind', kindId(k));
      this.count.set(1);
      this.made.set(r.saved ? { id: r.response.id, ids: r.response.baleIds ?? [r.response.id], code: r.response.unitCode, kg } : { id: null, ids: [], code: null, kg });
      if (r.saved) this.data.baleKinds().subscribe((list) => this.kinds.set(list));
      this.toast.show(r.saved ? this.i18n.t('stock.baleSaved', { code: r.response.unitCode, kg: this.i18n.kg(kg) }) : this.i18n.t('sync.savedOnPhone'));
      this.weightKg.set(null);
      this.pieces.set(null);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
