import { billRows } from '../kinds';
import { moneySign } from '../money-sign';
import type { Sale, Shop } from '../core';
import type { ReceiptModel } from './escpos';

const num = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
};
const METHOD: Record<string, string> = { CASH: 'Cash', BANK: 'Bank / card', WALLET: 'Easypaisa / JazzCash' };

export function when(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** One description of a bill, used by both the thermal printer and the print window, so they always agree. */
export function receiptModel(sale: Sale, shop: Shop, branch: { name: string; address: string | null; city: string | null; phone: string | null } | null): ReceiptModel {
  // A branch with its own address prints that; otherwise the shop's. Never one's street with the other's city.
  const place = branch?.address ? [branch.address, branch.city] : [shop.address, shop.address ? shop.city : (branch?.city ?? shop.city)];
  const header = [place.filter(Boolean).join(', '), branch?.phone ?? shop.phone ?? '', [shop.ntn ? `NTN ${shop.ntn}` : '', shop.strn ? `STRN ${shop.strn}` : ''].filter(Boolean).join('  ')].filter(Boolean);
  const meta: [string, string][] = [
    ['Bill', sale.code],
    ['Date', when(sale.soldAt)],
  ];
  if (sale.user?.name) meta.push(['Cashier', sale.user.name]);
  if (sale.customerName) meta.push(['Customer', sale.customerName]);
  if (sale.customerPhone) meta.push(['Phone', sale.customerPhone]);

  // Whole bales of the same kind at the same price are one row with a quantity: JEANS-1-45 x 5.
  const lines = billRows(sale.lines ?? []).map((r) => {
    const what = r.kind === 'BALE' && !r.key ? 'whole bale' : r.kind === 'BALE' ? `x ${r.quantity} @ ${num(r.unitPrice)}` : `${r.quantity} x ${num(r.unitPrice)}`;
    const less = r.discount > 0 ? `, less ${num(r.discount)}` : '';
    return { name: r.name, detail: `${r.code ? `${r.code} ` : ''}${what}${less}`, total: num(r.total) };
  });

  const totals: ReceiptModel['totals'] = [];
  const tax = Number(sale.taxAmount);
  if (Number(sale.discount) > 0 || tax > 0) totals.push({ label: 'Subtotal', value: num(sale.subtotal) });
  if (Number(sale.discount) > 0) totals.push({ label: 'Discount', value: `-${num(sale.discount)}` });
  if (tax > 0) totals.push({ label: `${sale.taxName ?? 'Tax'} ${num(sale.taxRate)}%${sale.taxInclusive ? ' (included)' : ''}`, value: num(sale.taxAmount) });
  totals.push({ label: 'TOTAL', value: `${moneySign.value} ${num(sale.total)}`, big: true });

  const payments: [string, string][] = (sale.payments ?? []).map((p) => [METHOD[p.method] ?? p.method, num(Number(p.amount) + (p.method === 'CASH' ? Number(sale.changeGiven) : 0))]);
  if (Number(sale.changeGiven) > 0) payments.push(['Give back', num(sale.changeGiven)]);
  if (Number(sale.creditAmount) > 0) payments.push(['On khata', num(sale.creditAmount)]);

  const notes: string[] = [];
  if (Number(sale.exchangeAmount ?? 0) > 0) notes.push(`Paid by goods brought back${sale.exchangeOf ? ` (${sale.exchangeOf.code})` : ''}: ${moneySign.value} ${num(sale.exchangeAmount!)}`);
  if (sale.status === 'CANCELLED') notes.push('*** CANCELLED ***');
  if (Number(sale.returnedTotal) > 0) notes.push(`Returned: ${moneySign.value} ${num(sale.returnedTotal)}`);
  if (sale.note) notes.push(sale.note);

  return { title: shop.name, header, meta, lines, totals, payments, notes, footer: [shop.billFooter || 'Thank you. Come again.'], barcode: sale.code };
}

/** The bill as plain words, for WhatsApp. */
export function receiptText(m: ReceiptModel): string {
  return [
    `*${m.title}*`,
    ...m.meta.map(([k, v]) => `${k}: ${v}`),
    '',
    ...m.lines.map((l) => `${l.name} (${l.detail}) = ${l.total}`),
    '',
    ...m.totals.map((t) => (t.big ? `*${t.label}: ${t.value}*` : `${t.label}: ${t.value}`)),
    ...m.payments.map(([k, v]) => `${k}: ${v}`),
    ...m.notes,
    '',
    ...m.footer,
  ].join('\n');
}
