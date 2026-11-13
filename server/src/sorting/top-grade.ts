import { Prisma, PrismaClient } from '@prisma/client';

/**
 * The business's best grade, for every "top grade %": the best-ranked grade it actually grades stock into.
 * Grades that sit first in the list but are never used (the starter "A" in a business that grades "1, 2, 3")
 * would make every top-grade % read 0. Before anything is graded: the first active grade in the list.
 */
export async function topGrade(prisma: PrismaClient | Prisma.TransactionClient, tenantId: string): Promise<{ rank: number; name: string } | null> {
  const orderBy = [{ rank: 'asc' as const }, { name: 'asc' as const }];
  const select = { rank: true, name: true };
  const used = await prisma.grade.findFirst({
    where: { tenantId, OR: [{ categoryOutputs: { some: {} } }, { gradeOutputs: { some: {} } }, { inventoryItems: { some: {} } }] },
    orderBy,
    select,
  });
  return used ?? prisma.grade.findFirst({ where: { tenantId, isActive: true }, orderBy, select });
}
