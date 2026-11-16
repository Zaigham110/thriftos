import { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Latin letters and digits of a name, upper case ("T-Shirts (kids)" → "TSHIRTSKID"). */
const word = (name: string | null | undefined, max: number): string => (name ?? '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, max);

/**
 * The code bales of one kind share (owner, 2026-11-16): CATEGORY-GRADE-KG, e.g. JEANS-1-45; a bale counted in
 * pieces ends in its pieces, JEANS-1-200P. A grade named "Grade A" reads A. A name with no Latin letters reads "K". The same rule is written in
 * SQL in the migration that named the bales made before this (20261122100000_v10_02_bale_kinds).
 */
export function kindCode(category: string, grade: string | null, weightKg: Prisma.Decimal, pieces: number): string {
  return [word(category, 10) || 'K', word((grade ?? '').replace(/^\s*grade\s*/i, ''), 6), weightKg.greaterThan(0) ? weightKg.toString() : '', pieces > 0 ? `${pieces}P` : ''].filter(Boolean).join('-');
}

export const kindKey = (categoryId: string, gradeId: string | null, weightKg: Prisma.Decimal, pieces: number): string =>
  `${categoryId}|${gradeId ?? ''}|${weightKg.toString()}|${pieces}`;

/** The text inside a kind's QR: unique across businesses by the company code. */
export const kindQr = (companyCode: string, code: string): string => `KIND:${companyCode}:${code}`;

/** The kind code inside a scanned text ("KIND:ACME:JEANS-1-45" → "JEANS-1-45"), or the text itself when typed. */
export const kindCodeOf = (scanned: string): string => (scanned.startsWith('KIND:') ? scanned.split(':').slice(2).join(':') : scanned).trim().toUpperCase();

/**
 * The kind of a bale, made the first time such a bale is made. Its code never changes afterwards (stickers are
 * printed with it), even if the category is renamed. Two kinds whose names give the same code: the later one
 * ends in -2, -3…
 */
export async function kindFor(db: Db, tenantId: string, bale: { categoryId: string; gradeId: string | null; weightKg: Prisma.Decimal; pieces: number }): Promise<{ id: string; code: string }> {
  const weightKg = bale.weightKg.toDecimalPlaces(2);
  const key = kindKey(bale.categoryId, bale.gradeId, weightKg, bale.pieces);
  const found = await db.baleKind.findUnique({ where: { tenantId_key: { tenantId, key } }, select: { id: true, code: true } });
  if (found) return found;
  const [category, grade] = await Promise.all([
    db.category.findFirstOrThrow({ where: { id: bale.categoryId, tenantId }, select: { name: true } }),
    bale.gradeId ? db.grade.findFirst({ where: { id: bale.gradeId, tenantId }, select: { name: true } }) : null,
  ]);
  const base = kindCode(category.name, grade?.name ?? null, weightKg, bale.pieces);
  const taken = new Set((await db.baleKind.findMany({ where: { tenantId, code: { startsWith: base } }, select: { code: true } })).map((k) => k.code));
  let code = base;
  for (let n = 2; taken.has(code); n++) code = `${base}-${n}`;
  return db.baleKind.create({
    data: { tenantId, categoryId: bale.categoryId, gradeId: bale.gradeId, weightKg, pcsCount: bale.pieces, key, code },
    select: { id: true, code: true },
  });
}
