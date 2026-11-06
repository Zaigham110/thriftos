import { sum } from '../costing/costing';
import { applyPayments, overdueDays, tracePayments } from './khata';

const day = (d: number) => new Date(Date.UTC(2026, 9, d));
const sale = (key: string, d: number, total: string, paidWithSale = '0') => ({ key, at: day(d), total, paidWithSale });
const rows = (applied: ReturnType<typeof applyPayments<string>>) =>
  applied.sales.map((s) => [s.key, s.paid.toFixed(2), s.due.toFixed(2), s.status]);

describe('applyPayments', () => {
  it('pays the opening balance first, then the oldest sales', () => {
    const applied = applyPayments({
      openingBalance: '10000',
      sales: [sale('s1', 1, '20000'), sale('s2', 2, '15000'), sale('s3', 3, '5000')],
      onAccount: '32000',
    });
    expect(applied.openingDue.toFixed(2)).toBe('0.00');
    expect(rows(applied)).toEqual([
      ['s1', '20000.00', '0.00', 'PAID'],
      ['s2', '2000.00', '13000.00', 'PARTIALLY_PAID'],
      ['s3', '0.00', '5000.00', 'ISSUED'],
    ]);
    expect(applied.balance.toFixed(2)).toBe('18000.00');
  });

  it('keeps money paid with a sale on that sale, even when older sales are unpaid', () => {
    const applied = applyPayments({
      openingBalance: 0,
      sales: [sale('old', 1, '8000'), sale('cash', 2, '3000', '3000'), sale('part', 3, '9000', '4000')],
      onAccount: 0,
    });
    expect(rows(applied)).toEqual([
      ['old', '0.00', '8000.00', 'ISSUED'],
      ['cash', '3000.00', '0.00', 'PAID'],
      ['part', '4000.00', '5000.00', 'PARTIALLY_PAID'],
    ]);
    expect(applied.balance.toFixed(2)).toBe('13000.00');
  });

  it('moves anything paid over a sale to the oldest debt', () => {
    const applied = applyPayments({
      openingBalance: '500',
      sales: [sale('a', 1, '1000'), sale('b', 2, '1000', '1800')],
      onAccount: 0,
    });
    expect(applied.openingDue.toFixed(2)).toBe('0.00');
    expect(rows(applied)).toEqual([
      ['a', '300.00', '700.00', 'PARTIALLY_PAID'],
      ['b', '1000.00', '0.00', 'PAID'],
    ]);
    expect(applied.balance.toFixed(2)).toBe('700.00');
  });

  it('treats a negative opening balance as an advance, and reports what is paid in advance', () => {
    const applied = applyPayments({ openingBalance: '-2000', sales: [sale('a', 1, '1500')], onAccount: '1000' });
    expect(rows(applied)).toEqual([['a', '1500.00', '0.00', 'PAID']]);
    expect(applied.advance.toFixed(2)).toBe('1500.00');
    expect(applied.balance.toFixed(2)).toBe('-1500.00');
  });

  it('leaves part of the opening balance owed when payments do not cover it', () => {
    const applied = applyPayments({ openingBalance: '10000', sales: [sale('a', 1, '0')], onAccount: '2500.50' });
    expect(applied.openingDue.toFixed(2)).toBe('7499.50');
    expect(rows(applied)).toEqual([['a', '0.00', '0.00', 'PAID']]);
  });

  it('always equals opening balance + sales − payments', () => {
    let seed = 7;
    const rand = (max: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % max;
    };
    for (let run = 0; run < 200; run++) {
      const opening = ((rand(400000) - 100000) / 100).toFixed(2);
      const sales = Array.from({ length: rand(6) }, (_, i) => sale(`s${i}`, i + 1, (rand(5000000) / 100).toFixed(2), (rand(3) ? 0 : rand(6000000) / 100).toFixed(2)));
      const onAccount = (rand(8000000) / 100).toFixed(2);
      const applied = applyPayments({ openingBalance: opening, sales, onAccount });
      const expected = sum([opening, ...sales.map((s) => s.total)]).sub(sum([onAccount, ...sales.map((s) => s.paidWithSale)]));
      expect(applied.balance.toFixed(2)).toBe(expected.toFixed(2));
      for (const s of applied.sales) {
        expect(s.paid.add(s.due).toFixed(2)).toBe(s.total.toFixed(2));
        expect(s.due.isNegative()).toBe(false);
      }
    }
  });
});

describe('overdueDays', () => {
  const now = new Date(Date.UTC(2026, 9, 31, 12));

  it('counts from the oldest sale still owed', () => {
    const applied = applyPayments({ openingBalance: 0, sales: [sale('a', 1, '100', '100'), sale('b', 11, '100')], onAccount: 0 });
    expect(overdueDays(applied, day(1), now)).toBe(20);
  });

  it('counts from the opening date while the opening balance is owed', () => {
    const applied = applyPayments({ openingBalance: '100', sales: [sale('a', 20, '100')], onAccount: 0 });
    expect(overdueDays(applied, day(5), now)).toBe(26);
  });

  it('is zero when nothing is owed', () => {
    const applied = applyPayments({ openingBalance: 0, sales: [sale('a', 1, '100', '100')], onAccount: 0 });
    expect(overdueDays(applied, day(1), now)).toBe(0);
  });
});


describe('tracePayments', () => {
  const d = (n: number) => new Date(2026, 9, n);
  it('names the payments that paid each sale, adding up to what applyPayments says was paid', () => {
    const sales = [
      { id: 's1', total: 50000 },
      { id: 's2', total: 77300 },
      { id: 's3', total: 20000 },
    ];
    const payments = [
      { id: 'p1', at: d(1), amount: 20000, saleId: 's2' }, // paid with sale 2
      { id: 'p2', at: d(2), amount: 40000, saleId: null }, // on account: opening 10,000, then sale 1
      { id: 'p3', at: d(3), amount: 30000, saleId: null }, // rest of sale 1, then sale 2
    ];
    const traced = tracePayments({ openingBalance: 10000, sales, payments });
    const applied = applyPayments({
      openingBalance: 10000,
      onAccount: 70000,
      sales: sales.map((s) => ({ key: s.id, at: d(1), total: s.total, paidWithSale: s.id === 's2' ? 20000 : 0 })),
    });
    for (const a of applied.sales) {
      const sum = (traced.get(a.key) ?? []).reduce((t, x) => t + Number(x.amount), 0);
      expect(sum).toBe(Number(a.paid));
    }
    expect(traced.get('s1')!.map((x) => [x.payment.id, Number(x.amount)])).toEqual([['p2', 30000], ['p3', 20000]]);
    expect(traced.get('s2')!.map((x) => [x.payment.id, Number(x.amount), x.withSale])).toEqual([['p1', 20000, true], ['p3', 10000, false]]);
    expect(traced.get('s3')).toBeUndefined();
  });
});
