import { ContainerStatus, Prisma, PrismaClient, RagSourceType, RagStatus, VendorType } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';
import { combine, containerEconomics, lotEconomics, topPercent, yieldPercent } from '../home/container-economics';
import { percent } from '../home/home';
import { supplierBalances } from './supplier-khata';

type Row = Record<string, unknown> & { id: string };

/** Column names for exports (screens use the dictionaries). */
export const CONTAINER_LABELS: Record<string, { en: string; ur: string }> = {
  number: { en: 'Container', ur: 'کنٹینر' },
  date: { en: 'Received', ur: 'وصولی' },
  arrivedAt: { en: 'Arrived', ur: 'پہنچا' },
  supplier: { en: 'Supplier', ur: 'سپلائر' },
  origin: { en: 'Origin', ur: 'ملک' },
  status: { en: 'Status', ur: 'حالت' },
  kg: { en: 'Net kg', ur: 'خالص کلو' },
  landedCost: { en: 'Landed cost (Rs)', ur: 'کل لاگت (روپے)' },
  costPerKg: { en: 'Cost per kg (Rs)', ur: 'فی کلو لاگت (روپے)' },
  revenue: { en: 'Sold so far (Rs)', ur: 'اب تک بکری (روپے)' },
  profit: { en: 'Profit so far (Rs)', ur: 'اب تک منافع (روپے)' },
  yield: { en: 'Sorted %', ur: 'چھانٹی %' },
  topGrade: { en: 'Top grade %', ur: 'بہترین گریڈ %' },
};

export const SUPPLIER_LABELS: Record<string, { en: string; ur: string }> = {
  name: { en: 'Supplier', ur: 'سپلائر' },
  origin: { en: 'Origin', ur: 'ملک' },
  phone: { en: 'Phone', ur: 'فون' },
  type: { en: 'Type', ur: 'قسم' },
  containers: { en: 'Containers', ur: 'کنٹینر' },
  lots: { en: 'Loose lots', ur: 'کھلے لاٹ' },
  kg: { en: 'Kg bought', ur: 'خریدا کلو' },
  profit: { en: 'Profit so far (Rs)', ur: 'اب تک منافع (روپے)' },
  profitPerKg: { en: 'Profit per kg (Rs)', ur: 'فی کلو منافع (روپے)' },
  yield: { en: 'Sorted %', ur: 'چھانٹی %' },
  topGrade: { en: 'Top grade %', ur: 'بہترین گریڈ %' },
};

/** Containers in the workspace (enterprise plan E3.1); profit and yield are worked out for each page. */
export const CONTAINERS_LIST: ListResource = {
  name: 'containers',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'number', type: 'string', path: ['containerNumber'], sortable: true, filterable: true, searchable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true, groupByMonth: true },
    { key: 'arrivedAt', type: 'date', path: ['arrivedAt'], sortable: true, filterable: true },
    { key: 'supplier', type: 'string', path: ['vendor', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'supplierId', type: 'string', path: ['vendorId'], filterable: true, groupable: true, hidden: true },
    { key: 'origin', type: 'string', path: ['originCountry'], sortable: true, filterable: true, groupable: true, searchable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(ContainerStatus), sortable: true, filterable: true, groupable: true },
    { key: 'kg', type: 'number', path: ['netWeight'], sortable: true, filterable: true, sum: true },
    { key: 'landedCost', type: 'number', path: ['landedCostPKR'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'costPerKg', type: 'number', path: ['landedCostPerKg'], sortable: true, filterable: true, permission: 'cost.view' },
    { key: 'revenue', type: 'number', path: ['_computed'], computed: true },
    { key: 'profit', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'yield', type: 'number', path: ['_computed'], computed: true },
    { key: 'topGrade', type: 'number', path: ['_computed'], computed: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).container as never,
  select: {
    id: true, containerNumber: true, createdAt: true, arrivedAt: true, vendorId: true, originCountry: true, status: true,
    netWeight: true, landedCostPKR: true, landedCostPerKg: true, vendor: { select: { name: true } },
  },
  toRow: (c) => {
    const r = c as Prisma.ContainerGetPayload<{ include: { vendor: { select: { name: true } } } }>;
    return {
      id: r.id, number: r.containerNumber, date: r.createdAt, arrivedAt: r.arrivedAt, supplier: r.vendor?.name ?? null, supplierId: r.vendorId,
      origin: r.originCountry, status: r.status, kg: r.netWeight, landedCost: r.landedCostPKR, costPerKg: r.landedCostPerKg,
    };
  },
  enrich: async (prisma, tenantId, rows) => {
    const econ = await containerEconomics(prisma as PrismaClient, tenantId, rows.map((r) => r.id));
    return rows.map((r) => {
      const e = econ.get(r.id)!;
      return { ...r, revenue: e.revenue, profit: e.profit, yield: yieldPercent(e), topGrade: topPercent(e) };
    });
  },
  groupLabels: async (prisma, tenantId, field, keys) => {
    if (field !== 'supplierId') return {};
    const vendors = await (prisma as PrismaClient).vendor.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } });
    return Object.fromEntries(vendors.map((v) => [v.id, v.name]));
  },
};

