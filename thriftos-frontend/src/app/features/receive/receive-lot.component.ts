import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { Supplier } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';
import { SupplierPickerComponent, supplierRef } from './supplier-picker.component';

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/** A loose lot bought locally: weight and price, supplier (optional), raw type and day. Ready to sort straight away. */
@Component({
  selector: 'app-receive-lot',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent, SupplierPickerComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/receive" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'ws.new.gaari' | t }}</h1>
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
        <section class="card">
          <h2>{{ 'common.supplier' | t }} · {{ 'common.optional' | t }}</h2>
          <app-supplier-picker (picked)="supplier.set($event)" />
        </section>
        <details class="more card">
          <summary>{{ 'common.more' | t }}</summary>
          @if (rawTypes().length > 1) {
            <span class="field">{{ 'ws.cf.rawType' | t }}</span>
            <div class="chips" role="group" [attr.aria-label]="'ws.cf.rawType' | t">
              @for (r of rawTypes(); track r.id) { <button type="button" class="chip" [class.on]="rawType() === r.id" (click)="rawType.set(r.id)">{{ r.name }}</button> }
            </div>
          }
          <label class="field">{{ 'ws.lf.date' | t }}<input type="date" [(ngModel)]="date" name="date" [max]="maxDay" /></label>
        </details>
        @if (missing().length) { <p class="hint missing" role="status">{{ 'ws.cf.missing' | t }} {{ missingText() }}</p> }
        <footer class="action-bar">
          <div class="summary"><small>{{ 'common.costPerKg' | t }}</small><strong>{{ perKg() === null ? '—' : (perKg() | rs) }}</strong></div>
          <button type="button" class="btn primary" [disabled]="missing().length > 0 || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'receive.saveLot') | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`.done { justify-items:center; text-align:center; } .missing { margin:0; padding-block-end:96px; }`],
})
export class ReceiveLotComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2 };
  protected readonly weightKg = signal<number | null>(null);
  protected readonly cost = signal<number | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly saving = signal(false);
  protected readonly done = signal<{ code: string; lotId: string | null; saved: boolean } | null>(null);
  protected readonly maxDay = today();
  protected date = today();
  protected readonly rawTypes = signal<{ id: string; name: string }[]>([]);
  protected readonly rawType = signal<string | null>(null);
  protected readonly missing = computed(() => [
    ...(!this.weightKg() ? ['ws.lf.needKg'] : []),
    ...(this.cost() === null ? ['ws.lf.needPrice'] : []),
  ]);
  protected readonly missingText = computed(() => this.missing().map((k) => this.i18n.t(k)).join(' · '));

  ngOnInit(): void {
    this.http.get<{ id: string; name: string; rawType?: string }[]>('/api/tenant/raw-categories').subscribe({
      next: (l) => {
        this.rawTypes.set(l ?? []);
        this.rawType.set((l ?? []).find((r) => r.rawType === 'BALE')?.id ?? l?.[0]?.id ?? null);
      },
      error: () => this.rawTypes.set([]),
    });
  }

  protected readonly perKg = computed(() => (this.weightKg() && this.cost() !== null ? Math.round((this.cost()! / this.weightKg()!) * 100) / 100 : null));

  protected async save(): Promise<void> {
    const s = this.supplier();
    const body = {
      ragBaleType: 'BALE', weightKg: this.weightKg(), purchaseCost: this.cost(),
      ...(s ? { vendorId: supplierRef(this.queue, s.id) } : {}),
      ...(this.rawType() ? { rawCategoryId: this.rawType() } : {}),
      ...(this.date && this.date !== today() ? { receivedAt: this.date } : {}),
    };
    this.saving.set(true);
    try {
      const r = await this.queue.send<{ id: string; ragCode: string }>({ kind: 'receive', label: `${this.i18n.t('receive.lot')} · ${this.i18n.kg(this.weightKg())}`, url: '/api/procurement/rags', body });
      this.done.set(r.saved ? { code: r.response.ragCode, lotId: r.response.id, saved: true } : { code: '', lotId: null, saved: false });
      this.toast.show(this.i18n.t('receive.readyToSort'));
      this.weightKg.set(null);
      this.cost.set(null);
      this.date = today();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
