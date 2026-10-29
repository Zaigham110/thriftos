import { Decimal } from '@prisma/client/runtime/library';
import {
  allocateByWeight,
  baleCost,
  costPerKg,
  fifoTake,
  InsufficientStockError,
  landedCost,
  lotCosts,
  money,
  outputCosts,
  pieceCosts,
  saleProfit,
  sum,
  takeCost,
} from './costing';

const amounts = (rows: { amount: Decimal }[]) => rows.map((r) => r.amount.toFixed(2));
const total = (rows: { amount: Decimal }[]) => sum(rows.map((r) => r.amount)).toFixed(2);

describe('money', () => {
  it('rounds half up to the paisa', () => {
    expect(money('0.005').toFixed(2)).toBe('0.01');
    expect(money('2.344').toFixed(2)).toBe('2.34');
    expect(money(10).toFixed(2)).toBe('10.00');
  });
});

describe('costPerKg', () => {
  it('divides to 4 dp', () => {
    expect(costPerKg(100, 3).toFixed(4)).toBe('33.3333');
  });
  it('is zero without weight', () => {
    expect(costPerKg(100, 0).toFixed(4)).toBe('0.0000');
  });
});

describe('landedCost', () => {
  it('adds charges to a PKR purchase and ignores the FX rate', () => {
    const cost = landedCost({ purchaseCost: '4500000', purchaseCurrency: 'PKR', fxRate: '280', charges: ['350000', '120000.50'] });
    expect(cost.toFixed(2)).toBe('4970000.50');
  });

  it('converts a USD purchase with the FX rate, then adds PKR charges', () => {
    const cost = landedCost({ purchaseCost: '16000', purchaseCurrency: 'usd', fxRate: '278.4567', charges: ['400000'] });
    // 16000 × 278.4567 = 4,455,307.20
    expect(cost.toFixed(2)).toBe('4855307.20');
  });

  it('rounds the converted purchase to the paisa', () => {
    expect(landedCost({ purchaseCost: '0.01', purchaseCurrency: 'USD', fxRate: '0.5', charges: [] }).toFixed(2)).toBe('0.01');
  });

  it('works with no charges and with zero purchase cost', () => {
    expect(landedCost({ purchaseCost: 0, purchaseCurrency: 'PKR', fxRate: 1, charges: [] }).toFixed(2)).toBe('0.00');
  });

  it('rejects a negative purchase cost', () => {
    expect(() => landedCost({ purchaseCost: -1, purchaseCurrency: 'PKR', fxRate: 1, charges: [] })).toThrow('negative');
  });
});

describe('allocateByWeight', () => {
  it('gives leftover paisa to the largest remainders so parts sum exactly', () => {
    const rows = allocateByWeight('100', [
      { key: 'a', weight: 1 },
      { key: 'b', weight: 1 },
      { key: 'c', weight: 1 },
    ]);
    expect(amounts(rows)).toEqual(['33.34', '33.33', '33.33']);
    expect(total(rows)).toBe('100.00');
  });

  it('breaks remainder ties by heavier part, then input order', () => {
    // 0.05 over weights 1,2,1,1 → raw paisa 1, 2, 1, 1 exactly: no ties needed.
    expect(amounts(allocateByWeight('0.05', [{ key: 1, weight: 1 }, { key: 2, weight: 2 }, { key: 3, weight: 1 }, { key: 4, weight: 1 }]))).toEqual([
      '0.01', '0.02', '0.01', '0.01',
    ]);
    // 0.02 over weights 1,1,1 → each 0.666 paisa; equal remainders and weights → first two get the paisa.
    expect(amounts(allocateByWeight('0.02', [{ key: 1, weight: 1 }, { key: 2, weight: 1 }, { key: 3, weight: 1 }]))).toEqual(['0.01', '0.01', '0.00']);
    // 0.01 over weights 1 and 2 → remainders 1/3 and 2/3; the heavier part wins.
    expect(amounts(allocateByWeight('0.01', [{ key: 1, weight: 1 }, { key: 2, weight: 2 }]))).toEqual(['0.00', '0.01']);
    // 0.03 over weights 2,1,2,1 → remainders .0, .5, .0, .5 → equal remainder and weight: earlier index wins.
    expect(amounts(allocateByWeight('0.03', [{ key: 1, weight: 2 }, { key: 2, weight: 1 }, { key: 3, weight: 2 }, { key: 4, weight: 1 }]))).toEqual([
      '0.01', '0.01', '0.01', '0.00',
    ]);
  });

  it('gives a single part the whole amount', () => {
    expect(amounts(allocateByWeight('1234567.89', [{ key: 'only', weight: '18000.5' }]))).toEqual(['1234567.89']);
  });

  it('gives zero-weight parts nothing', () => {
    const rows = allocateByWeight('10', [{ key: 'a', weight: 0 }, { key: 'b', weight: 3 }]);
    expect(amounts(rows)).toEqual(['0.00', '10.00']);
  });

  it('allocates zero when the total is zero, even with zero weights', () => {
    expect(amounts(allocateByWeight(0, [{ key: 'a', weight: 0 }]))).toEqual(['0.00']);
    expect(amounts(allocateByWeight(0, [{ key: 'a', weight: 5 }]))).toEqual(['0.00']);
  });

  it('refuses to spread a cost over zero weight', () => {
    expect(() => allocateByWeight(10, [{ key: 'a', weight: 0 }])).toThrow('total weight is zero');
    expect(() => allocateByWeight(10, [])).toThrow('total weight is zero');
  });

  it('rejects negative totals and weights', () => {
    expect(() => allocateByWeight(-1, [{ key: 'a', weight: 1 }])).toThrow('negative');
    expect(() => allocateByWeight(1, [{ key: 'a', weight: -1 }])).toThrow('negative');
  });

  it('rounds an unrounded total to the paisa first', () => {
    expect(total(allocateByWeight('10.005', [{ key: 'a', weight: 1 }, { key: 'b', weight: 2 }]))).toBe('10.01');
  });

  it('always sums exactly (randomised)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 500; run++) {
      const parts = Array.from({ length: 1 + Math.floor(rand() * 12) }, (_, i) => ({
        key: i,
        weight: (rand() * 5000).toFixed(2),
      }));
      const amount = (rand() * 50_000_000).toFixed(2);
      const rows = allocateByWeight(amount, parts);
      if (sum(parts.map((p) => p.weight)).isZero()) continue;
      expect(total(rows)).toBe(new Decimal(amount).toFixed(2));
      rows.forEach((r) => expect(r.amount.isNegative()).toBe(false));
    }
  });
});

