import { matches } from '../../../shell/workspace/command-palette.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WsBarChartComponent, niceMax } from './bar-chart.component';
import { WsAreaChartComponent, smoothPath } from './area-chart.component';
import { compare } from './data-grid.component';
import { rangeFor } from './date-range.component';
import { sparkPoints } from './kpi-card.component';

describe('workspace components (logic)', () => {
  it('grid sorting: numbers by value, ISO dates by time, text by language, empty last', () => {
    expect(['10', '9', '100'].sort(compare)).toEqual(['9', '10', '100']);
    expect(['2026-11-03', '2026-01-15', '2025-12-31'].sort(compare)).toEqual(['2025-12-31', '2026-01-15', '2026-11-03']);
    expect(['Bilal', 'ali', 'Ahmed'].sort(compare)).toEqual(['Ahmed', 'ali', 'Bilal']);
    expect([null, 5, undefined, 1].sort(compare)).toEqual([1, 5, null, undefined]);
  });

  it('sparkline points fill a 100×28 box; a flat series sits in the middle', () => {
    expect(sparkPoints([1])).toEqual([]);
    expect(sparkPoints([0, 10])).toEqual([{ x: 0, y: 25 }, { x: 100, y: 3 }]);
    expect(sparkPoints([4, 4, 4]).map((p) => p.y)).toEqual([14, 14, 14]);
  });

  it('axis maximum rounds up to 1, 2, 2.5 or 5 × 10ⁿ', () => {
    expect([0, 7, 12, 23, 240, 260, 999, 120000].map(niceMax)).toEqual([1, 10, 20, 25, 250, 500, 1000, 200000]);
  });

  it('date presets on 3 Nov 2026', () => {
    const today = new Date(2026, 10, 3);
    expect(rangeFor('today', today)).toEqual({ preset: 'today', from: '2026-11-03', to: '2026-11-03' });
    expect(rangeFor('7d', today).from).toBe('2026-10-28');
    expect(rangeFor('month', today).from).toBe('2026-11-01');
    expect(rangeFor('lastMonth', today)).toEqual({ preset: 'lastMonth', from: '2026-10-01', to: '2026-10-31' });
    expect(rangeFor('year', today).from).toBe('2026-01-01');
  });

  it('command palette matching: every word, any case, label or keywords', () => {
    expect(matches('khata', 'Receivables khata udhaar')).toBeTrue();
    expect(matches('new SALE', 'New sale becho')).toBeTrue();
    expect(matches('sale stock', 'New sale becho')).toBeFalse();
    expect(matches('  ', 'anything')).toBeTrue();
  });

  it('bar chart never squeezes a small loss label onto zero', () => {
    TestBed.configureTestingModule({ imports: [WsBarChartComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(WsBarChartComponent);
    f.componentRef.setInput('heading', 'Sales');
    f.componentRef.setInput('categories', ['2 Nov', '4 Nov']);
    f.componentRef.setInput('series', [{ label: 'Gross profit', values: [-480, 104000] }]);
    f.detectChanges();
    const ys = [...(f.nativeElement as HTMLElement).querySelectorAll('text.axis')].filter((t) => t.getAttribute('text-anchor') === 'end').map((t) => Number(t.getAttribute('y')));
    for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1])).toBeGreaterThanOrEqual(18);
  });

  it('bar chart draws losses below a zero line and never a negative height', () => {
    TestBed.configureTestingModule({ imports: [WsBarChartComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(WsBarChartComponent);
    f.componentRef.setInput('heading', 'Net profit');
    f.componentRef.setInput('categories', ['Oct', 'Nov']);
    f.componentRef.setInput('series', [{ label: 'Net', values: [-200, 4000] }]);
    f.detectChanges();
    const bars = [...(f.nativeElement as HTMLElement).querySelectorAll('path.bar')];
    const zero = [...(f.nativeElement as HTMLElement).querySelectorAll('line.grid.zero')];
    expect(bars.length).toBe(2);
    expect(bars.every((b) => Number(b.getAttribute('data-bottom')) >= Number(b.getAttribute('data-top')))).toBeTrue();
    expect(zero.length).toBe(1);
    const zeroY = Number(zero[0].getAttribute('y1'));
    // The loss starts at the zero line and goes down; the profit ends at the zero line.
    expect(Number(bars[0].getAttribute('data-top'))).toBeCloseTo(zeroY, 5);
    expect(Number(bars[1].getAttribute('data-bottom'))).toBeCloseTo(zeroY, 5);
  });

  it('area chart: the curve never dips below zero between a no-sale day and a sale day, and totals sit in the legend', () => {
    // A monotone curve: every control point stays between its two neighbours' heights.
    const d = smoothPath([[0, 200], [100, 200], [200, 40], [300, 200]]);
    const ys = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(200);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(40);

    TestBed.configureTestingModule({ imports: [WsAreaChartComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(WsAreaChartComponent);
    f.componentRef.setInput('heading', 'Sales by day');
    f.componentRef.setInput('categories', ['1 Nov', '2 Nov', '3 Nov']);
    f.componentRef.setInput('series', [{ label: 'Sales', values: [0, 1000, 2500] }, { label: 'Gross profit', values: [0, -480.4, 900.6] }]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('path.line').length).toBe(2);
    expect(el.querySelectorAll('path.area').length).toBe(2);
    expect(el.querySelectorAll('line.grid.zero').length).toBe(1);
    const totals = [...el.querySelectorAll('.legend b')].map((b) => b.textContent!.replace(/[^\d,.-]/g, ''));
    expect(totals).toEqual(['3,500', '420']);
  });
});
