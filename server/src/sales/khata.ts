import { Decimal } from '@prisma/client/runtime/library';
import { DecimalLike, money, sum } from '../costing/costing';

/**
 * Khata (udhaar) rules, pure. The balance is never stored: it is always
 * opening balance + sales − payments. Sale statuses (PAID / PARTIALLY_PAID / ISSUED) come from
 * applying payments: a payment made with a sale pays that sale; payments on account (and anything
 * paid over a sale's total) pay the opening balance first, then the oldest unpaid sales.
 */

export type KhataSaleStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID';

export interface KhataSale<K> {
  key: K;
  at: Date;
  total: DecimalLike;
  /** Paid with this sale (payments recorded against it). */
  paidWithSale: DecimalLike;
}

export interface AppliedSale<K> {
  key: K;
  at: Date;
  total: Decimal;
  paid: Decimal;
  due: Decimal;
  status: KhataSaleStatus;
}

export interface Applied<K> {
  openingDue: Decimal;
  /** Sales in the order given (oldest first). */
  sales: AppliedSale<K>[];
  /** Paid in advance: more than everything owed. */
  advance: Decimal;
  /** What the customer owes now (negative = advance). */
  balance: Decimal;
}

const ZERO = new Decimal(0);

/** `sales` must be oldest first. */
export function applyPayments<K>(input: { openingBalance: DecimalLike; sales: KhataSale<K>[]; onAccount: DecimalLike }): Applied<K> {
  const opening = money(input.openingBalance);
  let pool = money(input.onAccount);
  if (opening.isNegative()) pool = pool.add(opening.neg());

  const direct = input.sales.map((s) => {
    const total = money(s.total);
    const paid = money(s.paidWithSale);
    if (paid.greaterThan(total)) pool = pool.add(paid.sub(total));
    return { key: s.key, at: s.at, total, paid: Decimal.min(paid, total) };
  });

  let openingDue = Decimal.max(opening, ZERO);
  const toOpening = Decimal.min(pool, openingDue);
  openingDue = openingDue.sub(toOpening);
  pool = pool.sub(toOpening);

  const sales = direct.map((s) => {
    const extra = Decimal.min(pool, s.total.sub(s.paid));
    pool = pool.sub(extra);
    const paid = s.paid.add(extra);
    const due = s.total.sub(paid);
    const status: KhataSaleStatus = due.isZero() ? 'PAID' : paid.greaterThan(ZERO) ? 'PARTIALLY_PAID' : 'ISSUED';
    return { key: s.key, at: s.at, total: s.total, paid, due, status };
  });

  const balance = openingDue.add(sum(sales.map((s) => s.due))).sub(pool);
  return { openingDue, sales, advance: pool, balance: money(balance) };
}

/** Days since the oldest money still owed (the opening balance counts from `openingSince`); 0 when nothing is owed. */
export function overdueDays<K>(applied: Applied<K>, openingSince: Date, now: Date): number {
  const since = applied.openingDue.greaterThan(ZERO) ? openingSince : applied.sales.find((s) => s.due.greaterThan(ZERO))?.at;
  if (!since) return 0;
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
}


/**
 * Which payment paid which sale (v2 review: a sale showed "Paid Rs 31,400" with no payments behind it). Same
 * rules as applyPayments — a payment made with a sale pays it; the rest (and anything paid over a sale's
 * total) pays the opening balance, then the oldest unpaid sales — with each rupee traced to its payment.
 * The amounts per sale always add up to applyPayments' `paid`.
 */
export function tracePayments<P extends { id: string; at: Date; amount: DecimalLike; saleId: string | null }>(input: {
  openingBalance: DecimalLike;
  /** Oldest first. */
  sales: Array<{ id: string; total: DecimalLike }>;
  /** Oldest first. */
  payments: P[];
}): Map<string, Array<{ payment: P; amount: Decimal; withSale: boolean }>> {
  const out = new Map<string, Array<{ payment: P; amount: Decimal; withSale: boolean }>>();
  const saleIds = new Set(input.sales.map((s) => s.id));
  const left = new Map(input.sales.map((s) => [s.id, money(s.total)]));
  const pool: Array<{ payment: P; amount: Decimal }> = [];
  for (const p of input.payments) {
    const amount = money(p.amount);
    if (p.saleId && saleIds.has(p.saleId)) {
      const take = Decimal.min(amount, left.get(p.saleId)!);
      if (take.greaterThan(ZERO)) {
        out.set(p.saleId, [...(out.get(p.saleId) ?? []), { payment: p, amount: take, withSale: true }]);
        left.set(p.saleId, left.get(p.saleId)!.sub(take));
      }
      if (amount.greaterThan(take)) pool.push({ payment: p, amount: amount.sub(take) });
    } else {
      pool.push({ payment: p, amount });
    }
  }
  // Payments on account first clear the opening balance (an advance in it pays nothing here: it has no payment).
  let openingDue = Decimal.max(money(input.openingBalance), ZERO);
  const opening = money(input.openingBalance);
  let advance = opening.isNegative() ? opening.neg() : ZERO;
  for (const s of input.sales) {
    // An advance from the opening balance pays first, without a payment to show.
    const a = Decimal.min(advance, left.get(s.id)!);
    if (a.greaterThan(ZERO)) {
      advance = advance.sub(a);
      left.set(s.id, left.get(s.id)!.sub(a));
    }
  }
  for (const entry of pool) {
    let rest = entry.amount;
    const toOpening = Decimal.min(rest, openingDue);
    openingDue = openingDue.sub(toOpening);
    rest = rest.sub(toOpening);
    for (const s of input.sales) {
      if (rest.isZero()) break;
      const due = left.get(s.id)!;
      if (due.isZero()) continue;
      const take = Decimal.min(rest, due);
      out.set(s.id, [...(out.get(s.id) ?? []), { payment: entry.payment, amount: take, withSale: false }]);
      left.set(s.id, due.sub(take));
      rest = rest.sub(take);
    }
  }
  return out;
}