/** Suppliers with their scorecard (containers, kg, profit per kg, yield, A grade) worked out per page. */
export const SUPPLIERS_LIST: ListResource = {
  name: 'suppliers',
  defaultSort: [{ field: 'name', dir: 'asc' }],
  fields: [
    { key: 'name', type: 'string', path: ['name'], sortable: true, filterable: true, searchable: true },
    { key: 'origin', type: 'string', path: ['originCountry'], sortable: true, filterable: true, groupable: true, searchable: true },
    { key: 'phone', type: 'string', path: ['contactPhone'], filterable: true, searchable: true },
    { key: 'type', type: 'enum', path: ['vendorType'], enumValues: Object.values(VendorType), filterable: true, groupable: true },
    { key: 'containers', type: 'number', path: ['_computed'], computed: true },
    { key: 'lots', type: 'number', path: ['_computed'], computed: true },
    { key: 'kg', type: 'number', path: ['_computed'], computed: true },
    { key: 'owed', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'profit', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'profitPerKg', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'yield', type: 'number', path: ['_computed'], computed: true },
    { key: 'topGrade', type: 'number', path: ['_computed'], computed: true },
  ],
  scope: (tenantId) => ({ tenantId, vendorType: { not: VendorType.CUSTOMER } }),
  delegate: (prisma) => (prisma as PrismaClient).vendor as never,
  select: { id: true, name: true, originCountry: true, contactPhone: true, vendorType: true },
  toRow: (v) => {
    const r = v as { id: string; name: string; originCountry: string | null; contactPhone: string | null; vendorType: VendorType };
    return { id: r.id, name: r.name, origin: r.originCountry, phone: r.contactPhone, type: r.vendorType };
  },
  enrich: async (prisma, tenantId, rows) => {
    const db = prisma as PrismaClient;
    const ids = rows.map((r) => r.id);
    const containers = await db.container.findMany({ where: { tenantId, vendorId: { in: ids } }, select: { id: true, vendorId: true, netWeight: true } });
    // Loose lots are bought from suppliers too (v2 review): kg bought = containers' invoice kg + loose lots' kg.
    const lots = await db.rag.findMany({ where: { tenantId, vendorId: { in: ids }, sourceType: 'LOOSE_BALE' }, select: { id: true, vendorId: true } });
    const [econ, lotEcon, khata] = await Promise.all([containerEconomics(db, tenantId, containers.map((c) => c.id)), lotEconomics(db, tenantId, lots.map((l) => l.id)), supplierBalances(db, tenantId, ids)]);
    return rows.map((r) => {
      const own = containers.filter((c) => c.vendorId === r.id);
      const loose = lots.filter((l) => l.vendorId === r.id).map((l) => lotEcon.get(l.id)!);
      // Sold, profit, sorted % and top grade count the loose lots too: many businesses never buy a container.
      const t = combine([...own.map((c) => econ.get(c.id)!), ...loose]);
      const kg = own.reduce((s, c) => s.add(c.netWeight), new Prisma.Decimal(0)).add(loose.reduce((s, e) => s.add(e.kg), new Prisma.Decimal(0)));
      // Nothing bought yet: no profit to show (a dash, not Rs 0).
      const bought = own.length + loose.length > 0;
      return { ...r, containers: own.length, lots: loose.length, kg, owed: khata.get(r.id)?.owed ?? null, profit: bought ? t.profit : null, profitPerKg: bought ? t.profitPerKg : null, yield: t.yieldPercent, topGrade: t.topGradePercent } as Row;
    });
  },
};
export const PURCHASE_LOT_LABELS: Record<string, { en: string; ur: string }> = {
  code: { en: 'Lot', ur: 'لاٹ' },
  date: { en: 'Bought', ur: 'خریداری' },
  supplier: { en: 'Supplier', ur: 'سپلائر' },
  rawCategory: { en: 'Raw type', ur: 'مال' },
  status: { en: 'Status', ur: 'حالت' },
  kg: { en: 'Kg', ur: 'کلو' },
  cost: { en: 'Total cost (Rs)', ur: 'کل لاگت (روپے)' },
  costPerKg: { en: 'Cost per kg (Rs)', ur: 'فی کلو لاگت (روپے)' },
  sortedPercent: { en: 'Sorted %', ur: 'چھانٹی %' },
};

