import { Prisma, PrismaClient, RagSourceType, RagStatus, SortStatus } from '@prisma/client';
import type { ListResource } from '../common/list/list-engine';
import { percent } from '../home/home';


export const LOT_LABELS: Record<string, { en: string; ur: string }> = {
  code: { en: 'Lot', ur: 'لاٹ' },
  date: { en: 'Received', ur: 'وصولی' },
  container: { en: 'Container', ur: 'کنٹینر' },
  supplier: { en: 'Supplier', ur: 'سپلائر' },
  origin: { en: 'Origin', ur: 'ملک' },
  rawCategory: { en: 'Raw type', ur: 'کچا مال' },
  source: { en: 'Source', ur: 'ذریعہ' },
  status: { en: 'Status', ur: 'حالت' },
  kg: { en: 'Kg', ur: 'کلو' },
  cost: { en: 'Cost (Rs)', ur: 'لاگت (روپے)' },
  sortedKg: { en: 'Sorted kg', ur: 'چھانٹی کلو' },
  wasteKg: { en: 'Waste kg', ur: 'ضائع کلو' },
  leftKg: { en: 'Left to sort kg', ur: 'باقی چھانٹی کلو' },
  yield: { en: 'Sorted %', ur: 'چھانٹی %' },
  worker: { en: 'Sorted by', ur: 'چھانٹی کرنے والا' },
  sortedAt: { en: 'Finished', ur: 'مکمل' },
};

type Lot = Prisma.RagGetPayload<{
  include: {
    container: { select: { containerNumber: true; vendor: { select: { name: true } } } };
    vendor: { select: { name: true } };
    rawCategory: { select: { name: true } };
    sortSession: { select: { status: true; totalOutputWeight: true; wasteWeight: true; endTime: true; worker: { select: { name: true } } } };
  };
}>;

/** Lots to sort, being sorted and sorted (enterprise plan E3.2): the sorting board and list. */
export const LOTS_LIST: ListResource = {
  name: 'lots',
  defaultSort: [{ field: 'date', dir: 'desc' }],
  fields: [
    { key: 'code', type: 'string', path: ['ragCode'], sortable: true, filterable: true, searchable: true },
    { key: 'date', type: 'date', path: ['createdAt'], sortable: true, filterable: true },
    { key: 'container', type: 'string', path: ['container', 'containerNumber'], sortable: true, filterable: true, searchable: true },
    { key: 'containerId', type: 'string', path: ['containerId'], filterable: true, groupable: true, hidden: true },
    { key: 'supplier', type: 'string', path: ['_computed'], computed: true },
    { key: 'origin', type: 'string', path: ['originCountry'], sortable: true, filterable: true, groupable: true, searchable: true },
    { key: 'rawCategory', type: 'string', path: ['rawCategory', 'name'], sortable: true, filterable: true, searchable: true },
    { key: 'rawCategoryId', type: 'string', path: ['rawCategoryId'], filterable: true, groupable: true, hidden: true },
    { key: 'source', type: 'enum', path: ['sourceType'], enumValues: Object.values(RagSourceType), sortable: true, filterable: true, groupable: true },
    { key: 'status', type: 'enum', path: ['status'], enumValues: Object.values(RagStatus), sortable: true, filterable: true, groupable: true },
    { key: 'kg', type: 'number', path: ['weightKg'], sortable: true, filterable: true, sum: true },
    { key: 'cost', type: 'number', path: ['allocatedCost'], sortable: true, filterable: true, sum: true, permission: 'cost.view' },
    { key: 'sortedKg', type: 'number', path: ['_computed'], computed: true },
    { key: 'wasteKg', type: 'number', path: ['_computed'], computed: true },
    { key: 'leftKg', type: 'number', path: ['_computed'], computed: true },
    { key: 'yield', type: 'number', path: ['_computed'], computed: true },
    { key: 'worker', type: 'string', path: ['_computed'], computed: true },
    { key: 'sortedAt', type: 'date', path: ['_computed'], computed: true },
  ],
  scope: (tenantId) => ({ tenantId }),
  delegate: (prisma) => (prisma as PrismaClient).rag as never,
  select: {
    id: true, ragCode: true, createdAt: true, containerId: true, originCountry: true, rawCategoryId: true, sourceType: true, status: true, weightKg: true, allocatedCost: true,
    container: { select: { containerNumber: true, vendor: { select: { name: true } } } },
    vendor: { select: { name: true } },
    rawCategory: { select: { name: true } },
    sortSession: { select: { status: true, totalOutputWeight: true, wasteWeight: true, endTime: true, worker: { select: { name: true } } } },
  },
  toRow: (x) => {
    const r = x as unknown as Lot;
    const s = r.sortSession;
    const sorted = s ? s.totalOutputWeight : null;
    return {
      id: r.id, code: r.ragCode, date: r.createdAt, container: r.container?.containerNumber ?? null, containerId: r.containerId,
      supplier: r.container?.vendor?.name ?? r.vendor?.name ?? null, origin: r.originCountry, rawCategory: r.rawCategory?.name ?? null, rawCategoryId: r.rawCategoryId,
      source: r.sourceType, status: r.status, kg: r.weightKg, cost: r.allocatedCost,
      // While a lot is being sorted the session's waste field holds the kg still to sort (v2 review): that is
      // "left to sort", and waste is known only once the lot is closed.
      sortedKg: sorted,
      wasteKg: s && s.status === SortStatus.CLOSED ? s.wasteWeight : null,
      leftKg: r.status === RagStatus.NOT_STARTED ? r.weightKg : s && s.status === SortStatus.OPEN ? s.wasteWeight : null,
      yield: s && sorted && !r.weightKg.isZero() && r.status === RagStatus.SORTED ? percent(sorted, r.weightKg) : null,
      worker: s?.worker.name ?? null, sortedAt: s?.endTime ?? null,
    };
  },
  extraTotals: async (prisma, tenantId, where) => {
    const db = prisma as PrismaClient;
    const rag = where as Prisma.RagWhereInput;
    const [closed, open, waiting] = await Promise.all([
      db.sortSession.aggregate({ where: { tenantId, status: SortStatus.CLOSED, rag }, _sum: { totalOutputWeight: true, wasteWeight: true } }),
      db.sortSession.aggregate({ where: { tenantId, status: SortStatus.OPEN, rag }, _sum: { totalOutputWeight: true, wasteWeight: true } }),
      db.rag.aggregate({ where: { AND: [rag, { status: RagStatus.NOT_STARTED }] }, _sum: { weightKg: true } }),
    ]);
    const d = (v: Prisma.Decimal | null | undefined) => v ?? new Prisma.Decimal(0);
    return {
      sortedKg: d(closed._sum.totalOutputWeight).add(d(open._sum.totalOutputWeight)).toString(),
      wasteKg: d(closed._sum.wasteWeight).toString(),
      leftKg: d(open._sum.wasteWeight).add(d(waiting._sum.weightKg)).toString(),
    };
  },
  groupLabels: async (prisma, tenantId, field, keys) => {
    const db = prisma as PrismaClient;
    if (field === 'containerId') return Object.fromEntries((await db.container.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, containerNumber: true } })).map((c) => [c.id, c.containerNumber]));
    if (field === 'rawCategoryId') return Object.fromEntries((await db.rawCategory.findMany({ where: { tenantId, id: { in: keys } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    return {};
  },
};
