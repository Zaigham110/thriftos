import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';

interface Tier { price: number | null; pieces: number | null }

/** Open a bought bale and count the pieces into price tiers (e.g. 300 / 500 / 800). The bale's cost is shared by piece. */
@Component({
  selector: 'app-open-bale',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/receive/ready" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'receive.openBale' | t }}<span class="sub">{{ itemName() }}</span></h1>
      </header>
      @for (tier of tiers(); track $index; let i = $index) {
        <section class="card">
          <div class="row2">
            <tos-number label="common.price" unit="unit.money" [value]="tier.price" (valueChange)="set(i, 'price', $event)" />
            <tos-number label="stock.pieces" unit="unit.pcs" [decimals]="0" [value]="tier.pieces" (valueChange)="set(i, 'pieces', $event)" />
          </div>
          @if (tiers().length > 1) { <button type="button" class="link-btn" (click)="remove(i)"><lucide-icon [img]="icons.Trash2" [size]="16" /> {{ 'common.remove' | t }}</button> }
        </section>
      }
      <button type="button" class="btn" (click)="add()"><lucide-icon [img]="icons.Plus" [size]="18" /> {{ 'common.price' | t }}</button>
      <footer class="action-bar">
        <div class="summary"><small>{{ 'stock.pieces' | t }}</small><strong>{{ totalPieces() | num }}</strong></div>
        <button type="button" class="btn primary" [disabled]="!valid() || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
      </footer>
    </section>
  `,
})
export class OpenBaleComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly icons = { ArrowLeft, Plus, Trash2 };
  protected readonly tiers = signal<Tier[]>([{ price: null, pieces: null }]);
  protected readonly itemName = signal('');
  protected readonly saving = signal(false);
  protected readonly totalPieces = computed(() => this.tiers().reduce((n, t) => n + (t.pieces || 0), 0));
  protected readonly valid = computed(() => this.tiers().every((t) => t.price !== null && (t.pieces ?? 0) >= 1));

  ngOnInit(): void {
    this.http.get<{ name: string | null; category?: { name: string } }>(`${API_BASE_URL}/stock/items/${this.id()}`).subscribe({
      next: (item) => this.itemName.set(item.name || item.category?.name || ''),
      error: () => undefined,
    });
  }

  protected set(i: number, field: keyof Tier, v: number | null): void {
    this.tiers.update((all) => all.map((t, j) => (j === i ? { ...t, [field]: v } : t)));
  }
  protected add(): void {
    this.tiers.update((all) => [...all, { price: null, pieces: null }]);
  }
  protected remove(i: number): void {
    this.tiers.update((all) => all.filter((_, j) => j !== i));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      const r = await this.queue.send({
        kind: 'receive',
        label: `${this.itemName()} · ${this.totalPieces()} ${this.i18n.t('unit.pcs')}`,
        url: `/api/stock/items/${this.id()}/open`,
        body: { tiers: this.tiers().map((t) => ({ price: t.price, pieces: t.pieces })) },
      });
      this.toast.show(r.saved ? `${this.totalPieces()} ${this.i18n.t('unit.pcs')} · ${this.i18n.t('stock.ready')}` : this.i18n.t('sync.savedOnPhone'));
      this.router.navigate(['/receive/ready']);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
