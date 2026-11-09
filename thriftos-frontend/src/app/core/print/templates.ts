import { I18nService } from '../i18n/i18n.service';
import { Block, Ticket } from './ticket';

export interface BillPrint {
  business: string;
  /** Phone · address · city of the business (v2 review: Settings); null when not filled in. */
  businessContact?: string | null;
  saleNumber: string;
  date: string;
  customer: string;
  lines: Array<{ description: string; unit: 'KG' | 'BALE' | 'PIECE'; quantity: string; unitPrice: string; lineTotal: string }>;
  total: string;
  paid: string;
  due: string;
  customerBalance: string;
  billUrl: string | null;
  billQrSvg: string | null;
}

export interface ReceiptPrint {
  business: string;
  businessContact?: string | null;
  receiptNo: string;
  date: string;
  customer: string;
  amount: string;
  method: string;
  reference: string | null;
  saleNumber: string | null;
  receivedBy: string | null;
  balance: string;
  advance: string;
}

export interface LabelPrint {
  code: string;
  qrSvg: string;
  category: string | null;
  grade: string | null;
  weightKg: string;
  pieces: number;
  origin: string | null;
  business: string;
}

const UNIT: Record<string, string> = { KG: 'unit.kgShort', BALE: 'unit.bale', PIECE: 'unit.pcs' };

/** Date and time with Western digits in both languages, e.g. "4 Nov 2026, 5:16 pm". */
function when(value: string): string {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Keeps a number, code or date left-to-right inside an Urdu line (Unicode isolate). */
const ltr = (text: string) => `\u2066${text}\u2069`;

const ltrMoney = (i18n: I18nService, v: string) => ltr(i18n.money(v));

const dir = (i18n: I18nService): Ticket['dir'] => (i18n.lang() === 'ur' ? 'rtl' : 'ltr');

/** Sale bill: business, number and date, customer, one line per item, totals, the customer's balance, QR to the online bill. */
export function billTicket(b: BillPrint, i18n: I18nService): Ticket {
  const t = (k: string, p?: Record<string, string | number>) => i18n.t(k, p);
  const blocks: Block[] = [
    { kind: 'text', text: b.business, size: 'xl', bold: true, align: 'center' },
    ...(b.businessContact ? [{ kind: 'text' as const, text: b.businessContact, size: 'sm' as const, align: 'center' as const }] : []),
    { kind: 'text', text: `${t('bill.no', { no: ltr(b.saleNumber) })} · ${ltr(when(b.date))}`, size: 'sm', align: 'center' },
    { kind: 'text', text: `${t('bill.to')}: ${b.customer}`, size: 'md', bold: true, align: 'center' },
    { kind: 'rule' },
  ];
  for (const line of b.lines) {
    blocks.push({ kind: 'text', text: line.description, bold: true });
    blocks.push({ kind: 'row', start: ltr(`${i18n.num(line.quantity)} ${t(UNIT[line.unit] ?? '')} × ${i18n.num(line.unitPrice)}`), end: ltr(i18n.num(line.lineTotal)), size: 'sm' });
  }
  blocks.push({ kind: 'rule' });
  blocks.push({ kind: 'row', start: t('bill.total'), end: ltrMoney(i18n, b.total), size: 'lg', bold: true });
  blocks.push({ kind: 'row', start: t('bill.paid'), end: ltrMoney(i18n, b.paid) });
  if (+b.due > 0) blocks.push({ kind: 'row', start: t('bill.due'), end: ltrMoney(i18n, b.due), bold: true });
  blocks.push({ kind: 'rule', dashed: true });
  blocks.push({ kind: 'row', start: t('print.balanceNow'), end: ltrMoney(i18n, b.customerBalance), bold: true });
  if (b.billQrSvg) {
    blocks.push({ kind: 'space', dots: 10 });
    blocks.push({ kind: 'qr', svg: b.billQrSvg, dots: 150, caption: t('print.scanBill') });
  }
  blocks.push({ kind: 'space', dots: 6 });
  blocks.push({ kind: 'text', text: t('print.thanks'), size: 'sm', align: 'center' });
  return { blocks, dir: dir(i18n) };
}

/** Payment receipt: amount large, how it was paid, and what is still owed. */
export function receiptTicket(r: ReceiptPrint, i18n: I18nService): Ticket {
  const t = (k: string, p?: Record<string, string | number>) => i18n.t(k, p);
  const blocks: Block[] = [
    { kind: 'text', text: r.business, size: 'xl', bold: true, align: 'center' },
    ...(r.businessContact ? [{ kind: 'text' as const, text: r.businessContact, size: 'sm' as const, align: 'center' as const }] : []),
    { kind: 'text', text: t('print.receipt'), size: 'md', bold: true, align: 'center' },
    { kind: 'text', text: `${ltr(r.receiptNo)} · ${ltr(when(r.date))}`, size: 'sm', align: 'center' },
    { kind: 'rule' },
    { kind: 'row', start: t('print.from'), end: r.customer, bold: true },
    { kind: 'row', start: t('print.amount'), end: ltrMoney(i18n, r.amount), size: 'xl', bold: true },
    { kind: 'row', start: t('print.method'), end: t(`method.${r.method}`) },
  ];
  if (r.reference) blocks.push({ kind: 'row', start: t('print.reference'), end: ltr(r.reference), size: 'sm' });
  if (r.saleNumber) blocks.push({ kind: 'row', start: t('print.forBill'), end: ltr(r.saleNumber), size: 'sm' });
  blocks.push({ kind: 'rule', dashed: true });
  if (+r.advance > 0) blocks.push({ kind: 'row', start: t('print.advance'), end: ltrMoney(i18n, r.advance), bold: true });
  else blocks.push({ kind: 'row', start: t('print.balanceNow'), end: ltrMoney(i18n, r.balance), bold: true });
  if (r.receivedBy) blocks.push({ kind: 'text', text: t('print.receivedBy', { name: r.receivedBy }), size: 'sm' });
  blocks.push({ kind: 'space', dots: 6 });
  blocks.push({ kind: 'text', text: t('print.thanks'), size: 'sm', align: 'center' });
  return { blocks, dir: dir(i18n) };
}

/** Bale sticker, 50 × 30 mm (384 × 240 dots): QR, code, kind, kg, origin, business. */
export function labelTicket(l: LabelPrint, i18n: I18nService): Ticket {
  const kind = [l.category, l.grade].filter(Boolean).join(' · ');
  const kg = `${i18n.kg(l.weightKg)}${l.pieces ? ` · ${i18n.num(l.pieces)} ${i18n.t('unit.pcs')}` : ''}`;
  const lines = [
    { text: l.code, size: 'lg' as const, bold: true },
    ...(kind ? [{ text: kind, size: 'md' as const, bold: true }] : []),
    { text: kg, size: 'md' as const, bold: true },
    ...(l.origin ? [{ text: l.origin, size: 'sm' as const }] : []),
    { text: l.business, size: 'sm' as const },
  ];
  // Stickers stay left-to-right: codes and numbers read the same in both languages.
  return { blocks: [{ kind: 'sticker', svg: l.qrSvg, lines }], dir: 'ltr', height: 240 };
}
