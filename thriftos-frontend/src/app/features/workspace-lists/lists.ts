import type { ListConfig } from './list-config';

/** Workspace list screens (enterprise plan E2/E3): each is a configuration of the one list page. */

export const SALES_LIST: ListConfig = {
  resource: 'sales',
  help: 'sale',
  title: 'ws.sales.title',
  count: 'ws.sales.count',
  searchPlaceholder: 'ws.sales.search',
  emptyHeading: 'ws.sales.emptyHeading',
  emptyMessage: 'ws.sales.emptyMessage',
  columns: [
    { key: 'number', label: 'ws.col.number', width: '130px' },
    { key: 'date', label: 'ws.col.date', format: 'date' },
    { key: 'customer', label: 'ws.col.customer' },
    { key: 'city', label: 'ws.col.city' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.status.' },
    { key: 'paymentMode', label: 'ws.col.paymentMode', enumPrefix: 'ws.mode.' },
    { key: 'total', label: 'ws.col.total', format: 'money', total: true },
    { key: 'cost', label: 'ws.col.cost', format: 'money', total: true },
    { key: 'profit', label: 'ws.col.profit', format: 'money', total: true },
    { key: 'createdBy', label: 'ws.col.createdBy', computed: true },
  ],
  defaultColumns: ['number', 'date', 'customer', 'city', 'status', 'paymentMode', 'total', 'profit'],
  dateField: 'date',
  groupBy: [
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.status.' },
    { key: 'paymentMode', label: 'ws.col.paymentMode', enumPrefix: 'ws.mode.' },
    { key: 'customerId', label: 'ws.col.customer' },
    { key: 'date', label: 'ws.group.month', month: true },
  ],
  quickFilters: [
    { field: 'status', label: 'ws.col.status', values: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], prefix: 'ws.status.' },
    { field: 'paymentMode', label: 'ws.col.paymentMode', values: ['CASH', 'CREDIT', 'PARTIAL'], prefix: 'ws.mode.' },
  ],
  rowLink: (id) => ['/sell/records', id],
  create: { label: 'ws.new.sale', link: '/sell/records/new' },
};

const CONTAINER_STATUSES = ['IN_TRANSIT', 'ARRIVED', 'CLEARED', 'CLOSED'] as const;

/** Purchasing (v2 review): what was bought, containers and gaari / loose lots, as two tabs of one screen. */
export const PURCHASING_TABS = [
  { label: 'ws.purchasing.containers', link: '/receive/records/containers' },
  { label: 'ws.purchasing.lots', link: '/receive/records/lots' },
];

export const CONTAINERS_LIST: ListConfig = {
  resource: 'containers',
  help: 'container',
  title: 'ws.containers.title',
  count: 'ws.containers.count',
  searchPlaceholder: 'ws.containers.search',
  emptyHeading: 'ws.containers.emptyHeading',
  emptyMessage: 'ws.containers.emptyMessage',
  columns: [
    { key: 'number', label: 'ws.containers.col.number', width: '140px' },
    { key: 'date', label: 'ws.containers.col.date', format: 'date' },
    { key: 'arrivedAt', label: 'ws.containers.col.arrivedAt', format: 'date' },
    { key: 'supplier', label: 'ws.containers.col.supplier' },
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.cstatus.' },
    { key: 'kg', label: 'ws.containers.col.kg', format: 'kg', total: true },
    { key: 'landedCost', label: 'ws.containers.col.landedCost', format: 'money', total: true, info: 'ws.containers.info.landedCost' },
    { key: 'costPerKg', label: 'ws.containers.col.costPerKg', format: 'money', exact: true, info: 'ws.containers.info.costPerKg' },
    { key: 'revenue', label: 'ws.containers.col.revenue', format: 'money', computed: true, info: 'ws.containers.info.revenue' },
    { key: 'profit', label: 'ws.containers.col.profit', format: 'money', computed: true, info: 'ws.containers.info.profit' },
    { key: 'yield', label: 'ws.containers.col.yield', format: 'percent', computed: true, info: 'ws.containers.info.yield' },
    { key: 'topGrade', label: 'ws.containers.col.topGrade', format: 'percent', computed: true, info: 'ws.containers.info.topGrade' },
  ],
  defaultColumns: ['number', 'date', 'supplier', 'status', 'kg', 'landedCost', 'profit', 'yield', 'topGrade'],
  dateField: 'date',
  groupBy: [
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.cstatus.' },
    { key: 'supplierId', label: 'ws.containers.col.supplier' },
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'date', label: 'ws.group.month', month: true },
  ],
  quickFilters: [{ field: 'status', label: 'ws.col.status', values: CONTAINER_STATUSES, prefix: 'ws.cstatus.' }],
  rowLink: (id) => ['/receive/records/containers', id],
  create: { label: 'ws.new.container', link: '/receive/records/containers/new' },
  tabs: PURCHASING_TABS,
  board: {
    field: 'status',
    values: CONTAINER_STATUSES,
    prefix: 'ws.cstatus.',
    title: 'number',
    lines: ['supplier', 'kg', 'profit'],
    move: (id, value) => ({ url: `/api/procurement/containers/${id}/status`, body: { status: value } }),
  },
};

