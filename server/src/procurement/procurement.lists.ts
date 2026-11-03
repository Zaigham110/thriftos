import { ContainerStatus, Prisma, PrismaClient, VendorType } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';
import { combine, containerEconomics, topPercent, yieldPercent } from '../home/container-economics';

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
  topGrade: { en: 'A grade %', ur: 'اے گریڈ %' },
};

export const SUPPLIER_LABELS: Record<string, { en: string; ur: string }> = {
  name: { en: 'Supplier', ur: 'سپلائر' },
  origin: { en: 'Origin', ur: 'ملک' },
  phone: { en: 'Phone', ur: 'فون' },
  type: { en: 'Type', ur: 'قسم' },
  containers: { en: 'Containers', ur: 'کنٹینر' },
  kg: { en: 'Kg bought', ur: 'خریدا کلو' },
  profit: { en: 'Profit so far (Rs)', ur: 'اب تک منافع (روپے)' },
  profitPerKg: { en: 'Profit per kg (Rs)', ur: 'فی کلو منافع (روپے)' },
  yield: { en: 'Sorted %', ur: 'چھانٹی %' },
  topGrade: { en: 'A grade %', ur: 'اے گریڈ %' },
};

/** Containers in the workspace (enterprise plan E3.1); profit and yield are worked out for each page. */
export const CONTAINERS_LIST: ListResource = {
  name: 'containers',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'number', type: 'string', path: ['containerNumber'], sortable: true, filterable: true, searchable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true },
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
    { key: 'kg', type: 'number', path: ['_computed'], computed: true },
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
    const containers = await db.container.findMany({ where: { tenantId, vendorId: { in: rows.map((r) => r.id) } }, select: { id: true, vendorId: true } });
    const econ = await containerEconomics(db, tenantId, containers.map((c) => c.id));
    return rows.map((r) => {
      const mine = containers.filter((c) => c.vendorId === r.id).map((c) => econ.get(c.id)!);
      const t = combine(mine);
      return { ...r, containers: mine.length, kg: t.kg, profit: t.profit, profitPerKg: t.profitPerKg, yield: t.yieldPercent, topGrade: t.topGradePercent } as Row;
    });
  },
};