describe('lotCosts', () => {
  it('splits landed cost by lot weight, not container net weight', () => {
    // Container net weight might say 26,000 kg; only the lots' own weights matter.
    const rows = lotCosts('4970000.50', [
      { key: 'L1', weightKg: '8000' },
      { key: 'L2', weightKg: '9000' },
      { key: 'L3', weightKg: '8500.5' },
    ]);
    expect(total(rows)).toBe('4970000.50');
    expect(amounts(rows)).toEqual(['1559185.27', '1754083.43', '1656731.80']);
  });
});

describe('takeCost', () => {
  const source = { cost: '1000.00', kg: '3' };

  it('charges the cumulative share, so a fully used output adds up exactly', () => {
    const takes = [takeCost(source, 0, 1), takeCost(source, 1, 1), takeCost(source, 2, 1)];
    expect(takes.map((t) => t.toFixed(2))).toEqual(['333.33', '333.34', '333.33']);
    expect(sum(takes).toFixed(2)).toBe('1000.00');
  });

  it('adds up exactly in any split of the output', () => {
    const a = takeCost({ cost: '777.77', kg: '19.3' }, 0, '7.1');
    const b = takeCost({ cost: '777.77', kg: '19.3' }, '7.1', '12.2');
    expect(a.add(b).toFixed(2)).toBe('777.77');
  });

  it('rejects empty and oversized takes', () => {
    expect(() => takeCost(source, 0, 0)).toThrow('more than zero');
    expect(() => takeCost(source, 2, 2)).toThrow('more than the output weighs');
  });
});

describe('pieceCosts', () => {
  it('shares an opened bale by piece count, to the paisa', () => {
    const tiers = pieceCosts('10000.00', [
      { key: '300', pieces: 30 },
      { key: '500', pieces: 20 },
      { key: '800', pieces: 7 },
    ]);
    expect(amounts(tiers)).toEqual(['5263.16', '3508.77', '1228.07']);
    expect(total(tiers)).toBe('10000.00');
  });

  it('gives the left-over paisa by largest remainder', () => {
    const tiers = pieceCosts('1000.00', [
      { key: 'a', pieces: 1 },
      { key: 'b', pieces: 1 },
      { key: 'c', pieces: 1 },
    ]);
    expect(amounts(tiers)).toEqual(['333.34', '333.33', '333.33']);
  });
});