const LOT_STATUSES_BOUGHT = ['NOT_STARTED', 'IN_SORTING', 'SORTED'] as const;

/** Gaari and loose lots bought without a container: what was paid, price per kg, how far sorting has got. */
export const PURCHASE_LOTS_LIST: ListConfig = {
  resource: 'purchase-lots',
  help: 'sorting',
  title: 'ws.purchaseLots.title',
  count: 'ws.purchaseLots.count',
  searchPlaceholder: 'ws.purchaseLots.search',
  emptyHeading: 'ws.purchaseLots.emptyHeading',
  emptyMessage: 'ws.purchaseLots.emptyMessage',
  columns: [
    { key: 'code', label: 'ws.container.lot', width: '140px' },
    { key: 'date', label: 'ws.purchaseLots.col.date', format: 'date' },
    { key: 'supplier', label: 'ws.containers.col.supplier' },
    { key: 'rawCategory', label: 'ws.purchaseLots.col.maal' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.lotStatus.' },
    { key: 'kg', label: 'ws.containers.col.kg', format: 'kg', total: true },
    { key: 'cost', label: 'ws.purchaseLots.col.cost', format: 'money', total: true, info: 'ws.purchaseLots.info.cost' },
    { key: 'costPerKg', label: 'ws.purchaseLots.col.costPerKg', format: 'money', exact: true, computed: true, info: 'ws.purchaseLots.info.costPerKg' },
    { key: 'sortedPercent', label: 'ws.purchaseLots.col.sorted', format: 'percent', computed: true, info: 'ws.purchaseLots.info.sorted' },
  ],
  defaultColumns: ['code', 'date', 'supplier', 'rawCategory', 'status', 'kg', 'cost', 'costPerKg', 'sortedPercent'],
  dateField: 'date',
  groupBy: [
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.lotStatus.' },
    { key: 'supplierId', label: 'ws.containers.col.supplier' },
    { key: 'rawCategoryId', label: 'ws.purchaseLots.col.maal' },
    { key: 'date', label: 'ws.group.month', month: true },
  ],
  quickFilters: [{ field: 'status', label: 'ws.col.status', values: LOT_STATUSES_BOUGHT, prefix: 'ws.lotStatus.' }],
  rowLink: (id) => ['/sort/records', id],
  create: { label: 'ws.new.gaari', link: '/receive/records/lots/new' },
  tabs: PURCHASING_TABS,
};

export const SUPPLIERS_LIST: ListConfig = {
  resource: 'suppliers',
  help: 'supplier',
  title: 'ws.suppliers.title',
  count: 'ws.suppliers.count',
  searchPlaceholder: 'ws.suppliers.search',
  emptyHeading: 'ws.suppliers.emptyHeading',
  emptyMessage: 'ws.suppliers.emptyMessage',
  columns: [
    { key: 'name', label: 'ws.suppliers.col.name' },
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'phone', label: 'ws.suppliers.col.phone' },
    { key: 'type', label: 'ws.col.type', enumPrefix: 'ws.vtype.' },
    { key: 'containers', label: 'ws.suppliers.col.containers', format: 'number', computed: true },
    { key: 'kg', label: 'ws.suppliers.col.kg', format: 'kg', computed: true },
    { key: 'profit', label: 'ws.containers.col.profit', format: 'money', computed: true },
    { key: 'profitPerKg', label: 'ws.suppliers.col.profitPerKg', format: 'money', computed: true },
    { key: 'yield', label: 'ws.containers.col.yield', format: 'percent', computed: true },
    { key: 'topGrade', label: 'ws.containers.col.topGrade', format: 'percent', computed: true },
  ],
  defaultColumns: ['name', 'origin', 'containers', 'kg', 'profit', 'profitPerKg', 'yield', 'topGrade'],
  groupBy: [
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'type', label: 'ws.col.type', enumPrefix: 'ws.vtype.' },
  ],
  quickFilters: [],
  rowLink: (id) => ['/receive/records/suppliers', id],
};

