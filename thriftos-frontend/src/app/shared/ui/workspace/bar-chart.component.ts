import { Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface WsSeries {
  label: string;
  values: number[];
}

/**
 * Grouped vertical bars on one value axis (never two), categorical colours in fixed slot order, 2 px gaps,
 * rounded data ends, recessive grid. Legend for 2+ series; hover/focus shows a tooltip; "Show as table"
 * gives the same numbers as a table (the accessible view, and the relief for light colours below 3:1).
 */
@Component({
  selector: 'ws-bar-chart',
  standalone: true,
  imports: [TPipe],
  template: `
    <figure>
      <figcaption>
        <span class="title">{{ heading() }}</span>
        <button type="button" class="toggle" (click)="asTable.set(!asTable())">{{ (asTable() ? 'ws.chart.showChart' : 'ws.chart.showTable') | t }}</button>
      </figcaption>
      @if (series().length > 1) {
        <ul class="legend">
          @for (s of series(); track s.label; let i = $index) { <li><i [style.background]="color(i)"></i>{{ s.label }}</li> }
        </ul>
      }
      @if (asTable()) {
        <table>
          <thead><tr><th scope="col"></th>@for (s of series(); track s.label) { <th scope="col" class="end">{{ s.label }}</th> }</tr></thead>
          <tbody>
            @for (c of categories(); track c; let ci = $index) {
              <tr><th scope="row">{{ c }}</th>@for (s of series(); track s.label) { <td class="end ws-num">{{ fmt(s.values[ci]) }}</td> }</tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="plot" (mouseleave)="hover.set(null)">
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="heading()">
            @for (t of ticks(); track t.v) {
              <line class="grid" [class.zero]="t.v === 0 && min() < 0" [attr.x1]="PAD_L" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="axis" [attr.x]="PAD_L - 6" [attr.y]="t.y + 4" text-anchor="end">{{ short(t.v) }}</text>
            }
            @for (c of categories(); track c; let ci = $index) {
              @for (s of series(); track s.label; let si = $index) {
                <rect [attr.x]="barX(ci, si)" [attr.y]="barY(s.values[ci])" [attr.width]="barW()" [attr.height]="barH(s.values[ci])" [attr.fill]="color(si)" rx="4"
                  tabindex="0" [attr.aria-label]="c + ', ' + s.label + ': ' + fmt(s.values[ci])"
                  (mouseenter)="hover.set({ ci, si })" (focus)="hover.set({ ci, si })" (blur)="hover.set(null)" />
              }
              <text class="axis" [attr.x]="groupX(ci) + groupW() / 2" [attr.y]="H - 8" text-anchor="middle">{{ c }}</text>
            }
          </svg>
          @if (hover(); as h) {
            <div class="tip" role="status" [style.inset-inline-start.%]="((groupX(h.ci) + groupW() / 2) / W) * 100">
              <strong>{{ categories()[h.ci] }}</strong>
              @for (s of series(); track s.label; let si = $index) {
                <span [class.on]="si === h.si"><i [style.background]="color(si)"></i>{{ s.label }} <b class="ws-num">{{ fmt(s.values[h.ci]) }}</b></span>
              }
            </div>
          }
        </div>
      }
    </figure>
  `,
  styles: [`
    figure { margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    figcaption { display:flex; align-items:center; justify-content:space-between; gap:var(--ws-3); margin-block-end:var(--ws-2); }
    .title { color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; }
    .toggle { border:0; background:transparent; color:var(--ws-brand); font:inherit; font-size:var(--ws-text-sm); font-weight:600; cursor:pointer; }
    .legend { display:flex; flex-wrap:wrap; gap:var(--ws-4); margin:0 0 var(--ws-2); padding:0; list-style:none; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .legend li, .tip span { display:inline-flex; align-items:center; gap:var(--ws-2); }
    i { width:10px; height:10px; border-radius:3px; }
    /* Charts read left to right in both languages (time and categories), like the numbers. */
    .plot { position:relative; direction:ltr; }
    svg { display:block; width:100%; height:auto; }
    .grid { stroke:var(--ws-grid); stroke-width:1; }
    .grid.zero { stroke:var(--ws-line-strong, var(--ws-ink-3)); }
    .axis { fill:var(--ws-ink-3); font-size:11px; font-family:var(--ws-font); }
    rect { stroke:var(--ws-surface); stroke-width:2; cursor:pointer; outline:none; }
    rect:focus-visible { stroke:var(--ws-ink); }
    .tip { position:absolute; inset-block-start:0; transform:translateX(-50%); display:grid; gap:2px; min-width:150px; padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); color:var(--ws-ink-2); font-size:var(--ws-text-xs); pointer-events:none; }
    .tip strong { color:var(--ws-ink); }
    .tip span.on { color:var(--ws-ink); }
    .tip b { margin-inline-start:auto; color:var(--ws-ink); }
    table { width:100%; border-collapse:collapse; font-size:var(--ws-text-sm); }
    th, td { padding:var(--ws-2); border-block-end:1px solid var(--ws-line); text-align:start; color:var(--ws-ink); }
    thead th { color:var(--ws-ink-2); font-weight:600; }
    .end { text-align:end; }
  `],
})
export class WsBarChartComponent {
  private readonly i18n = inject(I18nService);
  readonly heading = input.required<string>();
  readonly categories = input.required<string[]>();
  readonly series = input.required<WsSeries[]>();
  readonly format = input<'number' | 'money' | 'kg'>('number');

  protected readonly W = 640;
  protected readonly H = 240;
  protected readonly PAD_L = 48;
  protected readonly PAD_B = 28;
  protected readonly asTable = signal(false);
  protected readonly hover = signal<{ ci: number; si: number } | null>(null);

  private readonly values = computed(() => this.series().flatMap((s) => s.values).filter((v) => Number.isFinite(v)));
  /** Top of the scale (at least 1 so an empty chart still has an axis). */
  private readonly max = computed(() => {
    const top = Math.max(0, ...this.values());
    return top > 0 || this.min() === 0 ? niceMax(top) : 0;
  });
  /** Bottom of the scale: 0, or below 0 when a value is negative (a loss), so bars hang down from the zero line. */
  protected readonly min = computed(() => {
    const low = Math.min(0, ...this.values());
    return low < 0 ? -niceMax(-low) : 0;
  });
  protected readonly ticks = computed(() => {
    const [lo, hi] = [this.min(), this.max()];
    const vs = lo < 0 ? [lo, lo / 2, 0, hi / 2, hi] : [0, 0.25, 0.5, 0.75, 1].map((f) => hi * f);
    return [...new Set(vs)].map((v) => ({ v, y: this.y(v) }));
  });
  protected readonly groupW = computed(() => (this.W - this.PAD_L) / Math.max(1, this.categories().length));
  protected readonly barW = computed(() => Math.max(4, Math.min(32, (this.groupW() * 0.7) / Math.max(1, this.series().length) - 2)));

  /** Value → y on the plot (top padding 8, bottom axis at H − PAD_B). */
  protected y(v: number): number {
    const lo = this.min();
    const span = this.max() - lo || 1;
    return this.H - this.PAD_B - (((v || 0) - lo) / span) * (this.H - this.PAD_B - 8);
  }
  /** A bar goes from the zero line to its value: up for positive, down for negative; never a negative height. */
  protected barY(v: number): number {
    return Math.min(this.y(v), this.y(0));
  }
  protected barH(v: number): number {
    return Math.abs(this.y(0) - this.y(v));
  }
  protected groupX(ci: number): number {
    return this.PAD_L + ci * this.groupW();
  }
  protected barX(ci: number, si: number): number {
    const n = this.series().length;
    const total = n * this.barW() + (n - 1) * 2;
    return this.groupX(ci) + (this.groupW() - total) / 2 + si * (this.barW() + 2);
  }
  /** Fixed slot order; a 9th series is not allowed (fold into "Other"). */
  protected color(i: number): string {
    return `var(--ws-series-${Math.min(i, 7) + 1})`;
  }
  protected fmt(v: number | undefined): string {
    return this.format() === 'money' ? this.i18n.money(v) : this.format() === 'kg' ? this.i18n.kg(v) : this.i18n.num(v);
  }
  protected short(v: number): string {
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    return a >= 1e6 ? `${sign}${this.i18n.num(a / 1e6, 1)}M` : a >= 1e3 ? `${sign}${this.i18n.num(a / 1e3, 0)}k` : `${sign}${this.i18n.num(a)}`;
  }
}

/** Rounds an axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
