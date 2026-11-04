import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, TrendingDown, TrendingUp } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * A headline number with its change against the previous period and a small trend line. The change is
 * shown with an arrow and a word, never colour alone; `higherIsBetter` decides which way is good.
 * The sparkline is decorative (its numbers are in the label for screen readers); click opens the list.
 */
@Component({
  selector: 'ws-kpi-card',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe],
  template: `
    <a class="card" [routerLink]="link()" [attr.aria-label]="ariaLabel()">
      <span class="top">
        <span class="label">{{ label() }}</span>
        @if (path()) {
          <svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path [attr.d]="path()" />
            <circle [attr.cx]="last()!.x" [attr.cy]="last()!.y" r="2.5" />
          </svg>
        }
      </span>
      <strong class="value ws-num">{{ value() }}</strong>
      <span class="foot">
        @if (delta() !== null) {
          <span class="delta" [class.good]="good()" [class.bad]="!good() && delta() !== 0">
            <lucide-icon [img]="delta()! >= 0 ? icons.TrendingUp : icons.TrendingDown" [size]="14" aria-hidden="true" />
            <span class="ws-num" dir="ltr">{{ deltaText() }}</span>
          </span>
          <span class="vs">{{ 'ws.kpi.vsPrevious' | t }}</span>
        } @else if (hint()) { <span class="vs">{{ hint() }}</span> }
      </span>
    </a>
  `,
  styles: [`
    .card { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-1); min-height:116px; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink); text-decoration:none; box-shadow:var(--ws-shadow-1); }
    .card:hover { border-color:var(--ws-line-strong); box-shadow:var(--ws-shadow-2); }
    .top { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--ws-3); }
    .label { color:var(--ws-ink-2); font-size:var(--ws-text-sm); font-weight:500; }
    .value { font-size:clamp(20px, 2.1vw, var(--ws-text-3xl)); font-weight:600; line-height:1.2; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .foot { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-1) var(--ws-2); min-height:20px; font-size:var(--ws-text-xs); }
    .delta { display:inline-flex; align-items:center; gap:2px; color:var(--ws-ink-2); font-weight:600; }
    .delta.good { color:var(--ws-good); }
    .delta.bad { color:var(--ws-bad); }
    .vs { color:var(--ws-ink-3); }
    .spark { flex:none; width:88px; height:28px; overflow:visible; direction:ltr; }
    .spark path { fill:none; stroke:var(--ws-series-1); stroke-width:2; vector-effect:non-scaling-stroke; stroke-linejoin:round; stroke-linecap:round; }
    .spark circle { fill:var(--ws-series-1); stroke:var(--ws-surface); stroke-width:2; vector-effect:non-scaling-stroke; }
  `],
})
export class WsKpiCardComponent {
  private readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  /** Already formatted (Rs 1,25,000; 1,040 kg). */
  readonly value = input.required<string>();
  /** Change against the previous period, in percent; null hides it. */
  readonly delta = input<number | null>(null);
  readonly higherIsBetter = input(true);
  readonly hint = input('');
  readonly trend = input<number[]>([]);
  readonly link = input<string | unknown[] | null>(null);

  protected readonly icons = { TrendingDown, TrendingUp };
  protected readonly good = computed(() => {
    const d = this.delta();
    return d !== null && d !== 0 && (d > 0) === this.higherIsBetter();
  });
  protected readonly deltaText = computed(() => {
    const d = this.delta();
    return d === null ? '' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${this.i18n.num(Math.abs(d), 1)}%`;
  });
  private readonly points = computed(() => sparkPoints(this.trend()));
  protected readonly path = computed(() => (this.points().length > 1 ? 'M' + this.points().map((p) => `${p.x},${p.y}`).join(' L') : ''));
  protected readonly last = computed(() => this.points().at(-1) ?? null);
  protected readonly ariaLabel = computed(() => [this.label(), this.value(), this.delta() !== null ? `${this.deltaText()} ${this.i18n.t('ws.kpi.vsPrevious')}` : this.hint()].filter(Boolean).join(', '));
}

/** Points in a 100×28 box with 3 px of air top and bottom; a flat series sits in the middle. */
export function sparkPoints(values: number[]): { x: number; y: number }[] {
  if (values.length < 2) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min;
  return values.map((v, i) => ({
    x: Math.round((i / (values.length - 1)) * 1000) / 10,
    y: span === 0 ? 14 : Math.round((3 + (1 - (v - min) / span) * 22) * 10) / 10,
  }));
}
