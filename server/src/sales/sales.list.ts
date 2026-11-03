import { PaymentMode, Prisma, PrismaClient, SaleStatus, SaleType } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';

/** Column names for exports (screens use the dictionaries). */
export const SALE_LABELS: Record<string, { en: string; ur: string }> = {
  number: { en: 'Sale', ur: 'بکری' },
  date: { en: 'Date', ur: 'تاریخ' },
  customer: { en: 'Customer', ur: 'گاہک' },
  city: { en: 'City', ur: 'شہر' },
  status: { en: 'Status', ur: 'حالت' },
  paymentMode: { en: 'Payment', ur: 'ادائیگی' },
  type: { en: 'Type', ur: 'قسم' },
  total: { en: 'Total (Rs)', ur: 'کل (روپے)' },
  cost: { en: 'Cost (Rs)', ur: 'لاگت (روپے)' },
  profit: { en: 'Profit (Rs)', ur: 'منافع (روپے)' },
  createdBy: { en: 'Entered by', ur: 'درج کرنے والا' },
};

/** The workspace sales list (enterprise plan E2): one row per sale; cost and profit need cost.view. */
export const SALES_LIST: ListResource = {
  name: 'sales',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'number', type: 'string', path: ['saleNumber'], sortable: true, filterable: true, searchable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true, groupByMonth: true },
    { key: 'customer', type: 'string', path: ['customer', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'customerId', type: 'string', path: ['customerId'], filterable: true, groupable: true, hidden: true },
    { key: 'city', type: 'string', path: ['customer', 'city'], sortable: true, filterable: true, searchable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(SaleStatus), sortable: true, filterable: true, groupable: true },
    { key: 'paymentMode', type: 'enum', path: ['paymentMode'], enumValues: Object.values(PaymentMode), sortable: true, filterable: true, groupable: true },
    { key: 'type', type: 'enum', path: ['type'], enumValues: Object.values(SaleType), filterable: true, groupable: true },
    { key: 'total', type: 'number', path: ['totalAmount'], sortable: true, filterable: true, sum: true },
    { key: 'cost', type: 'number', path: ['totalCost'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'profit', type: 'number', path: ['totalProfit'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'createdBy', type: 'string', path: ['creator', 'name'], filterable: true },
  ],
  // Drafts no longer exist in v1; old ones are not sales.
  scope: (tenantId) => ({ tenantId, status: { not: SaleStatus.DRAFT } }),
  delegate: (prisma) => (prisma as PrismaClient).sale as never,
  select: {
    id: true,
    saleNumber: true,
    createdAt: true,
    customerId: true,
    status: true,
    paymentMode: true,
    type: true,
    totalAmount: true,
    totalCost: true,
    totalProfit: true,
    customer: { select: { name: true, city: true } },
    creator: { select: { name: true } },
  },
  toRow: (s) => {
    const r = s as Prisma.SaleGetPayload<{ include: { customer: { select: { name: true; city: true } }; creator: { select: { name: true } } } }>;
    return {
      id: r.id,
      number: r.saleNumber,
      date: r.createdAt,
      customer: r.customer.name,
      customerId: r.customerId,
      city: r.customer.city,
      status: r.status,
      paymentMode: r.paymentMode,
      type: r.type,
      total: r.totalAmount,
      cost: r.totalCost,
      profit: r.totalProfit,
      createdBy: r.creator.name,
    };
  },
  groupLabels: async (prisma, tenantId, field, keys) => {
    if (field !== 'customerId') return {};
    const customers = await (prisma as PrismaClient).customer.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } });
    return Object.fromEntries(customers.map((c) => [c.id, c.name]));
  },
};
