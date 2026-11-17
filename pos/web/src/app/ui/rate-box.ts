import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, model, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core';

interface Currency {
  code: string;
  name: string;
  sign: string;
}
let known: Currency[] | null = null;

/**
 * Which currency a supplier's list (or stock typed by hand) is in, and the rate into the shop's own currency:
 * today's rate fetched with one tap (or by itself, when the shop chose that), or typed by hand.
 */
@Component({
  selector: 'pos-rate-box',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="min-w-0">
        <label class="label" for="rb-cur">Costs are in</label>
        <select id="rb-cur" class="input" [ngModel]="currency()" (ngModelChange)="pick($event)">
          @for (c of list(); track c.code) { <option [value]="c.code">{{ c.code }} · {{ c.name }}{{ c.code === local ? ' (your shop)' : '' }}</option> }
        </select>
        @if (detected() && detected() === currency() && detected() !== local) { <p class="hint">The list says {{ detected() }}.</p> }
        @else if (detected() && detected() !== currency()) { <p class="hint">The list says {{ detected() }}. <button type="button" class="font-semibold text-brand-700 underline" (click)="pick(detected()!)">Use {{ detected() }}</button></p> }
      </div>
      @if (currency() !== local) {
        <div class="min-w-0">
          <label class="label" for="rb-rate">1 {{ currency() }} in {{ local }}</label>
          <div class="flex gap-2">
            <input id="rb-rate" class="input num min-w-0 flex-1" inputmode="decimal" [ngModel]="rate()" (ngModelChange)="typedRate($event)" placeholder="Type the rate" />
            <button type="button" class="btn-soft min-h-[48px] shrink-0 px-3 text-sm" [disabled]="busy()" (click)="fetch(true)">{{ busy() ? 'Fetching…' : "Today's rate" }}</button>
          </div>
          <p class="hint">
            @if (problem()) { <span class="font-medium text-red-700">{{ problem() }}</span> }
            @else if (live(); as l) { Today's rate, updated {{ l | date: 'd MMM, h:mm a' }}. Change it if you paid another rate. }
            @else if (rate()) { Typed by you. }
            @else { Type the rate you paid, or take today's. }
          </p>
        </div>
      }
    </div>
  `,
})
export class RateBox implements OnInit {
  private readonly api = inject(Api);
  readonly currency = model.required<string>();
  readonly rate = model.required<string>();
  /** The currency the file itself names, if any. */
  readonly detected = input<string | null>(null);
  readonly list = signal<Currency[]>(known ?? []);
  readonly busy = signal(false);
  readonly problem = signal('');
  /** When the rate in the box is today's fetched rate: the time it was updated. */
  readonly live = signal<string | null>(null);
  readonly local = this.api.shop()?.currency ?? 'PKR';

  constructor() {
    // A list that names its currency: take it, unless the owner already chose another one by hand.
    effect(() => {
      const d = this.detected();
      if (d && !this.chosen && d !== untracked(this.currency)) untracked(() => this.pick(d, false));
    });
  }
  private chosen = false;

  async ngOnInit() {
    if (!known) {
      try {
        known = await this.api.get<Currency[]>('/rates/currencies');
      } catch {
        known = null;
      }
      this.list.set(known ?? [{ code: this.local, name: 'Your shop', sign: '' }]);
    }
    if (this.currency() !== this.local && !this.rate() && this.api.shop()?.rateMode !== 'MANUAL') void this.fetch(false);
  }

  pick(code: string, byHand = true) {
    if (byHand) this.chosen = true;
    this.currency.set(code);
    this.rate.set('');
    this.live.set(null);
    this.problem.set('');
    if (code !== this.local && this.api.shop()?.rateMode !== 'MANUAL') void this.fetch(false);
  }

  typedRate(value: string) {
    this.rate.set(value);
    this.live.set(null);
    this.problem.set('');
  }

  /** `asked`: the person tapped the button, so a failure is said; a quiet try just leaves the box to be typed in. */
  async fetch(asked: boolean) {
    this.busy.set(true);
    this.problem.set('');
    try {
      const got = await this.api.get<{ rate: string; at: string }>('/rates', { from: this.currency(), to: this.local });
      this.rate.set(got.rate);
      this.live.set(got.at);
    } catch (e) {
      if (asked || !this.rate()) this.problem.set(this.api.why(e));
    } finally {
      this.busy.set(false);
    }
  }
}
