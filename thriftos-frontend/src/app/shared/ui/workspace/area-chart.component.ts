import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { ChartColumn, LucideAngularModule, Table2 } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WsSeries, niceMax } from './bar-chart.component';

let uid = 0;

/**
 * A trend over time: smooth curves (monotone, so a curve never overshoots below zero between two days) with a
 * soft fill under each, the period total of each series in its legend pill, a dashed recessive grid on even
 * steps, and on hover a guide line with a dot per series and a dark tooltip card. "Show as table" gives the same
 * numbers (the accessible view). The first series wears the brand plum, the second gold.
 */
@Component({
  selector: 'ws-area-chart',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <figure>
      <figcaption>
        <div class="head">
          <span class="title">{{ heading() }}</span>
          <ul class="legend">
            @for (s of series(); track s.label; let i = $index) {
              <li><i [style.background]="color(i)"></i><span>{{ s.label }}</span><b class="ws-num">{{ fmt(total(s), true) }}</b></li>
            }
          </ul>
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
        <div class="plot" (mouseleave)="hover.set(null)">
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="heading()">
            <defs>
              @for (s of series(); track s.label; let si = $index) {
                <linearGradient [attr.id]="gid(si)" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" [attr.stop-color]="color(si)" [attr.stop-opacity]="si === 0 ? 0.26 : 0.18" />
                  <stop offset="1" [attr.stop-color]="color(si)" stop-opacity="0" />
                </linearGradient>
              }
            </defs>
            @for (t of ticks(); track t.v) {
              <line class="grid" [class.zero]="t.v === 0" [attr.x1]="PAD_L" [attr.x2]="W - PAD_R" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="axis" [attr.x]="PAD_L - 12" [attr.y]="t.y + 4" text-anchor="end">{{ short(t.v) }}</text>
            }
            @for (c of categories(); track c; let ci = $index) {
              @if (showLabel(ci)) {
                <text class="axis" [attr.x]="x(ci)" [attr.y]="H - 6" [attr.text-anchor]="anchor(ci)">{{ c }}</text>
              }
            }
            @for (s of series(); track s.label; let si = $index) {
              <path class="area" [attr.d]="areaPath(s.values)" [attr.fill]="'url(#' + gid(si) + ')'" />
            }
            @for (s of series(); track s.label; let si = $index) {
              <path class="line" [class.second]="si > 0" [attr.d]="linePath(s.values)" [attr.stroke]="color(si)" pathLength="1" />
            }
            @if (hover(); as ci) {
              <line class="guide" [attr.x1]="x(ci)" [attr.x2]="x(ci)" y1="8" [attr.y2]="y(min())" />
              @for (s of series(); track s.label; let si = $index) {
                <circle class="dot" [attr.cx]="x(ci)" [attr.cy]="y(s.values[ci])" r="4" [attr.stroke]="color(si)" />
              }
            } @else if (categories().length) {
              <circle class="end-dot" [attr.cx]="x(categories().length - 1)" [attr.cy]="y(series()[0]?.values?.[categories().length - 1] ?? 0)" r="3.5" [attr.fill]="color(0)" />
            }
          </svg>
          <div class="hits">
            @for (c of categories(); track c; let ci = $index) {
              <span tabindex="0" [style.inset-inline-start.%]="pct(hitL(ci))" [style.width.%]="pct(hitR(ci) - hitL(ci))" [attr.aria-label]="label(ci)" (mouseenter)="hover.set(ci)" (focus)="hover.set(ci)" (blur)="hover.set(null)"></span>
            }
          </div>
          @if (hover(); as ci) {
            <div class="tip" role="status" [style.inset-inline-start.%]="tipX(ci)" [style.top.%]="(tipY(ci) / H) * 100">
              <strong>{{ categories()[ci] }}</strong>
              @for (s of series(); track s.label; let si = $index) {
                <span><i [style.background]="color(si)"></i>{{ s.label }} <b class="ws-num">{{ fmt(s.values[ci], true) }}</b></span>
              }
            </div>
          }
        </div>
      }
    </figure>
  `,
  styles: [`
    figure { margin:0; padding:20px 20px var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-1); }
    figcaption { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--ws-3); margin-block-end:var(--ws-4); }
    .head { display:grid; gap:var(--ws-3); min-width:0; }
    .title { color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; }
    .legend { display:flex; flex-wrap:wrap; gap:var(--ws-4) var(--ws-6, 28px); margin:0; padding:0; list-style:none; }
    .legend li { display:grid; grid-template-columns:auto 1fr; align-items:center; column-gap:8px; row-gap:2px; }
    .legend li span { color:var(--ws-ink-3); font-size:var(--ws-text-xs); font-weight:500; }
    .legend li b { grid-column:2; color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; font-variant-numeric:tabular-nums; }
    .legend i, .tip i { width:7px; height:7px; border-radius:50%; flex:none; }
    .seg { display:inline-flex; flex:none; padding:2px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    .seg button { display:grid; place-items:center; width:30px; height:26px; border:0; border-radius:calc(var(--ws-r-md) - 2px); background:transparent; color:var(--ws-ink-3); cursor:pointer; }
    .seg button:hover { color:var(--ws-ink); }
    .seg button.on { background:var(--ws-surface); color:var(--ws-brand); box-shadow:var(--ws-shadow-1); }
    .seg button:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    /* Charts read left to right in both languages (time), like the numbers. */
    .plot { position:relative; direction:ltr; }
    svg { display:block; width:100%; height:auto; overflow:visible; }
    .grid { stroke:var(--ws-grid); stroke-width:1; stroke-dasharray:3 5; }
    .grid.zero { stroke:var(--ws-line-strong); stroke-dasharray:none; }
    .axis { fill:var(--ws-ink-3); font-size:11px; font-family:var(--ws-font); font-variant-numeric:tabular-nums; }
    .area { animation:fade .8s ease both; }
    .line { fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1; animation:draw 1s cubic-bezier(.3,.7,.2,1) both; }
    .line.second { stroke-width:1.75; }
    .guide { stroke:var(--ws-line-strong); stroke-width:1; stroke-dasharray:2 3; }
    .dot { fill:var(--ws-surface); stroke-width:2; }
    .end-dot { stroke:var(--ws-surface); stroke-width:2; }
    @keyframes draw { from { stroke-dashoffset:1; } to { stroke-dashoffset:0; } }
    @keyframes fade { from { opacity:0; } }
    @media (prefers-reduced-motion: reduce) { .area, .line { animation:none; } }
    .hits { position:absolute; inset:0; }
    .hits span { position:absolute; inset-block:0; cursor:crosshair; outline:none; }
    .hits span:focus-visible { box-shadow:inset 0 0 0 2px var(--ws-brand); border-radius:var(--ws-r-md); }
    .tip { position:absolute; z-index:2; transform:translate(-50%, calc(-100% - 14px)); display:grid; gap:4px; min-width:170px; padding:var(--ws-2) var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-ink); box-shadow:var(--ws-shadow-pop); color:color-mix(in srgb, var(--ws-surface) 72%, transparent); font-size:var(--ws-text-xs); pointer-events:none; }
    .tip strong { color:var(--ws-surface); font-size:var(--ws-text-sm); }
    .tip span { display:flex; align-items:center; gap:var(--ws-2); }
    .tip b { margin-inline-start:auto; padding-inline-start:var(--ws-4); color:var(--ws-surface); font-weight:600; }
    table { width:100%; border-collapse:collapse; font-size:var(--ws-text-sm); }
    th, td { padding:var(--ws-2); border-block-end:1px solid var(--ws-line); text-align:start; color:var(--ws-ink); }
    thead th { color:var(--ws-ink-2); font-weight:600; }
    .end { text-align:end; }
  `],
})
export class WsAreaChartComponent {
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
  protected readonly PAD_R = 12;
  protected readonly PAD_B = 26;
  private readonly id = `wsac${++uid}`;
  protected readonly asTable = signal(false);
  protected readonly hover = signal<number | null>(null);

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
  private readonly step = computed(() => {
    const hi = Math.max(0, ...this.values());
    const lo = Math.min(0, ...this.values());
    return hi - lo > 0 ? niceMax((hi - lo) / 4) : 0.25;
  });
  private readonly max = computed(() => {
    const vs = this.values();
    if (!vs.some((v) => v > 0) && vs.some((v) => v < 0)) return 0;
    return Math.max(1, Math.ceil(Math.max(0, ...vs) / this.step())) * this.step();
  });
  /** Bottom: 0, or just below the deepest loss (never a whole empty step for a small loss). */
  protected readonly min = computed(() => {
    const lo = Math.min(0, ...this.values());
    return lo < 0 ? -Math.min(Math.ceil(-lo / this.step()) * this.step(), niceMax(-lo)) : 0;
  });
  /** Ticks on whole steps from zero; the bottom of a loss is labelled only when it has room (≥ 18 px). */
  protected readonly ticks = computed(() => {
    const s = this.step();
    const out: { v: number; y: number }[] = [];
    for (let k = Math.ceil(this.min() / s - 1e-9); k * s <= this.max() + s * 1e-9; k++) out.push({ v: k * s || 0, y: this.y(k * s) });
    const lo = this.min();
    if (lo < 0 && !out.some((t) => t.v === lo) && this.y(lo) - out[0].y >= 18) out.unshift({ v: lo, y: this.y(lo) });
    return out;
  });
  /** Distance between two days on the x axis. */
  protected readonly step2 = computed(() => (this.W - this.PAD_L - this.PAD_R) / Math.max(1, this.categories().length - 1));
  /** Show every nth x label so labels never collide (about 64 px each). */
  protected readonly labelEvery = computed(() => Math.max(1, Math.ceil(64 / this.step2())));

  protected x(ci: number): number {
    const n = this.categories().length;
    return n <= 1 ? (this.PAD_L + this.W - this.PAD_R) / 2 : this.PAD_L + ci * this.step2();
  }
  protected y(v: number | undefined): number {
    const lo = this.min();
    const span = this.max() - lo || 1;
    return this.H - this.PAD_B - (((v || 0) - lo) / span) * (this.H - this.PAD_B - 8);
  }
  /** Every nth label, plus the last day when it is not crowding the one before it. */
  protected showLabel(ci: number): boolean {
    const e = this.labelEvery();
    const last = this.categories().length - 1;
    return ci % e === 0 ? !(ci !== last && last - ci < e / 2 && ci !== 0) : ci === last && ci % e >= e / 2;
  }
  protected anchor(ci: number): string {
    const n = this.categories().length;
    return n > 1 && ci === 0 ? 'start' : n > 1 && ci === n - 1 ? 'end' : 'middle';
  }
  protected linePath(vs: number[]): string {
    return smoothPath(this.categories().map((_, i) => [this.x(i), this.y(vs[i])] as [number, number]));
  }
  protected areaPath(vs: number[]): string {
    const n = this.categories().length;
    if (!n) return '';
    const base = this.y(0);
    return `${this.linePath(vs)}L${this.x(n - 1)},${base}L${this.x(0)},${base}Z`;
  }
  protected total(s: WsSeries): number {
    return s.values.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
  }
  protected label(ci: number): string {
    return `${this.categories()[ci]}: ${this.series().map((s) => `${s.label} ${this.fmt(s.values[ci])}`).join(', ')}`;
  }
  /** Each day's hover strip reaches halfway to its neighbours and never past the plot (no sideways page scroll). */
  protected hitL(ci: number): number {
    return ci === 0 ? 0 : (this.x(ci - 1) + this.x(ci)) / 2;
  }
  protected hitR(ci: number): number {
    return ci === this.categories().length - 1 ? this.W : (this.x(ci) + this.x(ci + 1)) / 2;
  }
  protected pct(x: number): number {
    return (x / this.W) * 100;
  }
  protected tipX(ci: number): number {
    return Math.min(84, Math.max(16, this.pct(this.x(ci))));
  }
  /** The tooltip sits above the highest point of the hovered day. */
  protected tipY(ci: number): number {
    return Math.max(24, Math.min(...this.series().map((s) => this.y(s.values[ci]))));
  }
  protected gid(si: number): string {
    return `${this.id}-${si}`;
  }
  protected color(i: number): string {
    return i < 2 ? `var(--ws-chart-${i + 1})` : `var(--ws-series-${Math.min(i, 7) + 1})`;
  }
  /** round: whole rupees on the chart (as on the cards above it); the table keeps paisa. */
  protected fmt(v: number | undefined, round = false): string {
    if (round && v !== undefined && this.format() !== 'kg') v = Math.round(v);
    return this.format() === 'money' ? this.i18n.money(v) : this.format() === 'kg' ? this.i18n.kg(v) : this.i18n.num(v);
  }
  protected short(v: number): string {
    const a = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    return a >= 1e6 ? `${sign}${this.i18n.num(a / 1e6, 1)}M` : a >= 1e3 ? `${sign}${this.i18n.num(a / 1e3, a % 1000 ? 1 : 0)}k` : `${sign}${this.i18n.num(a)}`;
  }
}

/**
 * Monotone cubic curve through the points (Fritsch–Carlson): smooth, but it never bends above or below its two
 * neighbours, so a flat day stays flat and a curve never dips under zero between two sales days.
 */
export function smoothPath(p: [number, number][]): string {
  const n = p.length;
  if (!n) return '';
  if (n === 1) return `M${p[0][0] - 1},${p[0][1]}L${p[0][0] + 1},${p[0][1]}`;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : harmonic(d[i - 1], d[i]));
  m.push(d[n - 2]);
  let s = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3;
    s += `C${p[i][0] + h},${p[i][1] + m[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - m[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return s;
}

function harmonic(a: number, b: number): number {
  return (2 * a * b) / (a + b);
}
