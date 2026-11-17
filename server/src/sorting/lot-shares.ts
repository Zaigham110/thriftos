import { Prisma, PrismaClient } from '@prisma/client';
import { allocateByWeight } from '../costing/costing';

type Db = PrismaClient | Prisma.TransactionClient;

/** One lot that went into a mix: how much of the mix is its, by weight and by cost. */
export interface MixSource {
  mixRagId: string;
  sourceRagId: string;
  containerId: string | null;
  vendorId: string | null;
  weightKg: Prisma.Decimal;
  cost: Prisma.Decimal;
}

/**
 * The sources of mixes, for sharing a mix's figures back (owner, 2026-11-17: by weight; each lot keeps its own
 * cost). `where` picks them by the mix, by the source lot, or by the source lot's container.
 */
export async function mixSources(prisma: Db, tenantId: string, where: { mixRagIds?: string[]; sourceRagIds?: string[]; containerIds?: string[] }): Promise<MixSource[]> {
  const filter: Prisma.LotMixSourceWhereInput = { tenantId };
  if (where.mixRagIds) filter.mixRagId = { in: where.mixRagIds };
  if (where.sourceRagIds) filter.sourceRagId = { in: where.sourceRagIds };
  if (where.containerIds) filter.source = { containerId: { in: where.containerIds } };
  const rows = await prisma.lotMixSource.findMany({
    where: filter,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { mixRagId: true, sourceRagId: true, weightKg: true, cost: true, source: { select: { containerId: true, vendorId: true, container: { select: { vendorId: true } } } } },
  });
  return rows.map((r) => ({ mixRagId: r.mixRagId, sourceRagId: r.sourceRagId, containerId: r.source.containerId, vendorId: r.source.container?.vendorId ?? r.source.vendorId, weightKg: r.weightKg, cost: r.cost }));
}

/**
 * Splits one amount of a mix over all its sources so the parts add up to the amount to the paisa: by weight (what
 * the mix gave and sold for) or by cost (what the goods sold had cost, so a dearer lot carries more of it).
 */
export function shareOut(amount: Prisma.Decimal, sources: MixSource[], by: 'weight' | 'cost'): Map<string, Prisma.Decimal> {
  const sign = amount.isNegative() ? -1 : 1;
  const parts = sources.map((s) => ({ key: s.sourceRagId, weight: by === 'weight' ? s.weightKg : s.cost }));
  // All sources free (cost 0): fall back to weight, so nothing is lost.
  const usable = parts.some((p) => p.weight.greaterThan(0)) ? parts : sources.map((s) => ({ key: s.sourceRagId, weight: s.weightKg }));
  return new Map(allocateByWeight(amount.abs(), usable).map((a) => [a.key, a.amount.mul(sign)]));
}
