// Shared bale codes: what a kind is called and how bill lines of one kind read as one row.
// Pure code with no imports, so it is tested without a browser (npm run test:hardware).

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What a bale is called on tiles, bills and stock rows: its category (or item, when it has none) and grade. */
export function kindName(b: { item: string; category: string | null; grade: string | null }): string {
  return [b.category || b.item, b.grade].filter(Boolean).join(' · ');
}

/** The code people see, scan and type: the kind's shared code (a bale saved before shared codes shows its own). */
export function shownCode(b: { code: string; kindCode?: string | null }): string {
  return b.kindCode || b.code;
}

/** Oldest first: the order in which whole bales of a kind are sold. */
export function oldestFirst<T extends { code: string; createdAt?: string }>(a: T, b: T): number {
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.code.localeCompare(b.code);
}

/**
 * Bill lines as people read them: whole bales of the same kind at the same price are one row with a quantity
 * (JEANS-1-45 x 5). Every other line stays as it is. The lines behind a row are kept for returns.
 */
export function billRows<L extends { kind: string; description: string; quantity: number; unitPrice: string; discount: string; lineTotal: string; bale?: { code: string; baleNo: string | null; kindCode?: string | null } | null }>(lines: L[]) {
  const rows: { key: string; code: string; name: string; kind: string; quantity: number; unitPrice: string; discount: number; total: number; lines: L[] }[] = [];
  for (const l of lines) {
    const code = l.bale ? shownCode(l.bale) : '';
    const key = l.kind === 'BALE' && l.bale?.kindCode ? `${l.bale.kindCode}@${Number(l.unitPrice)}` : '';
    const row = key ? rows.find((r) => r.key === key) : undefined;
    if (row) {
      row.quantity += l.quantity;
      row.discount = r2(row.discount + Number(l.discount));
      row.total = r2(row.total + Number(l.lineTotal));
      row.lines.push(l);
    } else rows.push({ key, code, name: l.description, kind: l.kind, quantity: l.quantity, unitPrice: l.unitPrice, discount: Number(l.discount), total: Number(l.lineTotal), lines: [l] });
  }
  return rows;
}
