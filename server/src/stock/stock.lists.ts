import { InventoryStatus, Prisma, PrismaClient, StockAdjustmentStatus, StockSource, StockUnit } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';
import { money } from '../costing/costing';

const ZERO = new Prisma.Decimal(0);
const DAY = 24 * 60 * 60 * 1000;

/** What is left of a stock item, its kg and the cost of that part (same rounding as sales: cost by position). */
export function stockLeft(i: { quantity: Prisma.Decimal; usedQuantity: Prisma.Decimal; totalCost: Prisma.Decimal; unit: StockUnit; weightKg: Prisma.Decimal | null }) {
  const left = i.quantity.sub(i.usedQuantity);
  const value = left.lessThanOrEqualTo(0) ? ZERO : i.totalCost.sub(i.quantity.isZero() ? ZERO : money(i.totalCost.mul(i.usedQuantity).div(i.quantity)));
  const leftKg = i.unit === StockUnit.KG ? left : i.weightKg && !i.quantity.isZero() ? i.weightKg.mul(left).div(i.quantity).toDecimalPlaces(2) : null;
  return { left, value, leftKg };
}

/**
 * The name an item shows everywhere (v2 review): "Jeans · A" for stock named after its category and grade, the
 * same way the lot page and Inventory by item write it; a name somebody typed is kept as it is.
 */
export function itemName(i: { name: string | null; category?: { name: string } | null; grade?: { name: string } | null }): string | null {
  const auto = [i.category?.name, i.grade?.name].filter(Boolean);
  if (auto.length && (!i.name || i.name === auto.join(' '))) return auto.join(' · ');
  return i.name ?? null;
}

/** Kg now: what is left of an item in stock; for a sold item, what it weighed. */
function kgNow(i: { quantity: Prisma.Decimal; usedQuantity: Prisma.Decimal; totalCost: Prisma.Decimal; unit: StockUnit; weightKg: Prisma.Decimal | null; status?: InventoryStatus }): Prisma.Decimal {
  const left = stockLeft(i).leftKg ?? ZERO;
  return left.greaterThan(0) ? left : i.unit === StockUnit.KG ? i.quantity : i.weightKg ?? ZERO;
}

export const ageDays = (createdAt: Date, now = new Date()): number => Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY));

export const STOCK_LABELS: Record<string, { en: string; ur: string }> = {
  code: { en: 'Code', ur: 'کوڈ' },
  name: { en: 'Item', ur: 'مال' },
  category: { en: 'Category', ur: 'قسم' },
  grade: { en: 'Grade', ur: 'گریڈ' },
  source: { en: 'Source', ur: 'ذریعہ' },
  unit: { en: 'Unit', ur: 'اکائی' },
  status: { en: 'Status', ur: 'حالت' },
  quantity: { en: 'Received', ur: 'وصول' },
  left: { en: 'Left', ur: 'باقی' },
  pieces: { en: 'Pieces left', ur: 'باقی پیس' },
  kg: { en: 'Kg', ur: 'کلو' },
  cost: { en: 'Cost (Rs)', ur: 'لاگت (روپے)' },
  value: { en: 'Value left (Rs)', ur: 'باقی مال کی لاگت (روپے)' },
  salePrice: { en: 'Price (Rs)', ur: 'قیمت (روپے)' },
  date: { en: 'Received on', ur: 'وصولی' },
  age: { en: 'Age (days)', ur: 'عمر (دن)' },
  godown: { en: 'Godown', ur: 'گودام' },
  kgNow: { en: 'Kg', ur: 'کلو' },
  soldAt: { en: 'Sold on', ur: 'فروخت کی تاریخ' },
  soldTo: { en: 'Sold to', ur: 'خریدار' },
  soldFor: { en: 'Sold for (Rs)', ur: 'فروخت کی رقم (روپے)' },
  supplier: { en: 'Supplier', ur: 'سپلائر' },
};

type Item = Prisma.InventoryItemGetPayload<{
  include: { repackUnit: { select: { unitCode: true } }; category: { select: { name: true } }; grade: { select: { name: true } }; warehouse: { select: { name: true } }; vendor: { select: { name: true } } };
}>;

