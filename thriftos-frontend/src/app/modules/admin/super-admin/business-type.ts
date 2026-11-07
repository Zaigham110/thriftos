/** How a business works, in the console's words (v2 review): its type and the modules it can switch on. */
export const BUSINESS_TYPES: { stages: number; label: string; hint: string }[] = [
  { stages: 2, label: 'Sorts by category and grade', hint: 'Containers are sorted into categories, then grades (A, B, C…), then baled.' },
  { stages: 1, label: 'Sorts by category', hint: 'Containers are sorted into categories, then baled. No grades.' },
  { stages: 0, label: 'Trading only', hint: 'Buys ready bales and sells them. No Sorting tab.' },
];

export const typeLabel = (stages: number | null | undefined): string => BUSINESS_TYPES.find((t) => t.stages === (stages ?? 2))?.label ?? '—';

/** Always on: without them there is no ThriftOS. Sorting follows the business type. */
export const ALWAYS_ON = ['Receive containers', 'Stock and bales', 'Sales and bills'];

/** Modules the super admin can switch on or off for a business (the server accepts the same list). */
export const SWITCHABLE: { id: string; label: string; hint: string }[] = [
  { id: 'KHATA', label: 'Receivables (khata)', hint: 'Customers who buy on credit, their balances and payments.' },
  { id: 'REPORTS', label: 'Reports', hint: 'Detailed reports beyond the daily ones.' },
  { id: 'EXPORT', label: 'Export sales', hint: 'Sales to buyers abroad, in other currencies.' },
  { id: 'WAREHOUSES', label: 'More than one godown', hint: 'Stock kept in several places.' },
  { id: 'PURCHASE_ORDERS', label: 'Purchase orders', hint: 'Orders to suppliers before the container ships.' },
];