describe('fifoTake', () => {
  const sources = [
    { key: 'old', availableKg: '10' },
    { key: 'empty', availableKg: '0' },
    { key: 'new', availableKg: '50' },
  ];

  it('takes oldest first and skips empty sources', () => {
    const takes = fifoTake(sources, '25');
    expect(takes.map((t) => [t.key, t.kg.toFixed(2)])).toEqual([
      ['old', '10.00'],
      ['new', '15.00'],
    ]);
  });

  it('stops once the weight is covered', () => {
    expect(fifoTake(sources, 5).map((t) => t.key)).toEqual(['old']);
  });

  it('says how much is available when there is not enough', () => {
    expect(() => fifoTake(sources, 61)).toThrow(InsufficientStockError);
    try {
      fifoTake(sources, 61);
    } catch (e) {
      expect((e as InsufficientStockError).availableKg.toFixed(2)).toBe('60.00');
      expect((e as Error).message).toBe('Not enough sorted stock: 60.00 kg available');
    }
  });

  it('rejects zero weight', () => {
    expect(() => fifoTake(sources, 0)).toThrow('more than zero');
  });
});

describe('baleCost and saleProfit', () => {
  it('sums take costs', () => {
    expect(baleCost(['333.33', '0.67']).toFixed(2)).toBe('334.00');
  });

  it('is price minus cost, and can be a loss', () => {
    expect(saleProfit('50000', '41234.56').toFixed(2)).toBe('8765.44');
    expect(saleProfit('100', '120.5').toFixed(2)).toBe('-20.50');
  });
});

/**
 * Whole-chain checks: at every stage the parts add up to the landed cost to the paisa.
 */
describe('cost chain', () => {
  const landed = landedCost({ purchaseCost: '15000', purchaseCurrency: 'USD', fxRate: '279.85', charges: ['412345.67', '98000', '35000.33'] });
  const lots = lotCosts(landed, [
    { key: 'L1', weightKg: '7000' },
    { key: 'L2', weightKg: '8250.5' },
    { key: 'L3', weightKg: '6833.3' },
  ]);

  it('lots add up to the landed cost', () => {
    expect(landed.toFixed(2)).toBe('4743096.00');
    expect(total(lots)).toBe(landed.toFixed(2));
  });

  it('one-stage sorting: FIFO bales from category outputs use up the lot cost exactly', () => {
    const lot = lots[0];
    // 7000 kg lot → 6,580 kg of outputs + 420 kg waste (waste carries no cost).
    const outputs = outputCosts(lot.amount, [
      { key: 'jeans', kg: '2600' },
      { key: 'shirts', kg: '2480.4' },
      { key: 'kids', kg: '1499.6' },
    ]);
    expect(total(outputs)).toBe(lot.amount.toFixed(2));

    // Two jeans outputs (from this lot and an older one) feed bales oldest-first.
    const jeans = [
      { key: 'older-jeans', kg: new Decimal('130'), cost: new Decimal('61750.00'), used: new Decimal(0) },
      { key: 'jeans', kg: new Decimal('2600'), cost: outputs[0].amount, used: new Decimal(0) },
    ];
    const baleKgs = ['100', '100', '100', ...Array.from({ length: 24 }, () => '100'), '30'];
    const bales: Decimal[] = [];
    for (const kg of baleKgs) {
      const takes = fifoTake(jeans.map((j) => ({ key: j.key, availableKg: j.kg.sub(j.used) })), kg);
      const costs = takes.map((t) => {
        const src = jeans.find((j) => j.key === t.key)!;
        const c = takeCost({ cost: src.cost, kg: src.kg }, src.used, t.kg);
        src.used = src.used.add(t.kg);
        return c;
      });
      bales.push(baleCost(costs));
    }
    expect(jeans.every((j) => j.used.equals(j.kg))).toBe(true);
    expect(sum(bales).toFixed(2)).toBe(new Decimal('61750.00').add(outputs[0].amount).toFixed(2));
  });

  it('two-stage sorting: grades, bales and a sale reconcile to the paisa', () => {
    const lot = lots[1];
    const categories = outputCosts(lot.amount, [
      { key: 'jeans', kg: '3100.25' },
      { key: 'tops', kg: '4700' },
    ]);
    expect(total(categories)).toBe(lot.amount.toFixed(2));

    const grades = outputCosts(categories[0].amount, [
      { key: 'A', kg: '1205.5' },
      { key: 'B', kg: '1400' },
      { key: 'C', kg: '410' },
    ]);
    expect(total(grades)).toBe(categories[0].amount.toFixed(2));

    // Grade A (1205.5 kg) into bales of 50 kg and one of 5.5 kg.
    const a = { cost: grades[0].amount, kg: new Decimal('1205.5') };
    let used = new Decimal(0);
    const bales: Decimal[] = [];
    for (const kg of [...Array.from({ length: 24 }, () => '50'), '5.5']) {
      bales.push(baleCost([takeCost(a, used, kg)]));
      used = used.add(kg);
    }
    expect(sum(bales).toFixed(2)).toBe(a.cost.toFixed(2));

    const profit = saleProfit('25000', bales[0]);
    expect(profit.add(bales[0]).toFixed(2)).toBe('25000.00');
  });
});