/** Stock items in the workspace (enterprise plan E3.3): what is left, its value and age, per page. */
export const STOCK_LIST: ListResource = {
  name: 'stock',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'code', type: 'string', path: ['repackUnit', 'unitCode'], sortable: true, filterable: true, searchable: true },
    { key: 'name', type: 'string', path: ['name'], sortable: true, filterable: true, searchable: true },
    // The name as it is stored ("Jeans A"): the sale screen keeps matching what people type against it.
    { key: 'plainName', type: 'string', path: ['name'], hidden: true },
    { key: 'category', type: 'string', path: ['category', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'categoryId', type: 'string', path: ['categoryId'], filterable: true, groupable: true, hidden: true },
    { key: 'grade', type: 'string', path: ['grade', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'gradeId', type: 'string', path: ['gradeId'], filterable: true, groupable: true, hidden: true },
    { key: 'source', type: 'enum', path: ['source'], enumValues: Object.values(StockSource), sortable: true, filterable: true, groupable: true },
    { key: 'unit', type: 'enum', path: ['unit'], enumValues: Object.values(StockUnit), sortable: true, filterable: true, groupable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(InventoryStatus), sortable: true, filterable: true, groupable: true },
    { key: 'quantity', type: 'number', path: ['quantity'], sortable: true, filterable: true },
    { key: 'left', type: 'number', path: ['_computed'], computed: true },
    { key: 'pieces', type: 'number', path: ['_computed'], computed: true },
    { key: 'kg', type: 'number', path: ['weightKg'], sortable: true, filterable: true, sum: true },
    // Kg now: what is left of an item in stock; what a sold item weighed.
    { key: 'kgNow', type: 'number', path: ['_computed'], computed: true },
    // The sale of a sold item (v2 review: the Sold list said nothing about the sale). For the people who sell.
    { key: 'soldAt', type: 'date', path: ['_computed'], computed: true },
    { key: 'soldTo', type: 'string', path: ['_computed'], computed: true, permission: 'sale.create' },
    { key: 'soldFor', type: 'number', path: ['_computed'], computed: true, permission: 'sale.create' },
    { key: 'cost', type: 'number', path: ['totalCost'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'value', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'salePrice', type: 'number', path: ['salePrice'], sortable: true, filterable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true },
    { key: 'age', type: 'number', path: ['_computed'], computed: true },
    { key: 'godown', type: 'string', path: ['warehouse', 'name'], sortable: true, filterable: true },
    { key: 'godownId', type: 'string', path: ['warehouseId'], filterable: true, groupable: true, hidden: true },
    { key: 'supplier', type: 'string', path: ['vendor', 'name'], sortable: true, filterable: true, searchable: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).inventoryItem as never,
  select: {
    id: true, name: true, categoryId: true, gradeId: true, source: true, unit: true, status: true, quantity: true, usedQuantity: true,
    weightKg: true, totalCost: true, salePrice: true, createdAt: true, warehouseId: true, priceTier: true, pcsCount: true,
    repackUnit: { select: { unitCode: true } }, category: { select: { name: true } }, grade: { select: { name: true } },
    warehouse: { select: { name: true } }, vendor: { select: { name: true } },
  },
  // The value left of every matching item, not only this page (the totals row).
  extraTotals: async (prisma, tenantId, where) => {
    const items = await (prisma as PrismaClient).inventoryItem.findMany({
      where: where as Prisma.InventoryItemWhereInput,
      select: { quantity: true, usedQuantity: true, totalCost: true, unit: true, weightKg: true },
    });
    return {
      value: items.reduce((t, i) => t.add(stockLeft(i).value), ZERO).toString(),
      kgNow: items.reduce((t, i) => t.add(kgNow(i)), ZERO).toString(),
    };
  },
  toRow: (x) => {
    const i = x as unknown as Item;
    const { left, value } = stockLeft(i);
    const name = itemName(i);
    // A sold item is no longer in a godown and has nothing left, no value left and no age: those read "—".
    const sold = i.status === InventoryStatus.SOLD;
    return {
      id: i.id, code: i.repackUnit?.unitCode ?? null, name, plainName: i.name ?? ([i.category?.name, i.grade?.name].filter(Boolean).join(' ') || null), category: i.category?.name ?? null, categoryId: i.categoryId, grade: i.grade?.name ?? null,
      gradeId: i.gradeId, source: i.source, unit: i.unit, status: i.status, quantity: i.quantity, left: sold ? null : left, kg: i.weightKg, kgNow: kgNow(i), cost: i.totalCost, value: sold ? null : value,
      soldAt: null, soldTo: null, soldFor: null,
      // Bales made of a number of pieces: the pieces left (they can be sold by the piece).
      pieces: i.unit === StockUnit.BALE && i.pcsCount && !i.quantity.isZero() ? left.mul(i.pcsCount).div(i.quantity).toDecimalPlaces(0).toNumber() : null,
      salePrice: i.salePrice, date: i.createdAt, age: sold ? null : ageDays(i.createdAt), godown: sold ? null : i.warehouse?.name ?? null, godownId: i.warehouseId, supplier: i.vendor?.name ?? null,
    };
  },
  enrich: async (prisma, tenantId, rows) => {
    const sold = rows.filter((r) => r['status'] === InventoryStatus.SOLD).map((r) => r.id);
    if (!sold.length) return rows;
    const lines = await (prisma as PrismaClient).saleLine.findMany({
      where: { inventoryItemId: { in: sold }, sale: { tenantId, status: { notIn: ['CANCELLED', 'DRAFT'] } } },
      orderBy: { createdAt: 'asc' },
      select: { inventoryItemId: true, lineTotal: true, sale: { select: { createdAt: true, customer: { select: { name: true } } } } },
    });
    return rows.map((r) => {
      const mine = lines.filter((l) => l.inventoryItemId === r.id);
      if (!mine.length) return r;
      const buyers = [...new Set(mine.map((l) => l.sale.customer.name))];
      return {
        ...r, soldAt: mine[mine.length - 1].sale.createdAt, soldTo: buyers.length > 1 ? `${buyers[0]} +${buyers.length - 1}` : buyers[0],
        soldFor: mine.reduce((t, l) => t.add(l.lineTotal), ZERO),
      };
    });
  },
  groupLabels: async (prisma, tenantId, field, keys) => {
    const db = prisma as PrismaClient;
    if (field === 'categoryId') return Object.fromEntries((await db.category.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    if (field === 'gradeId') return Object.fromEntries((await db.grade.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    if (field === 'godownId') return Object.fromEntries((await db.warehouse.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    return {};
  },
};

export const ADJUSTMENT_LABELS: Record<string, { en: string; ur: string }> = {
  date: { en: 'Entered', ur: 'درج' },
  item: { en: 'Item', ur: 'مال' },
  status: { en: 'Status', ur: 'حالت' },
  book: { en: 'Books said', ur: 'کھاتے میں' },
  counted: { en: 'Counted', ur: 'گنتی' },
  difference: { en: 'Difference', ur: 'فرق' },
  reason: { en: 'Reason', ur: 'وجہ' },
  costChange: { en: 'Cost change (Rs)', ur: 'لاگت میں فرق (روپے)' },
};

/** Stock counts waiting for approval, approved and rejected (enterprise plan E3.3). */
export const ADJUSTMENTS_LIST: ListResource = {
  name: 'stock-counts',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true },
    { key: 'item', type: 'string', path: ['inventoryItem', 'name'], sortable: true, searchable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(StockAdjustmentStatus), sortable: true, filterable: true, groupable: true },
    { key: 'book', type: 'number', path: ['bookQuantity'], sortable: true },
    { key: 'counted', type: 'number', path: ['countedQuantity'], sortable: true },
    { key: 'difference', type: 'number', path: ['_computed'], computed: true },
    { key: 'reason', type: 'string', path: ['reason'], searchable: true },
    { key: 'costChange', type: 'number', path: ['costChange'], sortable: true, sum: true, permission: 'cost.view' },
    { key: 'itemId', type: 'string', path: ['inventoryItemId'], filterable: true, hidden: true },
    { key: 'unit', type: 'enum', path: ['inventoryItem', 'unit'], enumValues: Object.values(StockUnit), hidden: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).stockAdjustment as never,
  select: {
    id: true, createdAt: true, status: true, bookQuantity: true, countedQuantity: true, reason: true, costChange: true, inventoryItemId: true,
    inventoryItem: { select: { name: true, unit: true, repackUnit: { select: { unitCode: true } }, category: { select: { name: true } }, grade: { select: { name: true } } } },
  },
  toRow: (x) => {
    const a = x as unknown as Prisma.StockAdjustmentGetPayload<{ include: { inventoryItem: { select: { name: true; unit: true; repackUnit: { select: { unitCode: true } }; category: { select: { name: true } }; grade: { select: { name: true } } } } } }>;
    const it = a.inventoryItem;
    const label = it.repackUnit?.unitCode ?? it.name ?? [it.category?.name, it.grade?.name].filter(Boolean).join(' ');
    return {
      id: a.id, date: a.createdAt, item: label, itemId: a.inventoryItemId, unit: it.unit, status: a.status, book: a.bookQuantity, counted: a.countedQuantity,
      difference: a.countedQuantity.sub(a.bookQuantity), reason: a.reason, costChange: a.costChange,
    };
  },
};
