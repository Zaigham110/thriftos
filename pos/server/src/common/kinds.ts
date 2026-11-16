import { Prisma, PrismaClient } from '@prisma/client';
import { Dec } from './util';

/** What decides a bale's kind. */
export interface KindSource {
  item: string;
  category: string | null;
  grade: string | null;
  weightKg: Dec | null;
  pieces: number | null;
}

/** Latin letters and digits only, upper case. A name with none of them reads as K. */
function latin(value: string, max: number): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max) || 'K';
}

/**
 * Bales with the same category, grade, weight and pieces are one kind. Weight is exact: 45 kg and 45.5 kg are two
 * kinds. A bale with no category goes by its item name, so unlike goods of the same weight do not become one kind.
 * `base` is the readable code before the clash rule: CATEGORY-GRADE-KG, pieces end in P (JEANS-1-45-200P).
 */
export function kindOf(b: KindSource) {
  const category = (b.category ?? '').trim() || b.item.trim();
  const grade = (b.grade ?? '').trim() || null;
  const weightKg = b.weightKg && b.weightKg.greaterThan(0) ? b.weightKg.toDecimalPlaces(2) : null;
  const pieces = b.pieces && b.pieces > 0 ? b.pieces : null;
  // "Grade A" reads as A.
  const gradeWord = grade ? grade.replace(/^grade\b[\s\-:.]*/i, '').trim() || grade : null;
  const parts = [latin(category, 10)];
  if (gradeWord) parts.push(latin(gradeWord, 6));
  if (weightKg) parts.push(weightKg.toString());
  if (pieces) parts.push(`${pieces}P`);
  return {
    key: [category.toLowerCase(), (grade ?? '').toLowerCase(), weightKg?.toString() ?? '', pieces ?? ''].join('|'),
    base: parts.join('-'),
    name: [category, grade].filter(Boolean).join(' · '),
    category,
    grade,
    weightKg,
    pieces,
  };
}

/**
 * The shared code of each bale, in the order given; kinds that do not exist yet are made. When two different kinds
 * would read the same, the later one ends in -2, -3… A code never changes once made. Call inside a transaction.
 */
export async function kindCodes(tx: Prisma.TransactionClient, tenantId: string, bales: KindSource[]): Promise<string[]> {
  // One at a time per business, so two imports cannot make the same code.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7461002, hashtext(${tenantId}))`;
  const known = await tx.baleKind.findMany({ where: { tenantId }, select: { key: true, code: true } });
  const byKey = new Map(known.map((k) => [k.key, k.code]));
  const used = new Set(known.map((k) => k.code));
  const out: string[] = [];
  for (const bale of bales) {
    const kind = kindOf(bale);
    let code = byKey.get(kind.key);
    if (!code) {
      code = kind.base;
      for (let n = 2; used.has(code); n++) code = `${kind.base}-${n}`;
      await tx.baleKind.create({ data: { tenantId, code, key: kind.key, name: kind.name, category: kind.category, grade: kind.grade, weightKg: kind.weightKg, pieces: kind.pieces } });
      byKey.set(kind.key, code);
      used.add(code);
    }
    out.push(code);
  }
  return out;
}

/**
 * Bales saved before shared codes get their kind and code, oldest first, by the same rule as a new import.
 * Runs when the server starts; does nothing once every bale has a code. Returns how many bales it changed.
 */
export async function backfillKinds(prisma: PrismaClient): Promise<number> {
  const shops = await prisma.bale.findMany({ where: { kindCode: null }, distinct: ['tenantId'], select: { tenantId: true } });
  let changed = 0;
  for (const { tenantId } of shops) {
    changed += await prisma.$transaction(
      async (tx) => {
        const bales = await tx.bale.findMany({
          where: { tenantId, kindCode: null },
          select: { id: true, item: true, category: true, grade: true, weightKg: true, pieces: true },
          orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
        });
        const codes = await kindCodes(tx, tenantId, bales);
        const idsByCode = new Map<string, string[]>();
        bales.forEach((b, i) => idsByCode.set(codes[i], [...(idsByCode.get(codes[i]) ?? []), b.id]));
        for (const [kindCode, ids] of idsByCode) await tx.bale.updateMany({ where: { tenantId, id: { in: ids }, kindCode: null }, data: { kindCode } });
        return bales.length;
      },
      { timeout: 120_000 },
    );
  }
  return changed;
}