export const STOCK_LIST: ListConfig = {
  resource: 'stock',
  help: 'stock',
  title: 'ws.stock.title',
  count: 'ws.stock.count',
  searchPlaceholder: 'ws.stock.search',
  emptyHeading: 'ws.stock.emptyHeading',
  emptyMessage: 'ws.stock.emptyMessage',
  columns: [
    { key: 'code', label: 'ws.stock.col.code', width: '120px' },
    { key: 'name', label: 'ws.stock.col.name' },
    { key: 'category', label: 'ws.container.category' },
    { key: 'grade', label: 'ws.container.grade' },
    { key: 'source', label: 'ws.stock.col.source', enumPrefix: 'ws.stock.source.' },
    { key: 'unit', label: 'ws.stock.col.unit', enumPrefix: 'ws.stock.unit.' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.stock.status.' },
    { key: 'quantity', label: 'ws.stock.col.quantity', format: 'number' },
    { key: 'left', label: 'ws.stock.col.left', format: 'number', computed: true },
    { key: 'kg', label: 'ws.containers.col.kg', format: 'kg', total: true },
    { key: 'cost', label: 'ws.col.cost', format: 'money', total: true },
    { key: 'value', label: 'ws.stock.col.value', format: 'money', computed: true },
    { key: 'salePrice', label: 'ws.stock.col.price', format: 'money' },
    { key: 'date', label: 'ws.containers.col.date', format: 'date' },
    { key: 'age', label: 'ws.stock.col.age', format: 'number', computed: true },
    { key: 'godown', label: 'ws.stock.col.godown' },
    { key: 'supplier', label: 'ws.containers.col.supplier' },
  ],
  defaultColumns: ['code', 'name', 'category', 'grade', 'status', 'left', 'kg', 'value', 'salePrice', 'age', 'godown'],
  dateField: 'date',
  defaultFilters: [{ field: 'status', op: 'ne', value: 'SOLD' }],
  groupBy: [
    { key: 'categoryId', label: 'ws.container.category' },
    { key: 'gradeId', label: 'ws.container.grade' },
    { key: 'godownId', label: 'ws.stock.col.godown' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.stock.status.' },
    { key: 'source', label: 'ws.stock.col.source', enumPrefix: 'ws.stock.source.' },
  ],
  quickFilters: [
    { field: 'status', label: 'ws.col.status', values: ['AVAILABLE', 'RESERVED', 'SOLD'], prefix: 'ws.stock.status.' },
    { field: 'source', label: 'ws.stock.col.source', values: ['PROCESSED', 'PURCHASED', 'KAT'], prefix: 'ws.stock.source.' },
    { field: 'unit', label: 'ws.stock.col.unit', values: ['BALE', 'KG', 'PIECE'], prefix: 'ws.stock.unit.' },
  ],
  rowLink: (id) => ['/stock/items', id],
  create: { label: 'ws.new.bale', link: '/stock/bale' },
};

export const STOCK_COUNTS_LIST: ListConfig = {
  resource: 'stock-counts',
  title: 'ws.counts.title',
  count: 'ws.counts.count',
  searchPlaceholder: 'ws.counts.search',
  emptyHeading: 'ws.counts.emptyHeading',
  emptyMessage: 'ws.counts.emptyMessage',
  columns: [
    { key: 'date', label: 'ws.counts.col.date', format: 'date' },
    { key: 'item', label: 'ws.stock.col.name' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.counts.status.' },
    { key: 'book', label: 'ws.counts.col.book', format: 'number' },
    { key: 'counted', label: 'ws.counts.col.counted', format: 'number' },
    { key: 'difference', label: 'ws.counts.col.difference', format: 'number', computed: true },
    { key: 'reason', label: 'ws.counts.col.reason' },
    { key: 'costChange', label: 'ws.counts.col.costChange', format: 'money', total: true },
  ],
  defaultColumns: ['date', 'item', 'status', 'book', 'counted', 'difference', 'reason', 'costChange'],
  dateField: 'date',
  groupBy: [{ key: 'status', label: 'ws.col.status', enumPrefix: 'ws.counts.status.' }],
  quickFilters: [{ field: 'status', label: 'ws.col.status', values: ['PENDING', 'APPROVED', 'REJECTED'], prefix: 'ws.counts.status.' }],
  rowLink: (id, row) => ['/stock/items', row?.['itemId'] ?? id],
};

const LOT_STATUSES = ['NOT_STARTED', 'IN_SORTING', 'SORTED'] as const;

/** Lots to sort, being sorted and sorted (E3.2); the board shows where each lot is (sorting moves it). */
export const LOTS_LIST: ListConfig = {
  resource: 'lots',
  help: 'sorting',
  title: 'ws.lots.title',
  count: 'ws.lots.count',
  searchPlaceholder: 'ws.lots.search',
  emptyHeading: 'ws.lots.emptyHeading',
  emptyMessage: 'ws.lots.emptyMessage',
  columns: [
    { key: 'code', label: 'ws.container.lot', width: '130px' },
    { key: 'date', label: 'ws.containers.col.date', format: 'date' },
    { key: 'container', label: 'ws.containers.col.number' },
    { key: 'supplier', label: 'ws.containers.col.supplier', computed: true },
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'rawCategory', label: 'ws.lots.col.raw' },
    { key: 'source', label: 'ws.stock.col.source', enumPrefix: 'ws.lots.source.' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.lotStatus.' },
    { key: 'kg', label: 'ws.containers.col.kg', format: 'kg', total: true },
    { key: 'cost', label: 'ws.col.cost', format: 'money', total: true },
    { key: 'sortedKg', label: 'ws.lots.col.sorted', format: 'kg', computed: true },
    { key: 'wasteKg', label: 'ws.lots.col.waste', format: 'kg', computed: true },
    { key: 'yield', label: 'ws.containers.col.yield', format: 'percent', computed: true },
    { key: 'worker', label: 'ws.lots.col.worker', computed: true },
    { key: 'sortedAt', label: 'ws.lots.col.sortedAt', format: 'date', computed: true },
  ],
  defaultColumns: ['code', 'date', 'container', 'supplier', 'status', 'kg', 'sortedKg', 'wasteKg', 'yield', 'worker'],
  dateField: 'date',
  groupBy: [
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.lotStatus.' },
    { key: 'containerId', label: 'ws.containers.col.number' },
    { key: 'origin', label: 'ws.containers.col.origin' },
    { key: 'rawCategoryId', label: 'ws.lots.col.raw' },
  ],
  quickFilters: [{ field: 'status', label: 'ws.col.status', values: LOT_STATUSES, prefix: 'ws.lotStatus.' }],
  rowLink: (id) => ['/sort/records', id],
  create: { label: 'ws.new.lot', link: '/receive/records/lots/new' },
  board: { field: 'status', values: LOT_STATUSES, prefix: 'ws.lotStatus.', title: 'code', lines: ['container', 'kg', 'yield'] },
};

export const EXPENSE_CATEGORIES = ['RENT', 'LABOUR', 'TRANSPORT', 'ELECTRICITY', 'OTHER'] as const;
export const PAYMENT_METHODS = ['CASH', 'JAZZCASH', 'EASYPAISA', 'RAAST', 'BANK', 'OTHER'] as const;

/** Expenses (E3.6); a fresh list hides cancelled ones. */
export const EXPENSES_LIST: ListConfig = {
  resource: 'expenses',
  title: 'ws.expenses.title',
  count: 'ws.expenses.count',
  searchPlaceholder: 'ws.expenses.search',
  emptyHeading: 'ws.expenses.emptyHeading',
  emptyMessage: 'ws.expenses.emptyMessage',
  columns: [
    { key: 'date', label: 'ws.col.date', format: 'date' },
    { key: 'category', label: 'ws.container.category', enumPrefix: 'ws.expenseCategory.' },
    { key: 'paidTo', label: 'ws.expenses.col.paidTo' },
    { key: 'method', label: 'ws.sale.method', enumPrefix: 'method.' },
    { key: 'amount', label: 'ws.sale.amount', format: 'money', total: true },
    { key: 'note', label: 'ws.customer.note' },
    { key: 'cancelled', label: 'ws.expenses.col.cancelled', format: 'date' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.expenses.status.', computed: true },
  ],
  defaultColumns: ['date', 'category', 'paidTo', 'method', 'amount', 'note'],
  dateField: 'date',
  defaultFilters: [{ field: 'cancelled', op: 'isnull' }],
  groupBy: [
    { key: 'category', label: 'ws.container.category', enumPrefix: 'ws.expenseCategory.' },
    { key: 'method', label: 'ws.sale.method', enumPrefix: 'method.' },
    { key: 'paidTo', label: 'ws.expenses.col.paidTo' },
    { key: 'date', label: 'ws.group.month', month: true },
  ],
  quickFilters: [
    { field: 'category', label: 'ws.container.category', values: EXPENSE_CATEGORIES, prefix: 'ws.expenseCategory.' },
    { field: 'method', label: 'ws.sale.method', values: PAYMENT_METHODS, prefix: 'method.' },
  ],
  rowLink: (id) => ['/finance/expenses', id],
  create: { label: 'ws.expenses.new', link: '/finance/expenses/new' },
};
