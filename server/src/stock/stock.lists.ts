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
  kg: { en: 'Kg', ur: 'کلو' },
  cost: { en: 'Cost (Rs)', ur: 'لاگت (روپے)' },
  value: { en: 'Value left (Rs)', ur: 'باقی مال کی لاگت (روپے)' },
  salePrice: { en: 'Price (Rs)', ur: 'قیمت (روپے)' },
  date: { en: 'Received on', ur: 'وصولی' },
  age: { en: 'Age (days)', ur: 'عمر (دن)' },
  godown: { en: 'Godown', ur: 'گودام' },
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
    { key: 'category', type: 'string', path: ['category', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'categoryId', type: 'string', path: ['categoryId'], filterable: true, groupable: true, hidden: true },
    { key: 'grade', type: 'string', path: ['grade', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'gradeId', type: 'string', path: ['gradeId'], filterable: true, groupable: true, hidden: true },
    { key: 'source', type: 'enum', path: ['source'], enumValues: Object.values(StockSource), sortable: true, filterable: true, groupable: true },
    { key: 'unit', type: 'enum', path: ['unit'], enumValues: Object.values(StockUnit), sortable: true, filterable: true, groupable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(InventoryStatus), sortable: true, filterable: true, groupable: true },
    { key: 'quantity', type: 'number', path: ['quantity'], sortable: true, filterable: true },
    { key: 'left', type: 'number', path: ['_computed'], computed: true },
    { key: 'kg', type: 'number', path: ['weightKg'], sortable: true, filterable: true, sum: true },
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
    weightKg: true, totalCost: true, salePrice: true, createdAt: true, warehouseId: true, priceTier: true,
    repackUnit: { select: { unitCode: true } }, category: { select: { name: true } }, grade: { select: { name: true } },
    warehouse: { select: { name: true } }, vendor: { select: { name: true } },
  },
  // The value left of every matching item, not only this page (the totals row).
  extraTotals: async (prisma, tenantId, where) => {
    const items = await (prisma as PrismaClient).inventoryItem.findMany({
      where: where as Prisma.InventoryItemWhereInput,
      select: { quantity: true, usedQuantity: true, totalCost: true, unit: true, weightKg: true },
    });
    return { value: items.reduce((t, i) => t.add(stockLeft(i).value), ZERO).toString() };
  },
  toRow: (x) => {
    const i = x as unknown as Item;
    const { left, value } = stockLeft(i);
    const name = i.name ?? ([i.category?.name, i.grade?.name].filter(Boolean).join(' ') || null);
    return {
      id: i.id, code: i.repackUnit?.unitCode ?? null, name, category: i.category?.name ?? null, categoryId: i.categoryId, grade: i.grade?.name ?? null,
      gradeId: i.gradeId, source: i.source, unit: i.unit, status: i.status, quantity: i.quantity, left, kg: i.weightKg, cost: i.totalCost, value,
      salePrice: i.salePrice, date: i.createdAt, age: ageDays(i.createdAt), godown: i.warehouse?.name ?? null, godownId: i.warehouseId, supplier: i.vendor?.name ?? null,
    };
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
