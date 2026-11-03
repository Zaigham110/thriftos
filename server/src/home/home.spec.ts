import { Prisma } from '@prisma/client';
import { byContainer, percent, startOfDayPKT, topGradePercent } from './home';

describe('home numbers', () => {
  it('today starts at midnight Pakistan time', () => {
    // 23:30 PKT on 2 Nov is still 2 Nov; 00:30 PKT on 3 Nov is a new day.
    expect(startOfDayPKT(new Date('2026-11-02T18:30:00Z')).toISOString()).toBe('2026-11-01T19:00:00.000Z');
    expect(startOfDayPKT(new Date('2026-11-02T19:30:00Z')).toISOString()).toBe('2026-11-02T19:00:00.000Z');
  });

  it('a line from one container counts fully for it; a mixed bale is split by cost share to the paisa', () => {
    const r = byContainer([
      { profit: 1000, revenue: 5000, shares: [{ containerId: 'A', weight: 1 }] },
      { profit: '100.01', revenue: '300', shares: [{ containerId: 'A', weight: 1 }, { containerId: 'B', weight: 2 }] },
    ]);
    expect(r.get('A')!.profit.toFixed(2)).toBe('1033.34');
    expect(r.get('B')!.profit.toFixed(2)).toBe('66.67');
    expect(r.get('A')!.profit.add(r.get('B')!.profit).toFixed(2)).toBe('1100.01');
    expect(r.get('A')!.revenue.add(r.get('B')!.revenue).toFixed(2)).toBe('5300.00');
  });

  it('a loss is split too, and loose-lot shares and zero weights are left out', () => {
    const r = byContainer([
      { profit: '-90', revenue: 10, shares: [{ containerId: 'A', weight: 2 }, { containerId: null, weight: 1 }] },
      { profit: 50, revenue: 50, shares: [{ containerId: 'A', weight: 0 }] },
    ]);
    expect(r.get('A')!.profit.toFixed(2)).toBe('-60.00');
    expect(r.size).toBe(1);
  });

  it('top-grade and plain percentages are whole numbers, null when there is nothing to divide by', () => {
    expect(topGradePercent([{ rank: 1, kg: 18 }, { rank: 2, kg: 60 }, { rank: 3, kg: 22 }], 1)).toBe(18);
    expect(topGradePercent([], 1)).toBeNull();
    expect(percent(new Prisma.Decimal(1), 3)).toBe(33);
    expect(percent(5, 0)).toBeNull();
  });
});
