import { Decimal } from '@prisma/client/runtime/library';

/**
 * ThriftOS costing rules (docs/v1/03), as pure functions on Decimal.
 * Money is rounded half-up to the paisa (2 dp); per-kg rates to 4 dp.
 * Every split uses largest-remainder rounding so the parts add up to the whole exactly.
 */

export type DecimalLike = Decimal | string | number;

const ZERO = new Decimal(0);
const PAISA_PER_RUPEE = new Decimal(100);

export const dec = (value: DecimalLike): Decimal => (value instanceof Decimal ? value : new Decimal(value));

export const money = (value: DecimalLike): Decimal => dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sum = (values: DecimalLike[]): Decimal => values.reduce<Decimal>((acc, v) => acc.add(dec(v)), ZERO);

/** Cost per kg (4 dp); zero when there is no weight. */
export function costPerKg(cost: DecimalLike, kg: DecimalLike): Decimal {
  const weight = dec(kg);
  return weight.isZero() ? ZERO : dec(cost).div(weight).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export interface LandedCostInput {
  purchaseCost: DecimalLike;
  /** Currency of purchaseCost. PKR means fxRate is not applied. */
  purchaseCurrency: string;
  /** PKR per 1 unit of purchaseCurrency. */
  fxRate: DecimalLike;
  /** Charges (duty, clearing, freight, ...) in PKR. */
  charges: DecimalLike[];
}

/** Landed cost in PKR = purchase cost (converted if not PKR) + all charges. */
export function landedCost(input: LandedCostInput): Decimal {
  const purchase = dec(input.purchaseCost);
  if (purchase.isNegative()) throw new Error('Purchase cost cannot be negative');
  const purchasePkr =
    input.purchaseCurrency.toUpperCase() === 'PKR' ? money(purchase) : money(purchase.mul(dec(input.fxRate)));
  return money(purchasePkr.add(sum(input.charges)));
}

export interface WeightedPart<K> {
  key: K;
  weight: DecimalLike;
}

export interface Allocation<K> {
  key: K;
  amount: Decimal;
}

/**
 * Splits `total` across parts in proportion to their weight, rounded to the paisa with the
 * largest-remainder method: every part gets its floored share, and the paisa left over go one
 * each to the parts with the biggest fractional remainders (ties: heavier part, then input order).
 * The amounts always add up to `total` exactly. Zero-weight parts get zero.
 */
export function allocateByWeight<K>(total: DecimalLike, parts: WeightedPart<K>[]): Allocation<K>[] {
  const totalPaisa = money(total).mul(PAISA_PER_RUPEE);
  if (totalPaisa.isNegative()) throw new Error('Cannot allocate a negative amount');
  const weights = parts.map((p) => dec(p.weight));
  if (weights.some((w) => w.isNegative())) throw new Error('Weights cannot be negative');
  const totalWeight = sum(weights);

  if (totalWeight.isZero()) {
    if (totalPaisa.isZero()) return parts.map((p) => ({ key: p.key, amount: ZERO }));
    throw new Error('Cannot allocate cost when the total weight is zero');
  }

  const shares = weights.map((w, index) => {
    const exact = totalPaisa.mul(w).div(totalWeight);
    const floor = exact.floor();
    return { index, weight: w, floor, remainder: exact.sub(floor) };
  });
  let left = totalPaisa.sub(sum(shares.map((s) => s.floor))).toNumber();
  const order = [...shares].sort(
    (a, b) => b.remainder.comparedTo(a.remainder) || b.weight.comparedTo(a.weight) || a.index - b.index,
  );
  const extra = new Array<number>(parts.length).fill(0);
  // Fewer paisa are left than parts with a remainder, and zero-weight parts (remainder 0) sort
  // last, so they never receive one.
  for (const share of order) {
    if (left <= 0) break;
    extra[share.index] += 1;
    left -= 1;
  }

  return parts.map((p, i) => ({ key: p.key, amount: shares[i].floor.add(extra[i]).div(PAISA_PER_RUPEE) }));
}

/** Lots in a container share its landed cost by lot weight (never by container net weight). */
export function lotCosts<K>(landed: DecimalLike, lots: { key: K; weightKg: DecimalLike }[]): Allocation<K>[] {
  return allocateByWeight(landed, lots.map((l) => ({ key: l.key, weight: l.weightKg })));
}

/**
 * Sorting outputs share the input's cost by output kg. Waste is not an output and carries no
 * cost (its resale, if any, is income). Used for stage 1 (lot → categories) and stage 2
 * (category output → grades).
 */
export function outputCosts<K>(inputCost: DecimalLike, outputs: { key: K; kg: DecimalLike }[]): Allocation<K>[] {
  return allocateByWeight(inputCost, outputs.map((o) => ({ key: o.key, weight: o.kg })));
}

/**
 * Cost of taking `takeKg` from a sorted output that has already given `usedKg`.
 * Uses the cumulative share (cost of everything taken so far minus cost taken before), so when an
 * output is fully used the takes add up to its cost exactly, whatever the order of takes.
 */
export function takeCost(source: { cost: DecimalLike; kg: DecimalLike }, usedKg: DecimalLike, takeKg: DecimalLike): Decimal {
  const sourceKg = dec(source.kg);
  const before = dec(usedKg);
  const after = before.add(dec(takeKg));
  if (dec(takeKg).lessThanOrEqualTo(ZERO)) throw new Error('Take must be more than zero');
  if (after.greaterThan(sourceKg)) throw new Error('Cannot take more than the output weighs');
  const costAt = (kg: Decimal) => (kg.equals(sourceKg) ? money(source.cost) : money(dec(source.cost).mul(kg).div(sourceKg)));
  return costAt(after).sub(costAt(before));
}

export interface FifoSource<K> {
  key: K;
  /** kg still available in this source. */
  availableKg: DecimalLike;
}

/** Takes `wantKg` from sources in the given (oldest-first) order. Throws if there is not enough. */
export function fifoTake<K>(sources: FifoSource<K>[], wantKg: DecimalLike): { key: K; kg: Decimal }[] {
  const want = dec(wantKg);
  if (want.lessThanOrEqualTo(ZERO)) throw new Error('Weight must be more than zero');
  const takes: { key: K; kg: Decimal }[] = [];
  let left = want;
  for (const source of sources) {
    if (left.isZero()) break;
    const available = dec(source.availableKg);
    if (available.lessThanOrEqualTo(ZERO)) continue;
    const kg = Decimal.min(available, left);
    takes.push({ key: source.key, kg });
    left = left.sub(kg);
  }
  if (left.greaterThan(ZERO)) {
    throw new InsufficientStockError(want.sub(left));
  }
  return takes;
}

export class InsufficientStockError extends Error {
  constructor(readonly availableKg: Decimal) {
    super(`Not enough sorted stock: ${availableKg.toFixed(2)} kg available`);
  }
}

/** Bale cost = sum of the cost of each take. */
export function baleCost(takeCosts: DecimalLike[]): Decimal {
  return money(sum(takeCosts));
}

/** Profit on a sale line = price − cost. */
export function saleProfit(lineTotal: DecimalLike, lineCost: DecimalLike): Decimal {
  return money(dec(lineTotal).sub(dec(lineCost)));
}
