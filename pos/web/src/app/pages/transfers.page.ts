import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Bale } from '../core';
import { Shelf } from '../offline/shelf';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface Transfer {
  id: string;
  code: string;
  status: 'SENT' | 'RECEIVED' | 'CANCELLED';
  fromName: string;
  toName: string;
  incoming: boolean;
  note: string | null;
  sentByName: string;
  sentAt: string;
  receivedByName: string | null;
  receivedAt: string | null;
  _count?: { lines: number };
  bales?: Bale[];
}
const TONE = { SENT: 'bg-sky-50 text-sky-800', RECEIVED: 'bg-emerald-50 text-emerald-800', CANCELLED: 'bg-stone-100 text-stone-600' };
const LABEL = { SENT: 'On the way', RECEIVED: 'Received', CANCELLED: 'Cancelled' };

/** Bales moving between branches. Sending starts in Stock (choose bales, Send); receiving happens here. */
@Component({
  imports: [RouterLink, DatePipe, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <div class="flex items-center justify-between gap-3"><h1>Stock between branches</h1><a routerLink="/stock" class="btn-soft">Send bales</a></div>
      <p class="text-sm text-stone-500">{{ api.branch()?.name }}</p>
      <div class="card mt-4 divide-y divide-stone-100">
        @for (t of list(); track t.id) {
          <button class="row" (click)="open(t)">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" [class]="t.incoming ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'"><pos-icon name="truck" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ t.incoming ? 'From ' + t.fromName : 'To ' + t.toName }} · {{ t._count?.lines }} bales</span><span class="num block text-xs text-stone-500">{{ t.code }} · {{ t.sentAt | date: 'd MMM, h:mm a' }}</span></span>
            <span class="tag" [class]="tone[t.status]">{{ t.incoming && t.status === 'SENT' ? 'Waiting for you' : label[t.status] }}</span>
          </button>
        } @empty {
          <p class="px-4 py-10 text-center text-sm text-stone-500">{{ loaded() ? 'No bales have moved between branches yet.' : 'Loading…' }}</p>
        }
      </div>
    </div>
    @if (one(); as t) {
      <pos-sheet [heading]="t.code + ' · ' + t.fromName + ' → ' + t.toName" (closed)="one.set(null)">
        <p class="-mt-1 text-sm text-stone-500">Sent by {{ t.sentByName }}, {{ t.sentAt | date: 'd MMM, h:mm a' }}{{ t.note ? ' · ' + t.note : '' }}{{ t.receivedByName ? ' · received by ' + t.receivedByName : '' }}</p>
        <div class="-mx-5 mt-3 max-h-[46dvh] divide-y divide-stone-100 overflow-y-auto">
          @for (b of t.bales; track b.id) {
            <div class="px-5 py-2.5"><div class="font-semibold">{{ b.item }}</div><div class="num text-xs text-stone-500">{{ b.code }}{{ b.baleNo ? ' · ' + b.baleNo : '' }}{{ b.grade ? ' · Grade ' + b.grade : '' }}</div></div>
          }
        </div>
        @if (t.status === 'SENT') {
          @if (t.incoming) {
            <button class="btn-pay mt-4" [disabled]="busy()" (click)="act(t, 'receive')">All {{ t.bales?.length }} bales arrived: receive</button>
          } @else if (api.isManager()) {
            <button class="btn-danger mt-4 w-full" [disabled]="busy()" (click)="act(t, 'cancel')">Cancel: the bales stayed here</button>
          }
        }
      </pos-sheet>
    }
  `,
})
export class TransfersPage implements OnInit {
  readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  readonly list = signal<Transfer[]>([]);
  readonly one = signal<Transfer | null>(null);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly tone = TONE;
  readonly label = LABEL;

  ngOnInit() {
    void this.load();
  }
  async load() {
    try {
      this.list.set(await this.api.get<Transfer[]>('/transfers'));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }
  async open(t: Transfer) {
    try {
      this.one.set(await this.api.get<Transfer>(`/transfers/${t.id}`));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
  async act(t: Transfer, what: 'receive' | 'cancel') {
    this.busy.set(true);
    try {
      await this.api.post(`/transfers/${t.id}/${what}`);
      this.api.say(what === 'receive' ? 'Received. The bales are on this shelf now.' : 'Cancelled. The bales are back on the shelf.');
      this.one.set(null);
      await this.load();
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
