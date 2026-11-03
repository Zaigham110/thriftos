import { ExpenseCategory, PaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';

export const EXPENSE_LABELS: Record<string, { en: string; ur: string }> = {
  date: { en: 'Day', ur: 'دن' },
  category: { en: 'Category', ur: 'قسم' },
  paidTo: { en: 'Paid to', ur: 'کس کو' },
  method: { en: 'Paid by', ur: 'ادائیگی کا طریقہ' },
  amount: { en: 'Amount (Rs)', ur: 'رقم (روپے)' },
  note: { en: 'Note', ur: 'نوٹ' },
  status: { en: 'Status', ur: 'حالت' },
};

/** Expenses (enterprise plan E3.6); cancelled ones are hidden unless asked for (status filter). */
export const EXPENSES_LIST: ListResource = {
  name: 'expenses',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'date', type: 'date', path: ['day'], sortable: true, filterable: true },
    { key: 'category', type: 'enum', path: ['category'], enumValues: Object.values(ExpenseCategory), sortable: true, filterable: true, groupable: true },
    { key: 'paidTo', type: 'string', path: ['paidTo'], sortable: true, filterable: true, searchable: true, groupable: true },
    { key: 'method', type: 'enum', path: ['method'], enumValues: Object.values(PaymentMethod), sortable: true, filterable: true, groupable: true },
    { key: 'amount', type: 'number', path: ['amount'], sortable: true, filterable: true, sum: true },
    { key: 'note', type: 'string', path: ['note'], searchable: true },
    { key: 'cancelled', type: 'date', path: ['cancelledAt'], filterable: true, hidden: true },
    { key: 'status', type: 'string', path: ['_computed'], computed: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).expense as never,
  select: { id: true, day: true, category: true, paidTo: true, method: true, amount: true, note: true, cancelledAt: true },
  toRow: (x) => {
    const e = x as unknown as Prisma.ExpenseGetPayload<object>;
    return { id: e.id, date: e.day, category: e.category, paidTo: e.paidTo, method: e.method, amount: e.amount, note: e.note, cancelled: e.cancelledAt, status: e.cancelledAt ? 'CANCELLED' : 'RECORDED' };
  },
};
