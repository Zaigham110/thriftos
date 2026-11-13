/**
 * ESC/POS: the command language of thermal receipt printers (Epson, Xprinter, Bixolon, Star in ESC/POS mode, and the
 * common 80 mm / 58 mm printers sold in Pakistan). This file only builds bytes; sending them is in printer.ts.
 */
export interface ReceiptModel {
  title: string;
  header: string[];
  meta: [string, string][];
  lines: { name: string; detail: string; total: string }[];
  totals: { label: string; value: string; big?: boolean }[];
  payments: [string, string][];
  notes: string[];
  footer: string[];
  barcode: string;
}

const ESC = 0x1b;
const GS = 0x1d;

/** Thermal printers print one-byte characters. Anything else becomes a plain look-alike or "?". */
export function plain(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/·/g, '-')
    .replace(/[^\x20-\x7e]/g, '?');
}

export class EscPos {
  private readonly out: number[] = [];
  /** Letters per line: 48 on 80 mm paper, 32 on 58 mm. */
  readonly cols: number;

  constructor(cols: number) {
    this.cols = cols;
    this.out.push(ESC, 0x40); // start clean
  }

  raw(...bytes: number[]) {
    this.out.push(...bytes);
    return this;
  }
  text(s: string) {
    for (const ch of plain(s)) this.out.push(ch.charCodeAt(0));
    return this;
  }
  line(s = '') {
    return this.text(s).raw(0x0a);
  }
  align(where: 'left' | 'center' | 'right') {
    return this.raw(ESC, 0x61, where === 'left' ? 0 : where === 'center' ? 1 : 2);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** 1 = normal, 2 = double width and height. */
  size(n: 1 | 2) {
    return this.raw(GS, 0x21, n === 2 ? 0x11 : 0x00);
  }
  rule() {
    return this.line('-'.repeat(this.cols));
  }
  /** Words on the left, an amount on the right, on one line (the left part is cut if it is too long). */
  pair(left: string, right: string, cols = this.cols) {
    const r = plain(right);
    const room = Math.max(1, cols - r.length - 1);
    const l = plain(left).slice(0, room);
    return this.line(l + ' '.repeat(cols - l.length - r.length) + r);
  }
  /** Long words wrapped to the paper. */
  wrap(s: string) {
    const words = plain(s).split(/\s+/);
    let row = '';
    for (const w of words) {
      if (row && row.length + 1 + w.length > this.cols) {
        this.line(row);
        row = w;
      } else row = row ? `${row} ${w}` : w;
    }
    return row ? this.line(row) : this;
  }
  /** Code 128 barcode with the number printed under it. */
  barcode(data: string) {
    const d = plain(data);
    this.raw(GS, 0x68, 60, GS, 0x77, 2, GS, 0x48, 2); // height, width, number below
    this.raw(GS, 0x6b, 73, d.length + 2, 0x7b, 0x42); // CODE128, set B
    for (const ch of d) this.out.push(ch.charCodeAt(0));
    return this.raw(0x0a);
  }
  feed(lines: number) {
    return this.raw(ESC, 0x64, lines);
  }
  cut() {
    return this.raw(GS, 0x56, 66, 0);
  }
  /** Opens the cash drawer plugged into the printer (both drawer pins, for printers wired either way). */
  drawer() {
    return this.raw(ESC, 0x70, 0, 25, 250, ESC, 0x70, 1, 25, 250);
  }
  bytes(): Uint8Array {
    return Uint8Array.from(this.out);
  }
}

export function receiptBytes(m: ReceiptModel, cols: number, opts: { drawer?: boolean; cut?: boolean } = {}): Uint8Array {
  const p = new EscPos(cols);
  if (opts.drawer) p.drawer();
  p.align('center').bold(true).size(2).line(m.title.slice(0, Math.floor(cols / 2))).size(1).bold(false);
  for (const h of m.header) p.wrap(h);
  p.align('left').rule();
  for (const [k, v] of m.meta) p.pair(k, v);
  p.rule();
  for (const l of m.lines) {
    p.bold(true).pair(l.name, l.total).bold(false);
    if (l.detail) p.line(`  ${l.detail}`.slice(0, cols));
  }
  p.rule();
  for (const t of m.totals) {
    if (t.big) p.bold(true).size(2).pair(t.label, t.value, Math.floor(cols / 2)).size(1).bold(false);
    else p.pair(t.label, t.value);
  }
  if (m.payments.length) {
    p.rule();
    for (const [k, v] of m.payments) p.pair(k, v);
  }
  if (m.notes.length) {
    p.rule();
    for (const n of m.notes) p.wrap(n);
  }
  p.feed(1).align('center');
  if (m.barcode) p.barcode(m.barcode);
  for (const f of m.footer) p.wrap(f);
  p.feed(4);
  if (opts.cut !== false) p.cut();
  return p.bytes();
}

/** A plain printed page for the receipt printer: a shift report, a khata statement. */
export function reportBytes(title: string, sub: string[], rows: ([string, string] | null)[], cols: number): Uint8Array {
  const p = new EscPos(cols);
  p.align('center').bold(true).line(title).bold(false);
  for (const s of sub) p.wrap(s);
  p.align('left').rule();
  for (const r of rows) r ? p.pair(r[0], r[1]) : p.rule();
  return p.feed(4).cut().bytes();
}

export function drawerBytes(): Uint8Array {
  return new EscPos(48).drawer().bytes();
}
