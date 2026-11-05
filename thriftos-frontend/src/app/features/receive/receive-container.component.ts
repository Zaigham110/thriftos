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
import { COMMON_COUNTRIES, COUNTRIES } from '../../shared/countries';
import { SupplierPickerComponent, supplierRef } from './supplier-picker.component';

const CHARGES = ['DUTY', 'TAX', 'CLEARING', 'PORT_HANDLING', 'FREIGHT', 'TRANSPORT', 'LABOUR', 'MISC'] as const;
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
type ChargeType = (typeof CHARGES)[number];

interface SavedContainer {
  id: string;
  containerNumber: string;
  landedCostPerKg: string | null;
  rags: { id: string; ragCode: string }[];
}

/**
 * Journey 1 — a container arrives (< 60 s). Required: supplier, invoice kg, purchase cost (+ rate if not PKR).
 * Charges are quick chips; kanta weight, container number, country, date and raw type are under "More details".
 * It is saved as arrived, on today's date unless another day is picked.
 * Saved in one request (container + charges + one lot ready to sort); offline it is kept on the phone.
 */
@Component({
  selector: 'app-receive-container',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent, SupplierPickerComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/receive" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'receive.container' | t }}</h1>
      </header>

      @if (done(); as d) {
        <section class="card done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="34" class="good" />
          <h2>{{ d.code }} · {{ 'receive.readyToSort' | t }}</h2>
          <p class="big-number">{{ 'receive.landedPerKg' | t: { rs: (d.perKg | rs) } }}</p>
          @if (!d.saved) { <p class="hint">{{ 'sync.savedOnPhone' | t }}</p> }
          @if (d.lotId) { <a class="btn primary block" [routerLink]="['/sort', d.lotId]">{{ 'nav.sort' | t }}</a> }
          <button type="button" class="btn block" (click)="reset()">{{ 'common.new' | t }}</button>
        </section>
      } @else {
        <section class="card">
          <h2>{{ 'receive.whichSupplier' | t }}</h2>
          <app-supplier-picker (picked)="pickSupplier($event)" />
        </section>

        <section class="card">
          <tos-number label="receive.invoiceKg" unit="unit.kgShort" [(value)]="invoiceKg" />
          <div class="chips" role="group" [attr.aria-label]="'receive.currency' | t">
            @for (c of currencies; track c) { <button type="button" class="chip" [class.on]="currency() === c" (click)="currency.set(c)">{{ c }}</button> }
          </div>
          <tos-number label="receive.purchaseCost" [unit]="currency()" [(value)]="purchaseCost" />
          @if (currency() !== 'PKR') { <tos-number label="receive.fxRate" unit="Rs" [decimals]="4" [(value)]="fxRate" /> }
        </section>

        <section class="card">
          <h2>{{ 'receive.charges' | t }}</h2>
          <div class="chips">
            @for (c of chargeTypes; track c) { <button type="button" class="chip" [class.on]="charges()[c] !== undefined" (click)="toggleCharge(c)">{{ 'receive.charge.' + c | t }}</button> }
          </div>
          @for (c of chargeTypes; track c) {
            @if (charges()[c] !== undefined) { <tos-number [label]="'receive.charge.' + c" unit="Rs" [value]="charges()[c] ?? null" (valueChange)="setCharge(c, $event)" /> }
          }
          <p class="hint">{{ 'receive.chargesLater' | t }}</p>
        </section>

        <details class="more card">
          <summary>{{ 'common.more' | t }}</summary>
          <tos-number label="receive.weighbridgeKg" unit="unit.kgShort" [optional]="true" [(value)]="kantaKg" />
          <label class="field">{{ 'receive.containerNo' | t }}<input [(ngModel)]="containerNumber" name="containerNumber" maxlength="50" autocomplete="off" class="ltr" /></label>
          <span class="field">{{ 'receive.origin' | t }}</span>
          <div class="chips" role="group" [attr.aria-label]="'receive.origin' | t">
            @for (c of commonCountries; track c) { <button type="button" class="chip" [class.on]="origin() === c" (click)="origin.set(c)">{{ c }}</button> }
            <button type="button" class="chip" [class.on]="otherCountry()" (click)="otherCountry.set(true)">{{ 'ws.cf.otherCountry' | t }}</button>
          </div>
          @if (otherCountry()) {
            <label class="field">{{ 'common.country' | t }}<input [ngModel]="origin()" (ngModelChange)="origin.set($event)" name="originOther" list="floor-countries" maxlength="60" autocomplete="off" /></label>
            <datalist id="floor-countries">@for (c of countries; track c) { <option [value]="c"></option> }</datalist>
          }
          <label class="field">{{ 'ws.cf.date' | t }}<input type="date" [(ngModel)]="date" name="date" [max]="maxDay" /></label>
          @if (rawTypes().length > 1) {
            <span class="field">{{ 'ws.cf.rawType' | t }}</span>
            <div class="chips" role="group" [attr.aria-label]="'ws.cf.rawType' | t">
              @for (r of rawTypes(); track r.id) { <button type="button" class="chip" [class.on]="rawType() === r.id" (click)="rawType.set(r.id)">{{ r.name }}</button> }
            </div>
          }
        </details>

        @if (missing().length) { <p class="hint missing" role="status">{{ 'ws.cf.missing' | t }} {{ missingText() }}</p> }

        <footer class="action-bar">
          <div class="summary"><small>{{ 'common.costPerKg' | t }}</small><strong>{{ perKg() === null ? '—' : (perKg() | rs) }}</strong></div>
          <button type="button" class="btn primary" [disabled]="!canSave() || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'receive.saveContainer') | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`.done { justify-items:center; text-align:center; } .done h2 { font-size:20px; } .missing { margin:0; padding-block-end:96px; }`],
})
export class ReceiveContainerComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2 };
  protected readonly currencies = ['PKR', 'USD'];
  protected readonly chargeTypes = CHARGES;
  protected readonly countries = COUNTRIES;
  protected readonly commonCountries = COMMON_COUNTRIES;
  protected readonly maxDay = today();
  protected readonly otherCountry = signal(false);
  protected readonly rawTypes = signal<{ id: string; name: string }[]>([]);
  protected readonly rawType = signal<string | null>(null);
  protected date = today();

  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly invoiceKg = signal<number | null>(null);
  protected readonly kantaKg = signal<number | null>(null);
  protected readonly purchaseCost = signal<number | null>(null);
  protected readonly currency = signal('PKR');
  protected readonly fxRate = signal<number | null>(null);
  protected readonly origin = signal<string | null>(null);
  protected readonly charges = signal<Partial<Record<ChargeType, number | null>>>({});
  protected readonly saving = signal(false);
  protected readonly done = signal<{ code: string; perKg: number; lotId: string | null; saved: boolean } | null>(null);
  protected containerNumber = '';

  /** Landed cost per kg as it will be saved: purchase × rate + charges, over the lot weight. */
  protected readonly perKg = computed(() => {
    const kg = this.kantaKg() ?? this.invoiceKg();
    const cost = this.purchaseCost();
    if (!kg || cost === null) return null;
    const rate = this.currency() === 'PKR' ? 1 : this.fxRate();
    if (!rate) return null;
    const charges = Object.values(this.charges()).reduce<number>((s, v) => s + (v || 0), 0);
    return Math.round(((cost * rate + charges) / kg) * 100) / 100;
  });

  /** What stops saving, said in words above the Save button. */
  protected readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.supplier()) m.push('ws.cf.need.supplier');
    if (!this.invoiceKg()) m.push('ws.cf.need.kg');
    if (this.purchaseCost() === null) m.push('ws.cf.need.cost');
    if (this.currency() !== 'PKR' && !this.fxRate()) m.push('ws.cf.need.rate');
    if ((this.kantaKg() ?? 0) > (this.invoiceKg() ?? 0) && this.invoiceKg()) m.push('ws.cf.need.kanta');
    return m;
  });
  protected readonly canSave = computed(() => this.missing().length === 0);
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

  protected pickSupplier(s: Supplier): void {
    this.supplier.set(s);
    if (s.originCountry) this.origin.set(s.originCountry);
  }

  protected toggleCharge(c: ChargeType): void {
    this.charges.update((all) => {
      const next = { ...all };
      if (c in next) delete next[c];
      else next[c] = null;
      return next;
    });
  }

  protected setCharge(c: ChargeType, v: number | null): void {
    this.charges.update((all) => ({ ...all, [c]: v }));
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const s = this.supplier()!;
    const body = {
      vendorId: supplierRef(this.queue, s.id),
      netWeightKg: this.invoiceKg(),
      ...(this.kantaKg() ? { weighbridgeKg: this.kantaKg() } : {}),
      purchaseCost: this.purchaseCost(),
      purchaseCurrency: this.currency(),
      ...(this.currency() !== 'PKR' ? { fxRate: this.fxRate() } : {}),
      ...(this.origin() ? { originCountry: this.origin() } : {}),
      ...(this.containerNumber.trim() ? { containerNumber: this.containerNumber.trim() } : {}),
      charges: Object.entries(this.charges())
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([chargeType, amount]) => ({ chargeType, amount })),
      withLot: true,
      status: 'ARRIVED',
      ...(this.date && this.date !== today() ? { receivedAt: this.date } : {}),
      ...(this.rawType() ? { rawCategoryId: this.rawType() } : {}),
    };
    this.saving.set(true);
    const perKg = this.perKg() ?? 0;
    try {
      const r = await this.queue.send<SavedContainer>({
        kind: 'receive',
        label: `${this.i18n.t('receive.container')} · ${s.name} · ${this.i18n.kg(this.invoiceKg())}`,
        url: '/api/procurement/containers',
        body,
      });
      this.done.set(
        r.saved
          ? { code: r.response.containerNumber, perKg: Number(r.response.landedCostPerKg ?? perKg), lotId: r.response.rags[0]?.id ?? null, saved: true }
          : { code: s.name, perKg, lotId: null, saved: false },
      );
      this.toast.show(this.i18n.t('receive.readyToSort'));
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  protected reset(): void {
    this.done.set(null);
    this.invoiceKg.set(null);
    this.kantaKg.set(null);
    this.purchaseCost.set(null);
    this.fxRate.set(null);
    this.charges.set({});
    this.containerNumber = '';
    this.date = today();
  }
}
