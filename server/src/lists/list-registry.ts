import type { ListResource } from '../common/list/list-engine';
import { SALE_LABELS, SALES_LIST } from '../sales/sales.list';
import { LOT_LABELS, LOTS_LIST } from '../sorting/sorting.lists';
import { EXPENSE_LABELS, EXPENSES_LIST } from '../workspace/finance.lists';
import { ADJUSTMENT_LABELS, ADJUSTMENTS_LIST, STOCK_LABELS, STOCK_LIST } from '../stock/stock.lists';
import { CONTAINER_LABELS, CONTAINERS_LIST, PURCHASE_LOT_LABELS, PURCHASE_LOTS_LIST, SUPPLIER_LABELS, SUPPLIERS_LIST } from '../procurement/procurement.lists';

export interface RegisteredList {
  resource: ListResource;
  /** Column names for exports, per language. */
  labels: Record<string, { en: string; ur: string; roman?: string }>;
  /** Permission needed to open the list at all (none = any signed-in user of the business). */
  permission?: string;
  /** Module the business must have on (informational for now; the screens hide lists of modules that are off). */
  module?: string;
}

/** Every workspace list, by URL name (/api/lists/:name). E3 adds containers, stock, customers… */
export const LISTS: Record<string, RegisteredList> = {
  sales: { resource: SALES_LIST, labels: SALE_LABELS },
  containers: { resource: CONTAINERS_LIST, labels: CONTAINER_LABELS, permission: 'container.read', module: 'RECEIVE' },
  'purchase-lots': { resource: PURCHASE_LOTS_LIST, labels: PURCHASE_LOT_LABELS, permission: 'rag.read', module: 'RECEIVE' },
  suppliers: { resource: SUPPLIERS_LIST, labels: SUPPLIER_LABELS, permission: 'vendor.read', module: 'RECEIVE' },
  expenses: { resource: EXPENSES_LIST, labels: EXPENSE_LABELS, permission: 'finance.view' },
  lots: { resource: LOTS_LIST, labels: LOT_LABELS, permission: 'SORTING_STAGE1_VIEW', module: 'SORT' },
  stock: { resource: STOCK_LIST, labels: STOCK_LABELS, permission: 'INVENTORY_VIEW', module: 'STOCK' },
  'stock-counts': { resource: ADJUSTMENTS_LIST, labels: ADJUSTMENT_LABELS, permission: 'INVENTORY_VIEW', module: 'STOCK' },
};
