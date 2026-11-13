import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Bale, MoneyPipe, STATUS_LABEL, STATUS_TONE, typed } from '../core';
import { Printer } from '../hardware/printer';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { OpenBale } from './open-bale';

type Detail = Bale & { sales: { id: string; kind: string; quantity: number; lineTotal: string; sale: { id: string; code: string; createdAt: string } }[] };

@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, OpenBale],
  template: `
    <div class="screen max-w-3xl">
      <a routerLink="/stock" class="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700">‹ Stock</a>
      @if (bale(); as b) {
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <h1>{{ b.item }}</h1>
          <span class="tag" [class]="tone[b.status]">{{ label[b.status] }}</span>
        </div>
        <p class="text-sm text-stone-600">{{ b.code }}{{ b.baleNo ? ' · supplier no. ' + b.baleNo : '' }}</p>

        <div class="mt-4 flex flex-wrap gap-2">
          @if (b.status === 'IN_STOCK') {
            <button class="btn-primary" (click)="opening.set(true)">Open bale to sell pieces</button>
          }
          @if (b.status === 'IN_STOCK' || b.status === 'OPENED') {
            <a class="btn-pay w-auto min-h-[48px] text-sm" routerLink="/" [queryParams]="{ bale: b.code }">Sell</a>
          }
          <button class="btn-soft" (click)="print()">Print sticker</button>
          @if (b.status === 'OPENED' && b.piecesSold === 0) {
            <button class="btn-soft" (click)="act('undo-open', 'The bale is closed again.')">Close again</button>
          }
          @if (b.status === 'OPENED' && api.isManager()) {
            <button class="btn-danger" (click)="finish()">Nothing left to sell</button>
          }
          @if ((b.status === 'IN_STOCK' || b.status === 'OPENED') && api.isManager()) {
            <button class="btn-danger" (click)="writeOff()">Lost or damaged</button>
          }
        </div>

        @if (b.status === 'WRITTEN_OFF' && b.writeOffReason) {
          <p class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Written off: {{ b.writeOffReason }}</p>
        }
        @if (b.status === 'OPENED') {
          <div class="card mt-4 p-4">
            <div class="flex items-baseline justify-between"><span class="text-sm font-medium">Pieces left</span><span class="num text-sm"><b class="text-lg">{{ b.piecesLeft }}</b> of {{ b.pieces }}</span></div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"><div class="h-full rounded-full bg-brand-600" [style.width.%]="b.pieces ? (b.piecesLeft / b.pieces) * 100 : 0"></div></div>
          </div>
        }

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section class="card p-4">
            <h2 class="text-sm font-semibold">Details</h2>
            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt class="text-stone-500">Category</dt><dd class="font-medium">{{ b.category || '—' }}</dd>
              <dt class="text-stone-500">Grade</dt><dd class="font-medium">{{ b.grade || '—' }}</dd>
              <dt class="text-stone-500">Brand</dt><dd class="font-medium">{{ b.brand || '—' }}</dd>
              <dt class="text-stone-500">Weight</dt><dd class="font-medium">{{ b.weightKg ? b.weightKg + ' kg' : '—' }}</dd>
              <dt class="text-stone-500">Pieces</dt><dd class="font-medium">{{ b.pieces ?? '—' }}</dd>
              <dt class="text-stone-500">Shipment</dt>
              <dd class="font-medium">
                @if (api.isOwner()) {
                  <a [routerLink]="['/shipments', b.shipmentId]" class="-my-2 inline-flex min-h-[40px] items-center font-semibold text-brand-700 underline">{{ b.shipment?.code }}</a>
                } @else {
                  {{ b.shipment?.code }}
                }
              </dd>
              <dt class="text-stone-500">Supplier</dt><dd class="font-medium">{{ b.shipment?.supplier?.name || '—' }}</dd>
              <dt class="text-stone-500">Arrived</dt><dd class="font-medium">{{ b.shipment?.arrivedOn | date: 'd MMM y' : 'UTC' }}</dd>
              @if (b.notes) {
                <dt class="text-stone-500">Notes</dt><dd class="font-medium">{{ b.notes }}</dd>
              }
            </dl>
          </section>

          <section class="card p-4">
            <h2 class="text-sm font-semibold">Prices</h2>
            @if (api.seesCost()) {
              <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt class="text-stone-500">Purchase cost</dt><dd class="num text-right font-medium">{{ b.cost | money }}</dd>
                <dt class="text-stone-500">Full cost with charges</dt><dd class="num text-right font-medium">{{ b.landedCost | money }}</dd>
                @if (b.pieceCost) {
                  <dt class="text-stone-500">Cost of one piece</dt><dd class="num text-right font-medium">{{ b.pieceCost | money }}</dd>
                }
              </dl>
            }
            @if (api.isManager()) {
              <form class="mt-3 grid grid-cols-2 gap-3" (ngSubmit)="savePrices()">
                <div><label class="label" for="bp">Bale price</label><input id="bp" class="input num" name="salePrice" inputmode="decimal" [(ngModel)]="salePrice" [disabled]="b.status !== 'IN_STOCK'" /></div>
                <div><label class="label" for="pp">Piece price</label><input id="pp" class="input num" name="piecePrice" inputmode="decimal" [(ngModel)]="piecePrice" /></div>
                <button class="btn-soft col-span-2" [disabled]="busy()">Save prices</button>
              </form>
            } @else {
              <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt class="text-stone-500">Bale price</dt><dd class="num text-right font-medium">{{ b.salePrice | money }}</dd>
                <dt class="text-stone-500">Piece price</dt><dd class="num text-right font-medium">{{ b.piecePrice | money }}</dd>
              </dl>
            }
          </section>
        </div>

        @if (b.sales.length) {
          <h2 class="mb-2 mt-6 text-sm font-semibold text-stone-700">Sold from this bale</h2>
          <div class="card divide-y divide-stone-100">
            @for (l of b.sales; track l.id) {
              <a [routerLink]="['/bills', l.sale.id]" class="flex min-h-[48px] items-center justify-between px-4 py-2 text-sm hover:bg-stone-50">
                <span>{{ l.sale.code }} <span class="text-stone-500">· {{ l.sale.createdAt | date: 'd MMM, h:mm a' }} · {{ l.kind === 'BALE' ? 'whole bale' : l.quantity + ' pcs' }}</span></span>
                <span class="num font-semibold">{{ l.lineTotal | money }}</span>
              </a>
            }
          </div>
        }

        @if (opening()) {
          <pos-open-bale [bale]="b" (closed)="opening.set(false)" (opened)="opening.set(false); api.say('Bale ' + b.code + ' is open.'); shelf.put($event); load()" />
        }
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
    </div>

  `,
})
export class BalePage implements OnInit {
  readonly api = inject(Api);
  readonly id = input.required<string>();
  readonly bale = signal<Detail | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly opening = signal(false);
  readonly label = STATUS_LABEL;
  readonly tone = STATUS_TONE;
  private readonly printer = inject(Printer);
  private readonly ask = inject(Ask);
  readonly shelf = inject(Shelf);
  salePrice = '';
  piecePrice = '';

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      const bale = await this.api.get<Detail>(`/bales/${this.id()}`);
      this.bale.set(bale);
      this.salePrice = bale.salePrice ?? '';
      this.piecePrice = bale.piecePrice ?? '';
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  async print() {
    try {
      await this.printer.labels([this.bale()!]);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async writeOff() {
    const b = this.bale()!;
    const answer = await this.ask.fields('Lost or damaged', `Bale ${b.code} (${b.item}) will be taken off the shelf.`, [{ key: 'reason', label: 'What happened to it', placeholder: 'Wet, torn, not found…' }], 'Write it off', true);
    if (!answer) return;
    const reason = answer['reason'];
    try {
      await this.api.post(`/bales/${this.id()}/write-off`, { reason });
      this.api.say('The bale is written off.');
      await this.load();
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async savePrices() {
    this.busy.set(true);
    try {
      await this.api.patch(`/bales/${this.id()}`, { salePrice: this.salePrice ? typed(this.salePrice) : '', piecePrice: this.piecePrice ? typed(this.piecePrice) : '' });
      this.api.say('Prices saved.');
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async act(action: string, done: string) {
    try {
      await this.api.post(`/bales/${this.id()}/${action}`);
      this.api.say(done);
      await this.load();
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async finish() {
    const b = this.bale()!;
    if (await this.ask.confirm('Nothing left to sell?', `Bale ${b.code} leaves the shelf. Its ${b.piecesLeft} pieces will no longer be for sale.`, 'Finish the bale', true)) void this.act('finish', 'The bale is finished.');
  }
}
