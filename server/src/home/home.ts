import { Prisma } from '@prisma/client';
import { allocateByWeight } from '../costing/costing';

type Decimal = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);
/** Pakistan time has no daylight saving: UTC+5 all year. */
const PKT_OFFSET_MS = 5 * 3600 * 1000;

/** 00:00 today in Pakistan time, as a UTC instant ("today's sales"). */
export function startOfDayPKT(now: Date): Date {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - PKT_OFFSET_MS);
}

/** A sale line and where its stock came from: one container, or the containers a bale was taken from (by cost). */
export interface LineSource {
  profit: Prisma.Decimal.Value;
  revenue: Prisma.Decimal.Value;
  /** Container ids with the cost each put into the item (a bale can mix containers); null container = loose lot. */
  shares: { containerId: string | null; weight: Prisma.Decimal.Value }[];
}

/**
 * Profit and revenue per container from sold lines. A line made from several containers is split by their
 * share of its cost (largest remainder, so the parts add up to the line to the paisa). A loss is split the same way.
 */
export function byContainer(lines: LineSource[]): Map<string, { profit: Decimal; revenue: Decimal }> {
  const out = new Map<string, { profit: Decimal; revenue: Decimal }>();
  const split = (amount: Decimal, shares: LineSource['shares']) => {
    const parts = shares.map((s, i) => ({ key: i, weight: D(s.weight) }));
    const sign = amount.isNegative() ? -1 : 1;
    return allocateByWeight(amount.abs(), parts).map((a) => ({ containerId: shares[a.key].containerId, amount: a.amount.mul(sign) }));
  };
  for (const line of lines) {
    const shares = line.shares.filter((s) => D(s.weight).greaterThan(0));
    if (!shares.length) continue;
    const profit = split(D(line.profit), shares);
    const revenue = split(D(line.revenue), shares);
    profit.forEach((p, i) => {
      if (!p.containerId) return;
      const row = out.get(p.containerId) ?? { profit: ZERO, revenue: ZERO };
      out.set(p.containerId, { profit: row.profit.add(p.amount), revenue: row.revenue.add(revenue[i].amount) });
    });
  }
  return out;
}

/** Share of graded kg that came out in the top grade (lowest rank), as a whole percentage; null when nothing was graded. */
export function topGradePercent(graded: { rank: number; kg: Prisma.Decimal.Value }[], topRank: number): number | null {
  const total = graded.reduce((s, g) => s.add(D(g.kg)), ZERO);
  if (total.isZero()) return null;
  const top = graded.filter((g) => g.rank === topRank).reduce((s, g) => s.add(D(g.kg)), ZERO);
  return top.div(total).mul(100).toDecimalPlaces(0).toNumber();
}

/** Whole-number percentage a / b (null when b is zero). */
export function percent(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): number | null {
  return D(b).isZero() ? null : D(a).div(D(b)).mul(100).toDecimalPlaces(0).toNumber();
}
