import { Prisma, PrismaClient } from '@prisma/client';

/**
 * The godown new stock goes into when none is chosen: the business's main one (its first active godown). Stock
 * always has a place, so "stock per godown" and moving between godowns add up (Phase 9.3, owner: godown flow).
 */
export async function defaultGodownId(db: PrismaClient | Prisma.TransactionClient, tenantId: string): Promise<string | null> {
  const g = await db.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
  return g?.id ?? null;
}
