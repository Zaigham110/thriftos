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

/**
 * A loose lot bought locally: weight and price (a total or a rate per kg), transport/labour/other charges, a photo of
 * the bill, supplier (optional), raw type and day. Ready to sort straight away.
 */
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
          <div class="chips" role="radiogroup" [attr.aria-label]="'ws.lf.priceAs' | t">
            <button type="button" class="chip" role="radio" [attr.aria-checked]="!byRate()" [class.on]="!byRate()" (click)="byRate.set(false)">{{ 'ws.lf.total' | t }}</button>
            <button type="button" class="chip" role="radio" [attr.aria-checked]="byRate()" [class.on]="byRate()" (click)="byRate.set(true)">{{ 'ws.lf.rate' | t }}</button>
          </div>
          @if (byRate()) {
            <tos-number label="ws.lf.ratePerKg" unit="Rs" [(value)]="rate" />
            <p class="hint">{{ 'ws.lf.priceIs' | t: { amount: price() === null ? '—' : (price() | rs) } }}</p>
          } @else {
            <tos-number label="receive.purchaseCost" unit="Rs" [(value)]="cost" />
          }
        </section>
        <section class="card">
          <h2>{{ 'ws.lf.charges' | t }} · {{ 'common.optional' | t }}</h2>
          <tos-number label="ws.lf.kind.TRANSPORT" unit="Rs" [(value)]="transport" />
          <tos-number label="ws.lf.kind.LABOUR" unit="Rs" [(value)]="labour" />
          <tos-number label="ws.lf.kind.OTHER" unit="Rs" [(value)]="other" />
        </section>
        <section class="card">
          <h2>{{ 'ws.lf.billPhoto' | t }} · {{ 'common.optional' | t }}</h2>
          @if (photo(); as f) {
            <p class="file"><span>{{ f.name }}</span><button type="button" class="btn" (click)="photo.set(null)">{{ 'common.remove' | t }}</button></p>
          } @else {
            <label class="btn block pick">{{ 'ws.lf.takePhoto' | t }}<input type="file" accept="image/*,application/pdf" capture="environment" (change)="pickPhoto($event)" /></label>
          }
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
  styles: [`.done { justify-items:center; text-align:center; } .missing { margin:0; padding-block-end:96px; }
    .pick { position:relative; } .pick input { position:absolute; inset:0; opacity:0; }
    .file { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0; } .file span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }`],
})
export class ReceiveLotComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2 };
  protected readonly weightKg = signal<number | null>(null);
  protected readonly cost = signal<number | null>(null);
  /** Price typed as a rate per kg (price = kg × rate). */
  protected readonly byRate = signal(false);
  protected readonly rate = signal<number | null>(null);
  protected readonly transport = signal<number | null>(null);
  protected readonly labour = signal<number | null>(null);
  protected readonly other = signal<number | null>(null);
  protected readonly photo = signal<File | null>(null);
  protected readonly price = computed(() =>
    this.byRate() ? (this.weightKg() && this.rate() !== null ? Math.round(this.weightKg()! * this.rate()! * 100) / 100 : null) : this.cost(),
  );
  private readonly chargesTotal = computed(() => (this.transport() ?? 0) + (this.labour() ?? 0) + (this.other() ?? 0));
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly saving = signal(false);
  protected readonly done = signal<{ code: string; lotId: string | null; saved: boolean } | null>(null);
  protected readonly maxDay = today();
  protected date = today();
  protected readonly rawTypes = signal<{ id: string; name: string }[]>([]);
  protected readonly rawType = signal<string | null>(null);
  protected readonly missing = computed(() => [
    ...(!this.weightKg() ? ['ws.lf.needKg'] : []),
    ...(this.price() === null ? [this.byRate() ? 'ws.lf.needRate' : 'ws.lf.needPrice'] : []),
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

  /** Cost per kg of the lot: price and charges together. */
  protected readonly perKg = computed(() => (this.weightKg() && this.price() !== null ? Math.round(((this.price()! + this.chargesTotal()) / this.weightKg()!) * 100) / 100 : null));

  protected pickPhoto(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) { this.toast.error(this.i18n.t('ws.lf.docTooBig', { name: f.name })); return; }
    this.photo.set(f);
  }

  protected async save(): Promise<void> {
    const s = this.supplier();
    const body = {
      ragBaleType: 'BALE', weightKg: this.weightKg(),
      ...(this.byRate() ? { ratePerKg: this.rate() } : { purchaseCost: this.cost() }),
      charges: ([['TRANSPORT', this.transport()], ['LABOUR', this.labour()], ['OTHER', this.other()]] as const)
        .filter(([, a]) => (a ?? 0) > 0).map(([kind, amount]) => ({ kind, amount })),
      ...(s ? { vendorId: supplierRef(this.queue, s.id) } : {}),
      ...(this.rawType() ? { rawCategoryId: this.rawType() } : {}),
      ...(this.date && this.date !== today() ? { receivedAt: this.date } : {}),
    };
    this.saving.set(true);
    try {
      const r = await this.queue.send<{ id: string; ragCode: string }>({ kind: 'receive', label: `${this.i18n.t('receive.lot')} · ${this.i18n.kg(this.weightKg())}`, url: '/api/procurement/rags', body });
      this.done.set(r.saved ? { code: r.response.ragCode, lotId: r.response.id, saved: true } : { code: '', lotId: null, saved: false });
      // The bill photo goes with the lot when it is saved now; offline, the lot waits and the photo is not kept.
      const photo = this.photo();
      if (photo && r.saved) {
        const form = new FormData();
        form.append('file', photo);
        this.http.post(`/api/records/lot/${r.response.id}/attachments`, form).subscribe({ error: () => this.toast.error(this.i18n.t('ws.lf.docFailed', { n: 1 })) });
      } else if (photo) this.toast.error(this.i18n.t('ws.lf.photoOffline'));
      this.toast.show(this.i18n.t('receive.readyToSort'));
      this.weightKg.set(null);
      this.cost.set(null);
      this.rate.set(null);
      this.transport.set(null);
      this.labour.set(null);
      this.other.set(null);
      this.photo.set(null);
      this.date = today();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
