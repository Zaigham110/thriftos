import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { ChartColumn, LucideAngularModule, Table2 } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface WsSeries {
  label: string;
  values: number[];
}

let uid = 0;

/**
 * Grouped vertical bars on one value axis (never two). The first two series wear the brand (plum, gold), the
 * rest take the categorical slots in fixed order. Soft gradient bars that grow in, a dashed recessive grid on
 * even steps (zero is always a tick, so a small loss never squeezes its label onto zero), a hover column with a
 * dark tooltip card, and "Show as table" for the same numbers (the accessible view).
 */
@Component({
  selector: 'ws-bar-chart',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <figure>
      <figcaption>
        <div class="head">
          <span class="title">{{ heading() }}</span>
          @if (series().length > 1) {
            <ul class="legend">
              @for (s of series(); track s.label; let i = $index) { <li><i [style.background]="color(i)"></i>{{ s.label }}</li> }
            </ul>
          }
        </div>
        <div class="seg" role="group">
          <button type="button" [class.on]="!asTable()" [attr.aria-pressed]="!asTable()" [attr.aria-label]="'ws.chart.showChart' | t" [title]="'ws.chart.showChart' | t" (click)="asTable.set(false)">
            <lucide-icon [img]="icons.ChartColumn" [size]="15" aria-hidden="true" />
          </button>
          <button type="button" [class.on]="asTable()" [attr.aria-pressed]="asTable()" [attr.aria-label]="'ws.chart.showTable' | t" [title]="'ws.chart.showTable' | t" (click)="asTable.set(true)">
            <lucide-icon [img]="icons.Table2" [size]="15" aria-hidden="true" />
          </button>
        </div>
      </figcaption>
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
        <div class="plot" [class.hovering]="hover() !== null" (mouseleave)="hover.set(null)">
          @if (hover(); as h) {
            <span class="band" [style.inset-inline-start.%]="pct(groupX(h.ci))" [style.width.%]="pct(groupW())" [style.height.%]="(y(min()) / H) * 100"></span>
          }
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="heading()">
            <defs>
              @for (s of series(); track s.label; let si = $index) {
                <linearGradient [attr.id]="gid(si)" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" [attr.stop-color]="color(si)" />
                  <stop offset="1" [attr.stop-color]="color(si)" stop-opacity="0.78" />
                </linearGradient>
              }
            </defs>
            @for (t of ticks(); track t.v) {
              <line class="grid" [class.zero]="t.v === 0" [attr.x1]="PAD_L" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="axis" [attr.x]="PAD_L - 10" [attr.y]="t.y + 4" text-anchor="end">{{ short(t.v) }}</text>
            }
            @for (c of categories(); track c; let ci = $index) {
              <g class="col" [class.on]="hover()?.ci === ci">
                @for (s of series(); track s.label; let si = $index) {
                  <path class="bar" [class.neg]="(s.values[ci] || 0) < 0" [attr.d]="barPath(ci, si, s.values[ci])"
                    [attr.data-top]="barY(s.values[ci])" [attr.data-bottom]="barY(s.values[ci]) + barH(s.values[ci])"
                    [attr.fill]="'url(#' + gid(si) + ')'"
                    tabindex="0" [attr.aria-label]="c + ', ' + s.label + ': ' + fmt(s.values[ci])"
                    (focus)="hover.set({ ci, si })" (blur)="hover.set(null)" />
                }
              </g>
              @if (ci % labelEvery() === 0) {
                <text class="axis" [attr.x]="groupX(ci) + groupW() / 2" [attr.y]="H - 6" text-anchor="middle">{{ c }}</text>
              }
            }
          </svg>
          <div class="hits" aria-hidden="true" [style.inset-inline-start.%]="pct(PAD_L)">
            @for (c of categories(); track c; let ci = $index) { <span (mouseenter)="hover.set({ ci, si: null })"></span> }
          </div>
          @if (hover(); as h) {
            <div class="tip" role="status" [style.inset-inline-start.%]="tipX(h.ci)">
              <strong>{{ categories()[h.ci] }}</strong>
              @for (s of series(); track s.label; let si = $index) {
                <span [class.on]="h.si === null || si === h.si"><i [style.background]="color(si)"></i>{{ s.label }} <b class="ws-num">{{ fmt(s.values[h.ci]) }}</b></span>
              }
            </div>
          }
        </div>
      }
    </figure>
  `,
  styles: [`
    figure { margin:0; padding:var(--ws-5, 20px) var(--ws-5, 20px) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-1); }
    figcaption { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--ws-3); margin-block-end:var(--ws-4); }
    .head { display:grid; gap:var(--ws-2); min-width:0; }
    .title { color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; letter-spacing:-0.01em; }
    .legend { display:flex; flex-wrap:wrap; gap:var(--ws-2); margin:0; padding:0; list-style:none; }
    .legend li { display:inline-flex; align-items:center; gap:6px; padding:3px 10px 3px 8px; border:1px solid var(--ws-line); border-radius:999px; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:500; }
    .legend i, .tip i { width:8px; height:8px; border-radius:50%; flex:none; }
    .seg { display:inline-flex; flex:none; padding:2px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    .seg button { display:grid; place-items:center; width:30px; height:26px; border:0; border-radius:calc(var(--ws-r-md) - 2px); background:transparent; color:var(--ws-ink-3); cursor:pointer; }
    .seg button:hover { color:var(--ws-ink); }
    .seg button.on { background:var(--ws-surface); color:var(--ws-brand); box-shadow:var(--ws-shadow-1); }
    .seg button:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    /* Charts read left to right in both languages (time and categories), like the numbers. */
    .plot { position:relative; direction:ltr; }
    svg { position:relative; display:block; width:100%; height:auto; overflow:visible; }
    .grid { stroke:var(--ws-grid); stroke-width:1; stroke-dasharray:3 5; }
    .grid.zero { stroke:var(--ws-line-strong); stroke-dasharray:none; }
    .axis { fill:var(--ws-ink-3); font-size:11px; font-family:var(--ws-font); font-variant-numeric:tabular-nums; }
    .bar { cursor:pointer; outline:none; transform-box:fill-box; transform-origin:50% 100%; animation:grow .6s cubic-bezier(.2,.8,.2,1) both; transition:opacity .15s ease; }
    .bar.neg { transform-origin:50% 0; }
    .bar:focus-visible { stroke:var(--ws-ink); stroke-width:2; }
    .hovering .col:not(.on) .bar { opacity:.32; }
    @keyframes grow { from { transform:scaleY(0); } }
    @media (prefers-reduced-motion: reduce) { .bar { animation:none; } }
    .band { position:absolute; inset-block-start:0; border-radius:var(--ws-r-md); background:var(--ws-surface-2); pointer-events:none; }
    .hits { position:absolute; inset-block:0; inset-inline-end:0; display:flex; }
    .hits span { flex:1; cursor:pointer; }
    .tip { position:absolute; inset-block-start:-6px; z-index:2; transform:translate(-50%, -100%); display:grid; gap:4px; min-width:170px; padding:var(--ws-2) var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-ink); box-shadow:var(--ws-shadow-pop); color:color-mix(in srgb, var(--ws-surface) 70%, transparent); font-size:var(--ws-text-xs); pointer-events:none; }
    .tip::after { content:''; position:absolute; inset-block-end:-5px; inset-inline-start:calc(50% - 5px); width:10px; height:10px; background:var(--ws-ink); transform:rotate(45deg); border-radius:2px; }
    .tip strong { color:var(--ws-surface); font-size:var(--ws-text-sm); }
    .tip span { display:flex; align-items:center; gap:var(--ws-2); }
    .tip span.on { color:var(--ws-surface); }
    .tip b { margin-inline-start:auto; padding-inline-start:var(--ws-4); color:inherit; font-weight:600; }
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

  protected readonly icons = { ChartColumn, Table2 };
  /** Drawn at the card's real width (not scaled), so labels stay 11 px and grid lines stay hairlines. */
  private readonly w = signal(640);
  protected get W(): number {
    return this.w();
  }
  /** Height follows the width (about 1 : 3), between 200 and 320 px. */
  protected get H(): number {
    return Math.round(Math.min(320, Math.max(200, this.w() * 0.3)));
  }
  protected readonly PAD_L = 52;
  protected readonly PAD_B = 26;
  private readonly id = `wsbc${++uid}`;
  protected readonly asTable = signal(false);
  /** si null = the whole column is hovered (all series highlighted). */
  protected readonly hover = signal<{ ci: number; si: number | null } | null>(null);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => {
        const fig = host.querySelector('figure');
        if (!fig) return;
        const cs = getComputedStyle(fig);
        const inner = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (inner > 0) this.w.set(Math.max(260, Math.round(inner)));
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(measure);
      ro.observe(host);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  private readonly values = computed(() => this.series().flatMap((s) => s.values).filter((v) => Number.isFinite(v)));
  /** Even axis step (1, 2, 2.5 or 5 × 10ⁿ) over about four intervals. */
  private readonly step = computed(() => {
    const hi = Math.max(0, ...this.values());
    const lo = Math.min(0, ...this.values());
    return hi - lo > 0 ? niceMax((hi - lo) / 4) : 0.25;
  });
  /** Top of the scale: a whole number of steps (1 for an empty chart so it still has an axis). */
  private readonly max = computed(() => {
    const vs = this.values();
    if (!vs.some((v) => v > 0) && vs.some((v) => v < 0)) return 0; // only losses: the zero line is the top
    return Math.max(1, Math.ceil(Math.max(0, ...vs) / this.step())) * this.step();
  });
  /** Bottom of the scale: 0, or whole steps below 0 when a value is a loss, so bars hang down from the zero line. */
  protected readonly min = computed(() => {
    const lo = Math.min(0, ...this.values());
    return lo < 0 ? -Math.min(Math.ceil(-lo / this.step()) * this.step(), niceMax(-lo)) : 0;
  });
  /** Ticks on whole steps from zero; the bottom of a loss gets its own label only when it has room (≥ 18 px). */
  protected readonly ticks = computed(() => {
    const s = this.step();
    const out: { v: number; y: number }[] = [];
    for (let k = Math.ceil(this.min() / s - 1e-9); k * s <= this.max() + s * 1e-9; k++) out.push({ v: k * s || 0, y: this.y(k * s) });
    const lo = this.min();
    if (lo < 0 && !out.some((t) => t.v === lo) && this.y(lo) - out[0].y >= 18) out.unshift({ v: lo, y: this.y(lo) });
    return out;
  });
  protected readonly groupW = computed(() => (this.W - this.PAD_L) / Math.max(1, this.categories().length));
  protected readonly barW = computed(() => Math.max(4, Math.min(28, (this.groupW() * 0.62) / Math.max(1, this.series().length) - 3)));
  protected readonly radius = computed(() => Math.min(6, this.barW() / 2));
  /** A bar rounded only at its value end (top for a sale, bottom for a loss), square on the zero line. */
  protected barPath(ci: number, si: number, v: number): string {
    const h = this.barH(v);
    if (h <= 0) return '';
    const x = this.barX(ci, si), w = this.barW(), y = this.barY(v), r = Math.min(this.radius(), h);
    return (v || 0) >= 0
      ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
      : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
  }
  /** Show every nth x label so labels never collide (about 56 px each). */
  protected readonly labelEvery = computed(() => Math.max(1, Math.ceil(56 / this.groupW())));

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
    const gap = 3;
    const total = n * this.barW() + (n - 1) * gap;
    return this.groupX(ci) + (this.groupW() - total) / 2 + si * (this.barW() + gap);
  }
  protected pct(x: number): number {
    return (x / this.W) * 100;
  }
  /** Tooltip centred on the column, kept inside the card at the edges. */
  protected tipX(ci: number): number {
    return Math.min(84, Math.max(16, this.pct(this.groupX(ci) + this.groupW() / 2)));
  }
  protected gid(si: number): string {
    return `${this.id}-${si}`;
  }
  /** Brand plum and gold first, then the categorical slots in fixed order; a 9th series is not allowed. */
  protected color(i: number): string {
    return i < 2 ? `var(--ws-chart-${i + 1})` : `var(--ws-series-${Math.min(i, 7) + 1})`;
  }
  protected fmt(v: number | undefined): string {
    return this.format() === 'money' ? this.i18n.money(v) : this.format() === 'kg' ? this.i18n.kg(v) : this.i18n.num(v);
  }
  protected short(v: number): string {
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    return a >= 1e6 ? `${sign}${this.i18n.num(a / 1e6, 1)}M` : a >= 1e3 ? `${sign}${this.i18n.num(a / 1e3, a % 1000 ? 1 : 0)}k` : `${sign}${this.i18n.num(a)}`;
  }
}

/** Rounds an axis value up to 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
