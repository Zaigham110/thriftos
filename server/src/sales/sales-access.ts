/**
 * Who may open sales, customers and the khata (audit H1/H2): people who sell, take payments or keep the books.
 * A Sorter or Buyer has none of these. Cost and profit inside a sale still need cost.view.
 */
export const SEE_SALES = ['sale.create', 'payment.create', 'finance.view'] as const;
/** Who may add or change a customer, a promise or a reminder: people who sell or take payments. */
export const WORK_CUSTOMERS = ['sale.create', 'payment.create'] as const;
/** A credit limit is a rule for the people who sell, so it is set by someone who keeps the books. */
export const SET_CREDIT_LIMIT = 'finance.view';

const SALE_MONEY = ['totalCost', 'totalProfit'] as const;
const LINE_MONEY = ['lineCost', 'profit'] as const;
const ITEM_MONEY = ['totalCost', 'unitCost', 'avgCost'] as const;

function without<T extends object>(row: T, keys: readonly string[]): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const k of keys) if (k in copy) copy[k] = null;
  return copy as T;
}

/** A sale (or a list of them) without what it cost and earned, for people without cost.view. */
export function hideSaleCost<T>(sale: T, canSeeCost: boolean): T {
  if (canSeeCost || !sale || typeof sale !== 'object') return sale;
  if (Array.isArray(sale)) return sale.map((s) => hideSaleCost(s, false)) as T;
  const s = without(sale as object, SALE_MONEY) as { lines?: unknown };
  if (Array.isArray(s.lines)) s.lines = s.lines.map((l) => (l && typeof l === 'object' ? without(l as object, LINE_MONEY) : l));
  return s as T;
}

/** A stock item without its cost, for people without cost.view (the bale scanned into a sale). */
export function hideItemCost<T>(item: T, canSeeCost: boolean): T {
  return canSeeCost || !item || typeof item !== 'object' ? item : (without(item as object, ITEM_MONEY) as T);
}
