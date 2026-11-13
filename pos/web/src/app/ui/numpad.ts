import { Component, output } from '@angular/core';

/** What a number box holds after one key of the number pad. */
export function press(value: string, key: string): string {
  if (key === 'clear') return '';
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : `${value || '0'}.`;
  const next = value === '0' ? key : value + key;
  return next.length > 12 ? value : next.replace(/^0+(?=\d)/, '');
}

/** Big number keys for a touch screen. */
@Component({
  selector: 'pos-numpad',
  template: `
    <div class="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
      @for (k of keys; track k) {
        <button type="button" class="num h-[52px] rounded-2xl bg-stone-100 text-xl font-semibold text-stone-900 transition hover:bg-stone-200 active:scale-95 active:bg-stone-300 md:h-16" (click)="key.emit(k)">{{ k }}</button>
      }
      <button type="button" class="h-[52px] rounded-2xl bg-stone-100 text-xl font-semibold transition hover:bg-stone-200 active:scale-95 md:h-16" (click)="key.emit('00')">00</button>
      <button type="button" class="num h-[52px] rounded-2xl bg-stone-100 text-xl font-semibold transition hover:bg-stone-200 active:scale-95 md:h-16" (click)="key.emit('0')">0</button>
      <button type="button" class="flex h-[52px] items-center justify-center rounded-2xl bg-stone-100 transition hover:bg-stone-200 active:scale-95 md:h-16" (click)="key.emit('back')" aria-label="Delete one digit">
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12V5zM17 9l-5 6M12 9l5 6" /></svg>
      </button>
    </div>
  `,
})
export class Numpad {
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  readonly key = output<string>();
}
