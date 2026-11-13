import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Bale, MoneyPipe, STATUS_LABEL, STATUS_TONE } from '../core';
import { Shipment } from './shipments.page';

type Detail = Shipment & { bales: Bale[]; soldAmount: string; soldCost: string };

@Component({
  imports: [RouterLink, MoneyPipe, DatePipe],
  template: `
    <div class="screen max-w-5xl">
      <a routerLink="/shipments" class="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700">‹ Shipments</a>
      @if (data(); as s) {
        <h1 class="mt-1">{{ s.code }} · {{ s.supplier.name }}</h1>
        <p class="text-sm text-stone-600">Arrived {{ s.arrivedOn | date: 'd MMMM y' : 'UTC' }}</p>

        <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div class="card p-4"><div class="text-xs text-stone-500">Bales left</div><div class="num mt-1 text-xl font-semibold xl:text-2xl">{{ left() }} <span class="text-sm font-normal text-stone-500">of {{ s.baleCount }}</span></div></div>
          <div class="card p-4"><div class="text-xs text-stone-500">Total cost</div><div class="num mt-1 text-xl font-semibold xl:text-2xl">{{ s.landedCost | money }}</div></div>
          <div class="card p-4"><div class="text-xs text-stone-500">Sold so far</div><div class="num mt-1 text-xl font-semibold xl:text-2xl">{{ s.soldAmount | money }}</div></div>
          <div class="card p-4"><div class="text-xs text-stone-500">Profit so far</div><div class="num mt-1 text-xl font-semibold xl:text-2xl">{{ +s.soldAmount - +s.soldCost | money }}</div></div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section class="card p-4">
            <h2 class="text-sm font-semibold">Shipping papers</h2>
            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              @for (row of papers(); track row[0]) {
                <dt class="text-stone-500">{{ row[0] }}</dt>
                <dd class="font-medium">{{ row[1] || '—' }}</dd>
              }
            </dl>
          </section>
          <section class="card p-4">
            <h2 class="text-sm font-semibold">Cost</h2>
            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              @for (row of costs(); track row[0]) {
                <dt class="text-stone-500">{{ row[0] }}</dt>
                <dd class="num text-right font-medium">{{ row[1] | money }}</dd>
              }
              <dt class="border-t border-stone-200 pt-2 font-semibold">Total</dt>
              <dd class="num border-t border-stone-200 pt-2 text-right font-semibold">{{ s.landedCost | money }}</dd>
            </dl>
          </section>
        </div>

        <h2 class="mb-2 mt-6 text-sm font-semibold text-stone-700">Bales</h2>
        <div class="card overflow-x-auto">
          <table class="w-full min-w-[640px]">
            <thead class="border-b border-stone-200 bg-stone-50">
              <tr><th class="th">Bale</th><th class="th">Item</th><th class="th text-right">Kg</th><th class="th text-right">Full cost</th><th class="th text-right">Bale price</th><th class="th">Status</th></tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              @for (b of s.bales; track b.id) {
                <tr class="hover:bg-stone-50">
                  <td class="td whitespace-nowrap"><a [routerLink]="['/stock', b.id]" class="inline-flex min-h-[40px] items-center font-semibold text-brand-700 underline">{{ b.code }}</a><div class="text-xs text-stone-500">{{ b.baleNo }}</div></td>
                  <td class="td"><div class="font-medium">{{ b.item }}</div><div class="text-xs text-stone-500">{{ b.category }}{{ b.category && b.grade ? ' · ' : '' }}{{ b.grade }}</div></td>
                  <td class="td num text-right">{{ b.weightKg ?? '—' }}</td>
                  <td class="td num text-right">{{ b.landedCost | money }}</td>
                  <td class="td num text-right">{{ b.salePrice | money }}</td>
                  <td class="td"><span class="tag" [class]="tone[b.status]">{{ label[b.status] }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class ShipmentPage implements OnInit {
  private readonly api = inject(Api);
  readonly id = input.required<string>();
  readonly data = signal<Detail | null>(null);
  readonly error = signal('');
  readonly label = STATUS_LABEL;
  readonly tone = STATUS_TONE;

  readonly left = computed(() => this.data()?.bales.filter((b) => b.status === 'IN_STOCK' || b.status === 'OPENED').length ?? 0);
  readonly papers = computed((): [string, string | null][] => {
    const s = this.data()!;
    return [
      ['Country', s.originCountry], ['Container no.', s.containerNo], ['Bill of lading', s.billOfLadingNo], ['Invoice no.', s.invoiceNo],
      ['Vessel', s.vessel], ['Port of loading', s.portOfLoading], ['Port of arrival', s.portOfArrival],
      ['Shipped on', s.shippedOn?.slice(0, 10) ?? null], ['Weight', s.totalWeightKg ? `${s.totalWeightKg} kg` : null], ['File', s.fileName], ['Notes', s.notes],
    ];
  });
  readonly costs = computed((): [string, string][] => {
    const s = this.data()!;
    return [['Goods', s.goodsCost], ['Freight', s.freight], ['Customs duty', s.customsDuty], ['Clearing agent', s.clearing], ['Transport', s.transport], ['Other', s.otherCharges]];
  });

  async ngOnInit() {
    try {
      this.data.set(await this.api.get<Detail>(`/shipments/${this.id()}`));
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }
}