type PurchaseLot = Prisma.RagGetPayload<{ include: { vendor: { select: { name: true } }; rawCategory: { select: { name: true } }; sortSession: { select: { totalOutputWeight: true } } } }>;

/**
 * Gaari and loose lots bought without a container (v2 review): Purchasing shows them next to containers, with
 * what was paid, the price per kg and how far sorting has got (sorted kg over the lot's kg; 100% once closed).
 */
export const PURCHASE_LOTS_LIST: ListResource = {
  name: 'purchase-lots',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'code', type: 'string', path: ['ragCode'], sortable: true, filterable: true, searchable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true, groupByMonth: true },
    { key: 'supplier', type: 'string', path: ['vendor', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'supplierId', type: 'string', path: ['vendorId'], filterable: true, groupable: true, hidden: true },
    { key: 'rawCategory', type: 'string', path: ['rawCategory', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'rawCategoryId', type: 'string', path: ['rawCategoryId'], filterable: true, groupable: true, hidden: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(RagStatus), sortable: true, filterable: true, groupable: true },
    { key: 'kg', type: 'number', path: ['weightKg'], sortable: true, filterable: true, sum: true },
    { key: 'cost', type: 'number', path: ['allocatedCost'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'costPerKg', type: 'number', path: ['_computed'], computed: true, permission: 'cost.view' },
    { key: 'sortedPercent', type: 'number', path: ['_computed'], computed: true },
  ],
  scope: (tenantId) => ({ tenantId, sourceType: RagSourceType.LOOSE_BALE }),
  delegate: (prisma) => (prisma as PrismaClient).rag as never,
  select: {
    id: true, ragCode: true, createdAt: true, vendorId: true, rawCategoryId: true, status: true, weightKg: true, allocatedCost: true,
    vendor: { select: { name: true } }, rawCategory: { select: { name: true } },
    sortSession: { select: { totalOutputWeight: true } },
  },
  toRow: (x) => {
    const r = x as unknown as PurchaseLot;
    const s = r.sortSession;
    // While sorting is open, the session's waste field holds the kg still to sort, so only sorted kg counts.
    const done = r.status === RagStatus.SORTED ? r.weightKg : s ? s.totalOutputWeight : new Prisma.Decimal(0);
    return {
      id: r.id, code: r.ragCode, date: r.createdAt, supplier: r.vendor?.name ?? null, supplierId: r.vendorId,
      rawCategory: r.rawCategory?.name ?? null, rawCategoryId: r.rawCategoryId, status: r.status, kg: r.weightKg, cost: r.allocatedCost,
      costPerKg: r.weightKg.isZero() ? null : r.allocatedCost.div(r.weightKg).toDecimalPlaces(2),
      sortedPercent: r.weightKg.isZero() ? null : Math.min(100, percent(done, r.weightKg) ?? 0),
    };
  },
  groupLabels: async (prisma, tenantId, field, keys) => {
    const db = prisma as PrismaClient;
    if (field === 'supplierId') return Object.fromEntries((await db.vendor.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((v) => [v.id, v.name]));
    if (field === 'rawCategoryId') return Object.fromEntries((await db.rawCategory.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    return {};
  },
};
