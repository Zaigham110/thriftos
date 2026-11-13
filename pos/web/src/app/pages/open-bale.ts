import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Bale, typed } from '../core';

/** Cutting a bale open: count the pieces and say what one piece sells for. Used in Stock and at the counter. */
@Component({
  selector: 'pos-open-bale',
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4" (click)="closed.emit()">
      <form class="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl" (click)="$event.stopPropagation()" (ngSubmit)="open()" role="dialog" aria-modal="true" aria-labelledby="open-title">
        <h2 id="open-title" class="text-lg font-semibold">Open bale {{ bale().code }}</h2>
        <p class="mt-0.5 text-sm text-stone-600">{{ bale().item }}. After opening it is sold piece by piece, not as a whole bale.</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="open-pieces">Pieces inside</label>
            <input id="open-pieces" class="input num" name="pieces" inputmode="numeric" [(ngModel)]="pieces" autofocus />
          </div>
          <div>
            <label class="label" for="open-price">Price of one piece</label>
            <input id="open-price" class="input num" name="price" inputmode="decimal" [(ngModel)]="price" placeholder="Rs" />
          </div>
        </div>
        @if (error()) {
          <p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{{ error() }}</p>
        }
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn-soft flex-1" (click)="closed.emit()">Not now</button>
          <button class="btn-primary flex-1" [disabled]="busy()">{{ busy() ? 'Opening…' : 'Open bale' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class OpenBale implements OnInit {
  private readonly api = inject(Api);
  readonly bale = input.required<Bale>();
  readonly opened = output<Bale>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  pieces = '';
  price = '';

  ngOnInit() {
    this.pieces = this.bale().pieces ? String(this.bale().pieces) : '';
    this.price = this.bale().piecePrice ?? '';
  }

  async open() {
    const pieces = Math.floor(typed(this.pieces));
    if (pieces < 1) return this.error.set('Count the pieces and type the number.');
    this.busy.set(true);
    this.error.set('');
    try {
      const bale = await this.api.post<Bale>(`/bales/${this.bale().id}/open`, { pieces, piecePrice: this.price ? typed(this.price) : '' });
      this.opened.emit(bale);
    } catch (e) {
      this.error.set(this.api.why(e));
    } finally {
      this.busy.set(false);
    }
  }
}
