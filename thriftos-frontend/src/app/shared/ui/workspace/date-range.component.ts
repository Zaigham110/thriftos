import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TPipe } from '../../../core/i18n/t.pipe';

export type WsRangePreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | '90d' | 'year' | 'custom';

export interface WsDateRange {
  preset: WsRangePreset;
  /** Inclusive, YYYY-MM-DD (the business's local day). */
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The dates a preset means on a given day. */
export function rangeFor(preset: Exclude<WsRangePreset, 'custom'>, today = new Date()): WsDateRange {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const back = (days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - days);
  switch (preset) {
    case 'today': return { preset, from: ymd(d), to: ymd(d) };
    case '7d': return { preset, from: ymd(back(6)), to: ymd(d) };
    case '30d': return { preset, from: ymd(back(29)), to: ymd(d) };
    case '90d': return { preset, from: ymd(back(89)), to: ymd(d) };
    case 'month': return { preset, from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) };
    case 'lastMonth': return { preset, from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)) };
    case 'year': return { preset, from: ymd(new Date(d.getFullYear(), 0, 1)), to: ymd(d) };
  }
}

/** Period picker for dashboards and lists: quick presets, or two dates. */
@Component({
  selector: 'ws-date-range',
  standalone: true,
  imports: [FormsModule, TPipe],
  template: `
    <div class="range" role="group" [attr.aria-label]="'ws.range.label' | t">
      <select [ngModel]="value().preset" (ngModelChange)="pick($event)" [attr.aria-label]="'ws.range.label' | t">
        @for (p of presets; track p) { <option [value]="p">{{ 'ws.range.' + p | t }}</option> }
      </select>
      @if (value().preset === 'custom') {
        <input type="date" [ngModel]="value().from" (ngModelChange)="value.set({ preset: 'custom', from: $event, to: value().to })" [max]="value().to" [attr.aria-label]="'ws.range.from' | t" />
        <span aria-hidden="true">–</span>
        <input type="date" [ngModel]="value().to" (ngModelChange)="value.set({ preset: 'custom', from: value().from, to: $event })" [min]="value().from" [attr.aria-label]="'ws.range.to' | t" />
      } @else {
        <span class="dates ws-num">{{ label() }}</span>
      }
    </div>
  `,
  styles: [`
    .range { display:inline-flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    select, input { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    select:focus, input:focus { outline:none; border-color:var(--ws-brand); box-shadow:var(--ws-focus); }
    .dates { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
  `],
})
export class WsDateRangeComponent {
  readonly value = model<WsDateRange>(rangeFor('30d'));
  readonly today = input<Date>(new Date());
  protected readonly presets: WsRangePreset[] = ['today', '7d', '30d', 'month', 'lastMonth', '90d', 'year', 'custom'];
  protected readonly label = computed(() => {
    const v = this.value();
    const f = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return v.from === v.to ? f(v.from) : `${f(v.from)} – ${f(v.to)}`;
  });

  protected pick(p: WsRangePreset): void {
    this.value.set(p === 'custom' ? { ...this.value(), preset: 'custom' } : rangeFor(p, this.today()));
  }
}
