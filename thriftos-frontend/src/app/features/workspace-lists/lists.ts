import type { ListConfig } from './list-config';

/** Workspace list screens (enterprise plan E2/E3): each is a configuration of the one list page. */

export const SALES_LIST: ListConfig = {
  resource: 'sales',
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
  ],
  quickFilters: [
    { field: 'status', label: 'ws.col.status', values: ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], prefix: 'ws.status.' },
    { field: 'paymentMode', label: 'ws.col.paymentMode', values: ['CASH', 'CREDIT', 'PARTIAL'], prefix: 'ws.mode.' },
  ],
  rowLink: (id) => ['/sell/records', id],
  create: { label: 'ws.new.sale', link: '/sell/new' },
};

const CONTAINER_STATUSES = ['IN_TRANSIT', 'ARRIVED', 'CLEARED', 'CLOSED'] as const;

export const CONTAINERS_LIST: ListConfig = {
  resource: 'containers',
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
    { key: 'landedCost', label: 'ws.containers.col.landedCost', format: 'money', total: true },
    { key: 'costPerKg', label: 'ws.containers.col.costPerKg', format: 'money' },
    { key: 'revenue', label: 'ws.containers.col.revenue', format: 'money', computed: true },
    { key: 'profit', label: 'ws.containers.col.profit', format: 'money', computed: true },
    { key: 'yield', label: 'ws.containers.col.yield', format: 'percent', computed: true },
    { key: 'topGrade', label: 'ws.containers.col.topGrade', format: 'percent', computed: true },
  ],
  defaultColumns: ['number', 'date', 'supplier', 'status', 'kg', 'landedCost', 'profit', 'yield', 'topGrade'],
  dateField: 'date',
  groupBy: [
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.cstatus.' },
    { key: 'supplierId', label: 'ws.containers.col.supplier' },
    { key: 'origin', label: 'ws.containers.col.origin' },
  ],
  quickFilters: [{ field: 'status', label: 'ws.col.status', values: CONTAINER_STATUSES, prefix: 'ws.cstatus.' }],
  rowLink: (id) => ['/receive/records/containers', id],
  create: { label: 'ws.new.container', link: '/receive/container' },
  board: {
    field: 'status',
    values: CONTAINER_STATUSES,
    prefix: 'ws.cstatus.',
    title: 'number',
    lines: ['supplier', 'kg', 'profit'],
    move: (id, value) => ({ url: `/api/procurement/containers/${id}/status`, body: { status: value } }),
  },
};

export const SUPPLIERS_LIST: ListConfig = {
  resource: 'suppliers',
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
