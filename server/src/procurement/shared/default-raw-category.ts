import { Prisma, RagBaleType } from '@prisma/client';

/**
 * The raw category used when the floor does not pick one (a lot is "Mixed" bales unless said otherwise).
 * Created on first use, so a new tenant can receive maal without setting up raw categories.
 */
export async function defaultRawCategoryId(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const existing = await tx.rawCategory.findFirst({
    where: { tenantId, isActive: true, rawType: RagBaleType.BALE },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.rawCategory.upsert({
    where: { tenantId_name_rawType: { tenantId, name: 'Mixed', rawType: RagBaleType.BALE } },
    update: { isActive: true },
    create: { tenantId, name: 'Mixed', rawType: RagBaleType.BALE },
    select: { id: true },
  });
  return created.id;
}
