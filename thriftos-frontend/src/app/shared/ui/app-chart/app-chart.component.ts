import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppEmptyStateComponent } from '../app-empty-state/app-empty-state.component';

export type ChartType = 'line' | 'bar';
export type ChartVariant = 'panel' | 'sparkline';

export interface ChartPoint {
  label: string;
  value: number;
}

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule, AppEmptyStateComponent],
  template: `
    <div class="app-chart" [attr.data-variant]="variant" (mouseleave)="onLeave()">
      @if (points.length === 0) {
        <div class="chart-empty">
          <app-empty-state title="No chart data" message="Try another period or adjust filters." />
        </div>
      } @else {
        <svg
          class="chart-svg"
          [attr.viewBox]="viewBox()"
          preserveAspectRatio="none"
          (mousemove)="onMove($event)"
        >
          @if (type === 'bar') {
            @for (b of bars(); track b.i) {
              <rect
                class="chart-bar"
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.w"
                [attr.height]="b.h"
                rx="2"
              ></rect>
            }
          } @else {
            <path class="chart-line" [attr.d]="linePath()"></path>
            @if (variant === 'panel' || points.length === 1) {
              @for (p of dots(); track p.i) {
                <circle
                  class="chart-dot"
                  [attr.cx]="p.x"
                  [attr.cy]="p.y"
                  r="3"
                ></circle>
              }
            }
          }
        </svg>
      }

      @if (variant === 'panel' && hover()) {
        <div class="chart-tooltip" [style.left.px]="hover()!.px" [style.top.px]="hover()!.py">
          <div class="tt-label">{{ hover()!.label }}</div>
          <div class="tt-value">{{ hover()!.value }}</div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./app-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppChartComponent {
  @Input({ required: true }) points: ChartPoint[] = [];
  @Input() type: ChartType = 'line';
  @Input() variant: ChartVariant = 'panel';

  /** Emits the hovered point index (panel only). */
  @Output() hoverIndexChange = new EventEmitter<number | null>();

  private readonly svgWidth = computed(() => (this.variant === 'sparkline' ? 120 : 640));
  private readonly svgHeight = computed(() => (this.variant === 'sparkline' ? 28 : 240));

  private readonly hoverState = signal<null | { index: number; label: string; value: string; px: number; py: number }>(null);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.svgHeight()}`);

  private readonly yDomain = computed(() => {
    const vals = (this.points ?? []).map((p) => p.value).filter((v) => Number.isFinite(v));
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const span = max - min;
    return { min, max, span: span === 0 ? 1 : span };
  });

  private readonly xStep = computed(() => {
    const n = (this.points ?? []).length;
    const w = this.svgWidth();
    return n <= 1 ? 0 : w / (n - 1);
  });

  private readonly pad = computed(() => (this.variant === 'sparkline' ? 2 : 10));

  private mapPoint(i: number) {
    const h = this.svgHeight();
    const pad = this.pad();
    const { min, span } = this.yDomain();
    const x = i * this.xStep();
    const v = this.points[i]?.value ?? 0;
    const t = (v - min) / span;
    const y = (h - pad) - t * (h - pad * 2);
    return { x, y, v };
  }

  linePath = computed(() => {
    const n = (this.points ?? []).length;
    if (n === 0) return '';

    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const { x, y } = this.mapPoint(i);
      parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return parts.join(' ');
  });

  dots = computed(() => {
    const n = (this.points ?? []).length;
    const out: Array<{ i: number; x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const { x, y } = this.mapPoint(i);
      out.push({ i, x, y });
    }
    return out;
  });

  bars = computed(() => {
    const n = (this.points ?? []).length;
    if (n === 0) return [] as Array<{ i: number; x: number; y: number; w: number; h: number }>;

    const w = this.svgWidth();
    const h = this.svgHeight();
    const pad = this.pad();

    const barW = Math.max(2, w / Math.max(n * 1.6, 1));
    const gap = Math.max(1, (w - barW * n) / Math.max(n - 1, 1));

    const { min, span } = this.yDomain();
    const baseY = h - pad;

    const out: Array<{ i: number; x: number; y: number; w: number; h: number }> = [];
    let x = 0;

    for (let i = 0; i < n; i++) {
      const v = this.points[i]?.value ?? 0;
      const t = (v - min) / span;
      const barH = Math.max(1, t * (h - pad * 2));
      out.push({ i, x, y: baseY - barH, w: barW, h: barH });
      x += barW + gap;
    }

    return out;
  });

  hover = computed(() => this.hoverState());

  onLeave(): void {
    this.hoverState.set(null);
    this.hoverIndexChange.emit(null);
  }

  onMove(event: MouseEvent): void {
    if (this.variant !== 'panel') return;
    const pts = this.points ?? [];
    if (pts.length === 0) return;

    const svg = (event.target as Element).closest('svg');
    if (!svg) return;

    const rect = (svg as SVGSVGElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const w = rect.width;

    const index = pts.length === 1 ? 0 : Math.round((x / Math.max(w, 1)) * (pts.length - 1));
    const clamped = Math.max(0, Math.min(pts.length - 1, index));

    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const px = event.clientX - hostRect.left + 10;
    const py = event.clientY - hostRect.top + 10;

    const p = pts[clamped];
    this.hoverState.set({
      index: clamped,
      label: p.label,
      value: String(p.value),
      px,
      py,
    });
    this.hoverIndexChange.emit(clamped);
  }
}
