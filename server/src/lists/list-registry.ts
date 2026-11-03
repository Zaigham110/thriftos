import type { ListResource } from '../common/list/list-engine';
import { SALE_LABELS, SALES_LIST } from '../sales/sales.list';

export interface RegisteredList {
  resource: ListResource;
  /** Column names for exports, per language. */
  labels: Record<string, { en: string; ur: string }>;
  /** Permission needed to open the list at all (none = any signed-in user of the business). */
  permission?: string;
}

/** Every workspace list, by URL name (/api/lists/:name). E3 adds containers, stock, customers… */
export const LISTS: Record<string, RegisteredList> = {
  sales: { resource: SALES_LIST, labels: SALE_LABELS },
};
