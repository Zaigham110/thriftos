import { matches } from '../../../shell/workspace/command-palette.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WsBarChartComponent, niceMax } from './bar-chart.component';
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

  it('bar chart draws losses below a zero line and never a negative height', () => {
    TestBed.configureTestingModule({ imports: [WsBarChartComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(WsBarChartComponent);
    f.componentRef.setInput('heading', 'Net profit');
    f.componentRef.setInput('categories', ['Oct', 'Nov']);
    f.componentRef.setInput('series', [{ label: 'Net', values: [-200, 4000] }]);
    f.detectChanges();
    const rects = [...(f.nativeElement as HTMLElement).querySelectorAll('rect')];
    const zero = [...(f.nativeElement as HTMLElement).querySelectorAll('line.grid.zero')];
    expect(rects.length).toBe(2);
    expect(rects.every((r) => Number(r.getAttribute('height')) >= 0)).toBeTrue();
    expect(zero.length).toBe(1);
    const zeroY = Number(zero[0].getAttribute('y1'));
    // The loss starts at the zero line and goes down; the profit ends at the zero line.
    expect(Number(rects[0].getAttribute('y'))).toBeCloseTo(zeroY, 5);
    expect(Number(rects[1].getAttribute('y')) + Number(rects[1].getAttribute('height'))).toBeCloseTo(zeroY, 5);
  });
});
