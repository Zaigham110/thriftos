/**
 * How a business works, as the super admin sets it (v2 review). The business type decides sorting: a trading-only
 * business has no Sorting tab, any other has it. Receive, Stock and Sell are always on (without them there is no
 * ThriftOS). The rest can be switched on or off. BILLING belongs to the platform account, not to a business.
 */
export const ALWAYS_ON = ['RECEIVE', 'STOCK', 'SELL'] as const;
export const BUSINESS_MODULES = ['KHATA', 'REPORTS', 'EXPORT', 'WAREHOUSES', 'PURCHASE_ORDERS'] as const;
export type BusinessModule = (typeof BUSINESS_MODULES)[number];

/** The full module list for a business type and the switchable modules chosen; modules not handled here are kept. */
export function workingModules(sortingStages: number, chosen: readonly string[], current: readonly string[]): string[] {
  const handled = new Set<string>([...ALWAYS_ON, 'SORT', ...BUSINESS_MODULES]);
  const kept = current.filter((m) => !handled.has(m) && m !== 'BILLING');
  const switchable = BUSINESS_MODULES.filter((m) => chosen.includes(m));
  return [...ALWAYS_ON, ...(sortingStages > 0 ? ['SORT'] : []), ...switchable, ...kept];
}
