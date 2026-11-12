import { Prisma, WorkerPayType } from '@prisma/client';

/**
 * Phase 8 pay rules, as plain functions: what a worker earns for a period, and how a paid amount is shared over the
 * lots they sorted (to the paisa, the shares add up exactly).
 */

const DAY = 86_400_000;

/** Days in a period, both ends counted ("2026-11-01".."2026-11-07" = 7). */
export function periodDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
}

/** A whole calendar month (the 1st to its last day). */
export function wholeMonth(start: string, end: string): boolean {
  const s = new Date(`${start}T00:00:00Z`);
  const last = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return s.getUTCDate() === 1 && end === last;
}

/**
 * Gross pay: kg × rate, pieces × rate, days × rate, or the monthly salary (for a whole month; for another period
 * its share: salary × days / 30).
 */
export function grossPay(t: WorkerPayType, rate: Prisma.Decimal, w: { kg: Prisma.Decimal; pieces: number; days: number }, start: string, end: string): Prisma.Decimal {
  switch (t) {
    case WorkerPayType.KG: return rate.mul(w.kg).toDecimalPlaces(2);
    case WorkerPayType.PIECE: return rate.mul(w.pieces).toDecimalPlaces(2);
    case WorkerPayType.DAY: return rate.mul(w.days).toDecimalPlaces(2);
    case WorkerPayType.MONTH: return wholeMonth(start, end) ? rate : rate.mul(periodDays(start, end)).div(30).toDecimalPlaces(2);
  }
}

/** Net pay: gross less advances and deductions, never below zero. */
export function netPay(gross: Prisma.Decimal, advances: Prisma.Decimal, deductions: Prisma.Decimal): Prisma.Decimal {
  const n = gross.sub(advances).sub(deductions);
  return n.isNegative() ? new Prisma.Decimal(0) : n;
}

/** Shares `total` by weight; the paisa left by rounding go to the largest weights, so the shares add up to `total`. */
export function shareBy<K>(total: Prisma.Decimal, parts: { key: K; weight: Prisma.Decimal }[]): { key: K; amount: Prisma.Decimal }[] {
  const sum = parts.reduce((t, p) => t.add(p.weight), new Prisma.Decimal(0));
  if (sum.isZero() || total.isZero()) return [];
  const exact = parts.map((p) => ({ key: p.key, raw: total.mul(p.weight).div(sum) }));
  const out = exact.map((e) => ({ key: e.key, amount: e.raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN), rest: e.raw.sub(e.raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)) }));
  let left = total.sub(out.reduce((t, o) => t.add(o.amount), new Prisma.Decimal(0))).mul(100).toNumber();
  for (const o of [...out].sort((a, b) => b.rest.comparedTo(a.rest))) {
    if (left < 0.5) break;
    o.amount = o.amount.add(new Prisma.Decimal('0.01'));
    left -= 1;
  }
  return out.filter((o) => !o.amount.isZero()).map(({ key, amount }) => ({ key, amount }));
}
