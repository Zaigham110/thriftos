import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, MoneyPipe } from '../core';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface SupplierReturn {
  id: string;
  code: string;
  amount: string;
  reason: string | null;
  settledAt: string | null;
  settledNote: string | null;
  userName: string;
  createdAt: string;
  supplier: { id: string; name: string };
  _count?: { lines: number };
  lines?: { id: string; amount: string; bale: { id: string; code: string; kindCode: string | null; baleNo: string | null; item: string } | null }[];
}

/** Bales sent back to suppliers, and what each supplier still owes for them. Sending starts in Stock (choose bales). */
@Component({
  imports: [RouterLink, DatePipe, MoneyPipe, Icon, Sheet],
  template: `
    <div class="screen max-w-3xl">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <h1>Back to supplier</h1>
      <p class="text-sm text-stone-500">To send bales back: Stock → Choose bales → Back to supplier.</p>

      @if (owed().length) {
        <h2 class="mb-2 mt-5">Suppliers owe you</h2>
        <div class="card divide-y divide-stone-100">
          @for (o of owed(); track o.supplierId) {
            <div class="flex items-center justify-between gap-3 px-4 py-3"><span class="min-w-0"><span class="block truncate font-semibold">{{ o.name }}</span><span class="block text-xs text-stone-500">{{ o.returns }} {{ o.returns === 1 ? 'return' : 'returns' }} not settled</span></span><span class="num text-lg font-bold">{{ o.amount | money }}</span></div>
          }
        </div>
      }

      <h2 class="mb-2 mt-5">Returns</h2>
      <div class="card divide-y divide-stone-100">
        @for (r of returns(); track r.id) {
          <button class="row w-full text-left" (click)="open(r)">
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ r.supplier.name }} · {{ r._count?.lines }} {{ r._count?.lines === 1 ? 'bale' : 'bales' }}</span><span class="num block truncate text-xs text-stone-500">{{ r.code }} · {{ r.createdAt | date: 'd MMM y' }}{{ r.reason ? ' · ' + r.reason : '' }}</span></span>
            <span class="shrink-0 text-right"><span class="num block font-bold">{{ r.amount | money }}</span><span class="tag" [class]="r.settledAt ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'">{{ r.settledAt ? 'Settled' : 'Owed' }}</span></span>
          </button>
        } @empty {
          <p class="px-4 py-10 text-center text-sm text-stone-500">{{ loaded() ? 'Nothing has been sent back to a supplier.' : 'Loading…' }}</p>
        }
      </div>
    </div>

    @if (one(); as r) {
      <pos-sheet [heading]="r.code + ' · ' + r.supplier.name" (closed)="one.set(null)">
        <p class="-mt-1 text-sm text-stone-500">{{ r.createdAt | date: 'd MMM y, h:mm a' }} · {{ r.userName }}{{ r.reason ? ' · ' + r.reason : '' }}</p>
        <div class="-mx-5 mt-3 max-h-[40vh] divide-y divide-stone-100 overflow-y-auto border-y border-stone-100">
          @for (l of r.lines ?? []; track l.id) {
            <div class="flex items-center justify-between gap-3 px-5 py-2.5"><span class="min-w-0"><span class="block truncate font-semibold">{{ l.bale?.item }}</span><span class="num block truncate text-xs text-stone-500">{{ l.bale?.kindCode ? l.bale?.kindCode + ' · ' : '' }}{{ l.bale?.code }}{{ l.bale?.baleNo ? ' · ' + l.bale?.baleNo : '' }}</span></span><span class="num text-sm font-semibold">{{ l.amount | money }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3"><span class="font-semibold">{{ r.settledAt ? 'Settled' : 'The supplier owes' }}</span><span class="num text-2xl font-extrabold">{{ r.amount | money }}</span></div>
        @if (r.settledAt) {
          <p class="mt-2 text-sm text-stone-600">Settled on {{ r.settledAt | date: 'd MMM y' }}{{ r.settledNote ? ': ' + r.settledNote : '' }}</p>
        } @else {
          <button class="btn-big mt-3" [disabled]="busy()" (click)="settle(r)">The supplier has settled this</button>
          <button class="btn-quiet mt-2 w-full" [disabled]="busy()" (click)="undo(r)">Made by mistake: put the bales back on the shelf</button>
        }
      </pos-sheet>
    }
  `,
})
export class SupplierReturnsPage implements OnInit {
  private readonly api = inject(Api);
  private readonly ask = inject(Ask);
  private readonly shelf = inject(Shelf);
  readonly owed = signal<{ supplierId: string; name: string; amount: string; returns: number }[]>([]);
  readonly returns = signal<SupplierReturn[]>([]);
  readonly loaded = signal(false);
  readonly one = signal<SupplierReturn | null>(null);
  readonly busy = signal(false);

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      const res = await this.api.get<{ owed: { supplierId: string; name: string; amount: string; returns: number }[]; returns: SupplierReturn[] }>('/supplier-returns');
      this.owed.set(res.owed);
      this.returns.set(res.returns);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }

  async open(r: SupplierReturn) {
    try {
      this.one.set(await this.api.get<SupplierReturn>(`/supplier-returns/${r.id}`));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async settle(r: SupplierReturn) {
    const answer = await this.ask.fields('How was it settled?', `${r.supplier.name} no longer owes this amount.`, [{ key: 'note', label: 'Note', placeholder: 'Money back, taken off invoice 123…', optional: true }], 'Settled');
    if (!answer) return;
    await this.run(() => this.api.post(`/supplier-returns/${r.id}/settle`, { note: answer['note'] }), 'Settled.');
  }

  async undo(r: SupplierReturn) {
    if (!(await this.ask.confirm('Put the bales back on the shelf?', `${r.code} will be removed and its bales are for sale again.`, 'Put them back', true))) return;
    await this.run(() => this.api.post(`/supplier-returns/${r.id}/undo`, {}), 'The bales are back on the shelf.');
    void this.shelf.refresh();
  }

  private async run(work: () => Promise<unknown>, done: string) {
    this.busy.set(true);
    try {
      await work();
      this.one.set(null);
      this.api.say(done);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
