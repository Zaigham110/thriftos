import { Prisma, PrismaClient } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';
import { applyFor, KHATA_SALE_STATUSES } from './khata.service';

/** Column names for exports (screens use the dictionaries). */
export const CUSTOMER_LABELS: Record<string, { en: string; ur: string; roman?: string }> = {
  name: { en: 'Customer', ur: 'گاہک', roman: 'Customer' },
  phone: { en: 'Phone', ur: 'فون', roman: 'Phone' },
  city: { en: 'City', ur: 'شہر', roman: 'Shehar' },
  priceGroup: { en: 'Price group', ur: 'ریٹ گروپ', roman: 'Rate group' },
  bills: { en: 'Bills', ur: 'بل', roman: 'Bill' },
  bought: { en: 'Bought (Rs)', ur: 'خریداری (روپے)', roman: 'Kharidari (Rs)' },
  lastSale: { en: 'Last sale', ur: 'آخری بکری', roman: 'Aakhri sale' },
  balance: { en: 'Balance (Rs)', ur: 'بقایا (روپے)', roman: 'Baqaya (Rs)' },
  status: { en: 'Status', ur: 'حالت', roman: 'Haalat' },
  since: { en: 'Customer since', ur: 'کب سے گاہک', roman: 'Kab se customer' },
};

const ZERO = new Prisma.Decimal(0);

/**
 * Every customer of the business (owner, 2026-11-17: "can't see Customer module"): who they are, what they
 * bought and what they owe. Receivables stays the list of who owes; this one is everybody, also for a business
 * that never sells on credit.
 */
export const CUSTOMERS_LIST: ListResource = {
  name: 'customers',
  defaultSort: [{ field: 'name', dir: 'asc' }],
  fields: [
    { key: 'name', type: 'string', path: ['name'], sortable: true, filterable: true, searchable: true },
    { key: 'phone', type: 'string', path: ['phone'], filterable: true, searchable: true },
    { key: 'city', type: 'string', path: ['city'], sortable: true, filterable: true, searchable: true, groupable: true },
    { key: 'priceGroup', type: 'string', path: ['priceGroup'], sortable: true, filterable: true, groupable: true },
    { key: 'bills', type: 'number', path: ['_computed'], computed: true },
    { key: 'bought', type: 'number', path: ['_computed'], computed: true },
    { key: 'lastSale', type: 'date', path: ['_computed'], computed: true },
    // What they owe now (negative = paid ahead): opening balance + bills − payments.
    { key: 'balance', type: 'number', path: ['_computed'], computed: true },
    { key: 'status', type: 'enum', path: ['_computed'], enumValues: ['ACTIVE', 'INACTIVE'], computed: true },
    { key: 'since', type: 'date', path: ['createdAt'], sortable: true, filterable: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).customer as never,
  select: { id: true, name: true, phone: true, city: true, priceGroup: true, isActive: true, createdAt: true },
  toRow: (x) => {
    const c = x as { id: string; name: string; phone: string | null; city: string | null; priceGroup: string | null; isActive: boolean; createdAt: Date };
    return { id: c.id, name: c.name, phone: c.phone, city: c.city, priceGroup: c.priceGroup, bills: 0, bought: ZERO, lastSale: null, balance: ZERO, status: c.isActive ? 'ACTIVE' : 'INACTIVE', since: c.createdAt };
  },
  enrich: async (prisma, tenantId, rows) => {
    const figures = await customerFigures(prisma as PrismaClient, tenantId, rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, ...(figures.get(r.id) ?? {}) }));
  },
  // What all matching customers bought and owe, not only this page.
  extraTotals: async (prisma, tenantId, where) => {
    const db = prisma as PrismaClient;
    const ids = (await db.customer.findMany({ where: where as Prisma.CustomerWhereInput, select: { id: true } })).map((c) => c.id);
    const figures = await customerFigures(db, tenantId, ids);
    let bought = ZERO;
    let balance = ZERO;
    for (const f of figures.values()) {
      bought = bought.add(f.bought);
      balance = balance.add(f.balance);
    }
    return { bought: bought.toString(), balance: balance.toString() };
  },
};

/** Bills, total bought, last sale and balance for these customers of one business. */
async function customerFigures(db: PrismaClient, tenantId: string, ids: string[]): Promise<Map<string, { bills: number; bought: Prisma.Decimal; lastSale: Date | null; balance: Prisma.Decimal }>> {
  const out = new Map<string, { bills: number; bought: Prisma.Decimal; lastSale: Date | null; balance: Prisma.Decimal }>();
  if (!ids.length) return out;
  const [customers, sales, payments] = await Promise.all([
    db.customer.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, openingBalance: true } }),
    db.sale.findMany({
      where: { tenantId, customerId: { in: ids }, status: { in: KHATA_SALE_STATUSES } },
      orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, customerId: true, totalAmount: true, issuedAt: true, createdAt: true },
    }),
    db.payment.findMany({ where: { tenantId, customerId: { in: ids } }, orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], select: { customerId: true, saleId: true, amount: true } }),
  ]);
  for (const c of customers) {
    const own = sales.filter((s) => s.customerId === c.id);
    const applied = applyFor(c.openingBalance, own, payments.filter((p) => p.customerId === c.id));
    const last = own.length ? own[own.length - 1] : null;
    out.set(c.id, { bills: own.length, bought: own.reduce((t, s) => t.add(s.totalAmount), ZERO), lastSale: last ? last.issuedAt ?? last.createdAt : null, balance: applied.balance });
  }
  return out;
}
