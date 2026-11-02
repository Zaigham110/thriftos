import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, PackageOpen } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { Supplier } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';
import { SupplierPickerComponent, supplierRef } from './supplier-picker.component';

type Unit = 'KG' | 'BALE' | 'PIECE';
interface StockItem { id: string; name: string | null; unit: Unit; remainingQuantity: string; category?: { name: string } | null }

/**
 * Journey 5 — stock bought ready to sell (a trader with no sorting). Required: what, counted in, how many,
 * total cost. Supplier, weight and sale price are under "More details". Bales bought here can be opened into pieces.
 */
@Component({
  selector: 'app-receive-ready',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent, SupplierPickerComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/receive" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'receive.ready' | t }}</h1>
      </header>

      <section class="card">
        <label class="field">{{ 'receive.whatItem' | t }}<input [(ngModel)]="name" name="name" maxlength="120" [placeholder]="'receive.itemName' | t" autocomplete="off" /></label>
        <div class="chips" role="group" [attr.aria-label]="'receive.countedIn' | t">
          @for (u of units; track u.value) { <button type="button" class="chip" [class.on]="unit() === u.value" (click)="unit.set(u.value)">{{ u.label | t }}</button> }
        </div>
        <tos-number label="receive.howMany" [unit]="unitKey()" [decimals]="unit() === 'KG' ? 2 : 0" [(value)]="quantity" />
        <tos-number label="receive.totalCost" unit="Rs" [(value)]="totalCost" />
      </section>

      <details class="more card">
        <summary>{{ 'common.more' | t }}</summary>
        <app-supplier-picker (picked)="supplier.set($event)" />
        @if (unit() === 'BALE') { <tos-number label="common.weight" unit="unit.kgShort" [optional]="true" [(value)]="weightKg" /> }
        <tos-number label="receive.salePrice" unit="Rs" [optional]="true" [(value)]="salePrice" />
      </details>

      @if (bales().length) {
        <section class="card">
          <h2>{{ 'receive.openBale' | t }}</h2>
          <ul class="list">
            @for (b of bales(); track b.id) {
              <li><a class="row" [routerLink]="['/receive/ready/open', b.id]"><span><strong>{{ b.name || b.category?.name }}</strong><small>{{ 'stock.left' | t: { n: (b.remainingQuantity | num) } }} {{ 'unit.bales' | t }}</small></span><lucide-icon [img]="icons.PackageOpen" [size]="22" /></a></li>
            }
          </ul>
        </section>
      }

      <footer class="action-bar">
        <div class="summary"><small>{{ 'common.cost' | t }} / {{ unitKey() | t }}</small><strong>{{ perUnit() === null ? '—' : (perUnit() | rs) }}</strong></div>
        <button type="button" class="btn primary" [disabled]="!canSave() || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'receive.saveStock') | t }}</button>
      </footer>
    </section>
  `,
})
export class ReceiveReadyComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, PackageOpen };
  protected readonly units: { value: Unit; label: string }[] = [
    { value: 'BALE', label: 'unit.bales' },
    { value: 'KG', label: 'unit.kgShort' },
    { value: 'PIECE', label: 'unit.pieces' },
  ];
  protected readonly unit = signal<Unit>('BALE');
  protected readonly quantity = signal<number | null>(null);
  protected readonly totalCost = signal<number | null>(null);
  protected readonly weightKg = signal<number | null>(null);
  protected readonly salePrice = signal<number | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly saving = signal(false);
  protected readonly bales = signal<StockItem[]>([]);
  protected name = '';
  protected readonly unitKey = computed(() => ({ KG: 'unit.kgShort', BALE: 'unit.bale', PIECE: 'unit.piece' })[this.unit()]);
  protected readonly perUnit = computed(() => (this.quantity() && this.totalCost() !== null ? Math.round((this.totalCost()! / this.quantity()!) * 100) / 100 : null));

  ngOnInit(): void {
    this.loadBales();
  }

  protected canSave(): boolean {
    return !!this.name.trim() && !!this.quantity() && this.totalCost() !== null;
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const s = this.supplier();
    const body = {
      name: this.name.trim(),
      unit: this.unit(),
      quantity: this.quantity(),
      totalCost: this.totalCost(),
      ...(s ? { vendorId: supplierRef(this.queue, s.id) } : {}),
      ...(this.unit() === 'BALE' && this.weightKg() ? { weightKg: this.weightKg() } : {}),
      ...(this.salePrice() !== null ? { salePrice: this.salePrice() } : {}),
    };
    this.saving.set(true);
    try {
      const r = await this.queue.send({ kind: 'receive', label: `${body.name} · ${this.i18n.num(body.quantity)} ${this.i18n.t(this.unitKey())}`, url: '/api/stock/items', body });
      this.toast.show(this.i18n.t(r.saved ? 'receive.stockSaved' : 'sync.savedOnPhone'));
      this.name = '';
      this.quantity.set(null);
      this.totalCost.set(null);
      this.weightKg.set(null);
      this.salePrice.set(null);
      if (r.saved) this.loadBales();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  private loadBales(): void {
    this.http.get<{ items?: StockItem[] }>(`${API_BASE_URL}/stock/items?source=PURCHASED&status=AVAILABLE&limit=50`).subscribe({
      next: (page) => this.bales.set((page.items ?? []).filter((i) => i.unit === 'BALE')),
      error: () => undefined,
    });
  }
}
