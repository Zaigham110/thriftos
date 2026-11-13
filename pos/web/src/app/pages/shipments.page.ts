import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, MoneyPipe } from '../core';

export interface Shipment {
  id: string;
  code: string;
  supplier: { name: string };
  originCountry: string | null;
  containerNo: string | null;
  billOfLadingNo: string | null;
  invoiceNo: string | null;
  vessel: string | null;
  portOfLoading: string | null;
  portOfArrival: string | null;
  shippedOn: string | null;
  arrivedOn: string;
  goodsCost: string;
  freight: string;
  customsDuty: string;
  clearing: string;
  transport: string;
  otherCharges: string;
  landedCost: string;
  baleCount: number;
  balesLeft: number;
  totalWeightKg: string | null;
  fileName: string | null;
  notes: string | null;
}

@Component({
  imports: [RouterLink, MoneyPipe, DatePipe],
  template: `
    <div class="screen max-w-5xl">
      <div class="flex items-center justify-between gap-3">
        <h1>Shipments</h1>
        <a routerLink="/shipments/new" class="btn-primary">Import a bale list</a>
      </div>

      @if (list(); as rows) {
        <div class="card mt-4 divide-y divide-stone-100">
          @for (s of rows; track s.id) {
            <a [routerLink]="['/shipments', s.id]" class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50">
              <div class="min-w-0">
                <div class="text-sm font-semibold">{{ s.code }} <span class="font-normal text-stone-600">· {{ s.supplier.name }}</span></div>
                <div class="mt-0.5 truncate text-xs text-stone-500">
                  Arrived {{ s.arrivedOn | date: 'd MMM y' : 'UTC' }}
                  @if (s.containerNo) {
                    · Container {{ s.containerNo }}
                  }
                  @if (s.originCountry) {
                    · {{ s.originCountry }}
                  }
                </div>
              </div>
              <div class="shrink-0 text-right">
                <div class="num text-sm font-semibold">{{ s.landedCost | money }}</div>
                <div class="text-xs text-stone-500">{{ s.balesLeft }} of {{ s.baleCount }} bales left</div>
              </div>
            </a>
          } @empty {
            <div class="px-4 py-10 text-center">
              <p class="text-sm text-stone-600">No shipments yet. Import your first bale list to fill your stock.</p>
              <a routerLink="/shipments/new" class="btn-primary mt-4">Import a bale list</a>
            </div>
          }
        </div>
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class ShipmentsPage implements OnInit {
  private readonly api = inject(Api);
  readonly list = signal<Shipment[] | null>(null);
  readonly error = signal('');

  async ngOnInit() {
    try {
      this.list.set(await this.api.get<Shipment[]>('/shipments'));
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }
}
