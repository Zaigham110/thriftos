import { Prisma, PrismaClient } from '@prisma/client';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { byContainer, LineSource, percent, topGradePercent } from './home';

const ZERO = new Prisma.Decimal(0);

/** What a container has earned so far and how it sorted (shared by owner home, lists, record pages, scorecards). */
export interface ContainerEconomics {
  /** Kg received (its lots). */
  kg: Prisma.Decimal;
  /** Sold so far: revenue and profit of the sale lines made from it (bales split by their cost share). */
  revenue: Prisma.Decimal;
  profit: Prisma.Decimal;
  /** Kg sorted into categories. */
  outputKg: Prisma.Decimal;
  /** Graded kg by grade rank (for top-grade %). */
  graded: { rank: number; kg: Prisma.Decimal }[];
  /** Rank of the business's top grade (A), if it has grades. */
  topRank: number | null;
  /** Phase 8: sorter pay put on it (paid pay sheets); already taken off `profit`. */
  labour: Prisma.Decimal;
}

export const yieldPercent = (e: ContainerEconomics): number | null => (e.outputKg.isZero() ? null : percent(e.outputKg, e.kg));
export const topPercent = (e: ContainerEconomics): number | null => (e.topRank === null ? null : topGradePercent(e.graded, e.topRank));

/** One batch of queries for any number of containers of one business. */
export const containerEconomics = (prisma: PrismaClient | Prisma.TransactionClient, tenantId: string, ids: string[]): Promise<Map<string, ContainerEconomics>> => economics(prisma, tenantId, ids, false);

/**
 * The same figures for loose lots (a gaari or bales bought without a container), keyed by lot id, so a supplier
 * who only ever sold loose lots still shows what their stock sold for, earned and how it sorted (v2 review).
 */
export const lotEconomics = (prisma: PrismaClient | Prisma.TransactionClient, tenantId: string, ids: string[]): Promise<Map<string, ContainerEconomics>> => economics(prisma, tenantId, ids, true);

async function economics(prisma: PrismaClient | Prisma.TransactionClient, tenantId: string, ids: string[], byLot: boolean): Promise<Map<string, ContainerEconomics>> {
  const out = new Map<string, ContainerEconomics>();
  if (!ids.length) return out;
  const among = { in: ids };
  // Where a row came from: its container, or (for loose lots) its lot.
  const own = byLot ? { ragId: among } : { containerId: among };
  const [lots, lines, outputs, graded, topGrade, labour] = await Promise.all([
    prisma.rag.findMany({ where: { tenantId, ...(byLot ? { id: among } : { containerId: among }) }, select: { id: true, containerId: true, weightKg: true } }),
    prisma.saleLine.findMany({
      where: {
        sale: { tenantId, status: { in: KHATA_SALE_STATUSES } },
        inventoryItem: { tenantId, OR: [own, { repackUnit: { inputAllocations: { some: byLot ? { ragBaleId: among } : { containerId: among } } } }] },
      },
      select: {
        profit: true,
        lineTotal: true,
        inventoryItem: { select: { containerId: true, ragId: true, repackUnit: { select: { inputAllocations: { select: { containerId: true, ragBaleId: true, allocatedCost: true } } } } } },
      },
    }),
    // Sorted kg, with the grade given while sorting ("Jeans · A") unless that kg was graded again afterwards.
    prisma.categoryOutput.findMany({
      where: { tenantId, ...own },
      select: { containerId: true, ragId: true, weightKg: true, grade: { select: { rank: true } }, _count: { select: { gradeSessions: true } } },
    }),
    prisma.gradeOutput.findMany({
      where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: own } } },
      select: { weightKg: true, grade: { select: { rank: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { containerId: true, ragId: true } } } } } } },
    }),
    prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { rank: true } }),
    // Profit = sales − landed cost − labour (Phase 8.4).
    prisma.labourCost.findMany({ where: { tenantId, ...own }, select: { containerId: true, ragId: true, amount: true } }),
  ]);

  const keyOf = (r: { containerId: string | null; ragId: string | null }) => (byLot ? r.ragId : r.containerId);
  const sources: LineSource[] = lines.map((l) => {
    const allocations = l.inventoryItem.repackUnit?.inputAllocations ?? [];
    return {
      profit: l.profit,
      revenue: l.lineTotal,
      shares: allocations.length
        ? allocations.map((a) => ({ containerId: byLot ? a.ragBaleId : a.containerId, weight: a.allocatedCost }))
        : [{ containerId: keyOf(l.inventoryItem), weight: 1 }],
    };
  });
  const money = byContainer(sources);
  for (const id of ids) out.set(id, { kg: ZERO, revenue: money.get(id)?.revenue ?? ZERO, profit: money.get(id)?.profit ?? ZERO, outputKg: ZERO, graded: [], topRank: topGrade?.rank ?? null, labour: ZERO });
  for (const l of lots) {
    const e = out.get((byLot ? l.id : l.containerId) ?? '');
    if (e) e.kg = e.kg.add(l.weightKg);
  }
  for (const o of outputs) {
    const e = out.get(keyOf(o) ?? '');
    if (!e) continue;
    e.outputKg = e.outputKg.add(o.weightKg);
    if (o.grade && !o._count.gradeSessions) e.graded.push({ rank: o.grade.rank, kg: o.weightKg });
  }
  for (const g of graded) {
    const e = out.get(keyOf(g.gradeBucket.gradeSession.categoryOutput) ?? '');
    if (e) e.graded.push({ rank: g.grade.rank, kg: g.weightKg });
  }
  for (const l of labour) {
    const e = out.get(keyOf(l) ?? '');
    if (!e) continue;
    e.labour = e.labour.add(l.amount);
    e.profit = e.profit.sub(l.amount);
  }
  return out;
}

/** Totals for a group of containers (a supplier, a country): profit per kg and top-grade % over all of them. */
export function combine(list: ContainerEconomics[]): { kg: Prisma.Decimal; revenue: Prisma.Decimal; profit: Prisma.Decimal; profitPerKg: Prisma.Decimal; yieldPercent: number | null; topGradePercent: number | null } {
  const kg = list.reduce((s, e) => s.add(e.kg), ZERO);
  const revenue = list.reduce((s, e) => s.add(e.revenue), ZERO);
  const profit = list.reduce((s, e) => s.add(e.profit), ZERO);
  const outputKg = list.reduce((s, e) => s.add(e.outputKg), ZERO);
  const topRank = list.find((e) => e.topRank !== null)?.topRank ?? null;
  return {
    kg,
    revenue,
    profit,
    profitPerKg: kg.isZero() ? ZERO : profit.div(kg).toDecimalPlaces(2),
    yieldPercent: outputKg.isZero() ? null : percent(outputKg, kg),
    topGradePercent: topRank === null ? null : topGradePercent(list.flatMap((e) => e.graded), topRank),
  };
}
