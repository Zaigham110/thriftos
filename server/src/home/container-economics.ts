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
export async function containerEconomics(prisma: PrismaClient | Prisma.TransactionClient, tenantId: string, ids: string[]): Promise<Map<string, ContainerEconomics>> {
  const out = new Map<string, ContainerEconomics>();
  if (!ids.length) return out;
  const [lots, lines, outputs, graded, sortGraded, topGrade, labour] = await Promise.all([
    prisma.rag.groupBy({ by: ['containerId'], where: { tenantId, containerId: { in: ids } }, _sum: { weightKg: true } }),
    prisma.saleLine.findMany({
      where: {
        sale: { tenantId, status: { in: KHATA_SALE_STATUSES } },
        inventoryItem: { tenantId, OR: [{ containerId: { in: ids } }, { repackUnit: { inputAllocations: { some: { containerId: { in: ids } } } } }] },
      },
      select: {
        profit: true,
        lineTotal: true,
        inventoryItem: { select: { containerId: true, repackUnit: { select: { inputAllocations: { select: { containerId: true, allocatedCost: true } } } } } },
      },
    }),
    prisma.categoryOutput.groupBy({ by: ['containerId'], where: { tenantId, containerId: { in: ids } }, _sum: { weightKg: true } }),
    prisma.gradeOutput.findMany({
      where: { tenantId, gradeBucket: { gradeSession: { categoryOutput: { containerId: { in: ids } } } } },
      select: { weightKg: true, grade: { select: { rank: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { containerId: true } } } } } } },
    }),
    // Grades given while sorting ("Jeans · A"), unless that kg was graded again afterwards.
    prisma.categoryOutput.findMany({
      where: { tenantId, containerId: { in: ids }, gradeId: { not: null }, gradeSessions: { none: {} } },
      select: { containerId: true, weightKg: true, grade: { select: { rank: true } } },
    }),
    prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy: { rank: 'asc' }, select: { rank: true } }),
    // Container profit = sales − landed cost − labour (Phase 8.4).
    prisma.labourCost.groupBy({ by: ['containerId'], where: { tenantId, containerId: { in: ids } }, _sum: { amount: true } }),
  ]);

  const sources: LineSource[] = lines.map((l) => {
    const allocations = l.inventoryItem.repackUnit?.inputAllocations ?? [];
    return {
      profit: l.profit,
      revenue: l.lineTotal,
      shares: allocations.length ? allocations.map((a) => ({ containerId: a.containerId, weight: a.allocatedCost })) : [{ containerId: l.inventoryItem.containerId, weight: 1 }],
    };
  });
  const money = byContainer(sources);
  const kg = new Map(lots.map((l) => [l.containerId, l._sum.weightKg ?? ZERO]));
  const sorted = new Map(outputs.map((o) => [o.containerId, o._sum.weightKg ?? ZERO]));
  const wages = new Map(labour.map((l) => [l.containerId, l._sum.amount ?? ZERO]));
  for (const id of ids) {
    const lab = wages.get(id) ?? ZERO;
    out.set(id, { kg: kg.get(id) ?? ZERO, revenue: money.get(id)?.revenue ?? ZERO, profit: (money.get(id)?.profit ?? ZERO).sub(lab), outputKg: sorted.get(id) ?? ZERO, graded: [], topRank: topGrade?.rank ?? null, labour: lab });
  }
  for (const g of graded) {
    const cid = g.gradeBucket.gradeSession.categoryOutput.containerId;
    if (cid && out.has(cid)) out.get(cid)!.graded.push({ rank: g.grade.rank, kg: g.weightKg });
  }
  for (const o of sortGraded) {
    if (o.containerId && o.grade && out.has(o.containerId)) out.get(o.containerId)!.graded.push({ rank: o.grade.rank, kg: o.weightKg });
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
