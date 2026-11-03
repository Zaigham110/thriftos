import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, Printer } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { BaleKind, FloorDataService, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

interface MadeBale { id: string; unitCode: string; weightKg: string }

const kindId = (k: { categoryId: string; gradeId: string | null }) => `${k.categoryId}:${k.gradeId ?? ''}`;

/**
 * Journey 3 — make a bale: pick what (category or category + grade, with kg available) → bale weight → Save.
 * Stock is taken FIFO from sorted outputs. Then "Print label". Works offline.
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
          @if (m.id) { <a class="btn primary block" [routerLink]="['/stock/label', m.id]"><lucide-icon [img]="icons.Printer" [size]="20" /> {{ 'stock.printLabel' | t }}</a> }
          <button type="button" class="btn block" (click)="made.set(null)">{{ 'stock.makeBale' | t }}</button>
        </section>
      } @else {
        <section class="card">
          <h2>{{ 'stock.pickKind' | t }}</h2>
          <tos-tiles [items]="tiles()" [selected]="kind() ? id(kind()!) : null" [limit]="40" [columns]="2" emptyText="stock.empty" (pick)="pick($event)" />
        </section>
        @if (kind(); as k) {
          <section class="card">
            <tos-number label="stock.baleWeight" unit="unit.kgShort" [max]="available(k)" maxMessage="sort.tooMuch" [(value)]="weightKg" />
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
  styles: [`.done { justify-items:center; text-align:center; }`],
})
export class MakeBaleComponent implements OnInit {
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2, Printer };
  protected readonly id = kindId;
  private readonly kinds = signal<BaleKind[]>([]);
  protected readonly kind = signal<BaleKind | null>(null);
  protected readonly weightKg = signal<number | null>(null);
  protected readonly pieces = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly made = signal<{ id: string | null; code: string | null; kg: number } | null>(null);

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
  }

  protected available(k: BaleKind): number {
    return Math.round((Number(k.availableKg) - (this.pendingKg()[kindId(k)] ?? 0)) * 100) / 100;
  }

  protected pick(tile: Tile): void {
    this.kind.set(this.kinds().find((k) => kindId(k) === tile.id) ?? null);
    this.weightKg.set(null);
  }

  protected async save(): Promise<void> {
    const k = this.kind();
    const kg = this.weightKg();
    if (!k || !kg) return;
    this.saving.set(true);
    try {
      const r = await this.queue.send<MadeBale>({
        kind: 'bale',
        label: `${[k.categoryName, k.gradeName].filter(Boolean).join(' · ')} · ${this.i18n.kg(kg)}`,
        url: '/api/stock/bales',
        body: { categoryId: k.categoryId, ...(k.gradeId ? { gradeId: k.gradeId } : {}), weightKg: kg, ...(this.pieces() ? { pieces: this.pieces() } : {}) },
        meta: { kind: kindId(k), kg },
      });
      countUse('baleKind', kindId(k));
      this.made.set(r.saved ? { id: r.response.id, code: r.response.unitCode, kg } : { id: null, code: null, kg });
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
