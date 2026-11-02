import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { Supplier } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';
import { SupplierPickerComponent, supplierRef } from './supplier-picker.component';

/** A loose lot bought locally: weight and price (supplier optional). Ready to sort straight away. */
@Component({
  selector: 'app-receive-lot',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent, SupplierPickerComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/receive" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'receive.lot' | t }}</h1>
      </header>
      @if (done(); as d) {
        <section class="card done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="34" class="good" />
          <h2>{{ d.saved ? ('receive.lotSaved' | t: { code: d.code }) : ('sync.savedOnPhone' | t) }}</h2>
          @if (d.lotId) { <a class="btn primary block" [routerLink]="['/sort', d.lotId]">{{ 'nav.sort' | t }}</a> }
          <button type="button" class="btn block" (click)="done.set(null)">{{ 'common.new' | t }}</button>
        </section>
      } @else {
        <section class="card">
          <tos-number label="receive.lotWeight" unit="unit.kgShort" [(value)]="weightKg" />
          <tos-number label="receive.purchaseCost" unit="Rs" [(value)]="cost" />
        </section>
        <details class="more card">
          <summary>{{ 'common.supplier' | t }} · {{ 'common.optional' | t }}</summary>
          <app-supplier-picker (picked)="supplier.set($event)" />
        </details>
        <footer class="action-bar">
          <div class="summary"><small>{{ 'common.costPerKg' | t }}</small><strong>{{ perKg() === null ? '—' : (perKg() | rs) }}</strong></div>
          <button type="button" class="btn primary" [disabled]="!weightKg() || cost() === null || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'receive.saveLot') | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`.done { justify-items:center; text-align:center; }`],
})
export class ReceiveLotComponent {
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2 };
  protected readonly weightKg = signal<number | null>(null);
  protected readonly cost = signal<number | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly saving = signal(false);
  protected readonly done = signal<{ code: string; lotId: string | null; saved: boolean } | null>(null);
  protected readonly perKg = computed(() => (this.weightKg() && this.cost() !== null ? Math.round((this.cost()! / this.weightKg()!) * 100) / 100 : null));

  protected async save(): Promise<void> {
    const s = this.supplier();
    const body = { ragBaleType: 'BALE', weightKg: this.weightKg(), purchaseCost: this.cost(), ...(s ? { vendorId: supplierRef(this.queue, s.id) } : {}) };
    this.saving.set(true);
    try {
      const r = await this.queue.send<{ id: string; ragCode: string }>({ kind: 'receive', label: `${this.i18n.t('receive.lot')} · ${this.i18n.kg(this.weightKg())}`, url: '/api/procurement/rags', body });
      this.done.set(r.saved ? { code: r.response.ragCode, lotId: r.response.id, saved: true } : { code: '', lotId: null, saved: false });
      this.toast.show(this.i18n.t('receive.readyToSort'));
      this.weightKg.set(null);
      this.cost.set(null);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
