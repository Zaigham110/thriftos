import type { ListResource } from '../common/list/list-engine';
import { SALE_LABELS, SALES_LIST } from '../sales/sales.list';
import { ADJUSTMENT_LABELS, ADJUSTMENTS_LIST, STOCK_LABELS, STOCK_LIST } from '../stock/stock.lists';
import { CONTAINER_LABELS, CONTAINERS_LIST, SUPPLIER_LABELS, SUPPLIERS_LIST } from '../procurement/procurement.lists';

export interface RegisteredList {
  resource: ListResource;
  /** Column names for exports, per language. */
  labels: Record<string, { en: string; ur: string }>;
  /** Permission needed to open the list at all (none = any signed-in user of the business). */
  permission?: string;
  /** Module the business must have on (informational for now; the screens hide lists of modules that are off). */
  module?: string;
}

/** Every workspace list, by URL name (/api/lists/:name). E3 adds containers, stock, customers… */
export const LISTS: Record<string, RegisteredList> = {
  sales: { resource: SALES_LIST, labels: SALE_LABELS },
  containers: { resource: CONTAINERS_LIST, labels: CONTAINER_LABELS, permission: 'container.read', module: 'RECEIVE' },
  suppliers: { resource: SUPPLIERS_LIST, labels: SUPPLIER_LABELS, permission: 'vendor.read', module: 'RECEIVE' },
  stock: { resource: STOCK_LIST, labels: STOCK_LABELS, permission: 'INVENTORY_VIEW', module: 'STOCK' },
  'stock-counts': { resource: ADJUSTMENTS_LIST, labels: ADJUSTMENT_LABELS, permission: 'INVENTORY_VIEW', module: 'STOCK' },
};
