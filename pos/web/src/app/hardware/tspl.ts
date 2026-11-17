/**
 * TSPL: the command language of sticker (label) printers such as TSC and the common Xprinter label models.
 * One sticker per bale: what it is, a Code 128 barcode of its code (the kind's shared code, so every sticker of a
 * kind is the same), and the price. A code too long for bars on this sticker is printed as a QR code instead.
 */
export interface LabelData {
  code: string;
  item: string;
  detail: string;
  price: string;
}
/** What a sticker needs to know of a bale. */
export interface LabelBale {
  code: string;
  kindCode?: string | null;
  item: string;
  category: string | null;
  grade: string | null;
  weightKg: string | null;
  baleNo: string | null;
  salePrice: string | null;
}

const amount = (v: string, sign: string) => `${sign} ${Math.round(Number(v)).toLocaleString('en-US')}`;

/**
 * Every sticker of a kind is the same: the shared code, what the kind is, and the price. Nothing of the one bale
 * is on it. (A bale saved before shared codes, with only its own number, keeps the old sticker.)
 */
export function labelData(b: LabelBale, sign = 'Rs'): LabelData {
  if (b.kindCode) {
    return {
      code: b.kindCode,
      item: b.category || b.item,
      detail: [b.grade ? `Grade ${b.grade}` : '', b.weightKg ? `${+b.weightKg} kg` : ''].filter(Boolean).join(' - '),
      price: b.salePrice ? amount(b.salePrice, sign) : '',
    };
  }
  return {
    code: b.code,
    item: b.item,
    detail: [b.grade ? `Grade ${b.grade}` : '', b.weightKg ? `${b.weightKg} kg` : '', b.baleNo ?? ''].filter(Boolean).join(' - '),
    price: b.salePrice ? amount(b.salePrice, sign) : '',
  };
}

export interface LabelSize {
  widthMm: number;
  heightMm: number;
  gapMm: number;
}

const safe = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/"/g, "'");

export function labelText(labels: LabelData[], size: LabelSize): string {
  const dots = (mm: number) => Math.round(mm * 8); // 203 dpi printers: 8 dots per mm
  const w = dots(size.widthMm);
  const h = dots(size.heightMm);
  const left = 16;
  const letters = Math.max(8, Math.floor((w - left * 2) / 12)); // font "2" is 12 dots wide
  const out: string[] = [];
  for (const l of labels) {
    const barcodeHeight = Math.max(40, h - 150);
    // Code 128: 11 modules a letter plus start, check and stop. Wide bars if they fit, thin bars if not, else QR.
    const modules = (safe(l.code).length + 3) * 11 + 2;
    const bar = modules * 2 <= w - left * 2 ? 2 : modules <= w - left * 2 ? 1 : 0;
    out.push(
      `SIZE ${size.widthMm} mm,${size.heightMm} mm`,
      `GAP ${size.gapMm} mm,0 mm`,
      'DIRECTION 1',
      'CLS',
      `TEXT ${left},12,"2",0,1,1,"${safe(l.item).slice(0, letters)}"`,
      `TEXT ${left},40,"1",0,1,1,"${safe(l.detail).slice(0, Math.floor((w - left * 2) / 8))}"`,
      ...(bar
        ? [`BARCODE ${left},64,"128",${barcodeHeight},1,0,${bar},${bar},"${safe(l.code)}"`]
        : [`QRCODE ${left},64,M,${Math.max(3, Math.floor(barcodeHeight / 30))},A,0,"${safe(l.code)}"`, `TEXT ${left + barcodeHeight + 16},64,"1",0,1,1,"${safe(l.code)}"`]),
      `TEXT ${left},${64 + barcodeHeight + 30},"3",0,1,1,"${safe(l.price)}"`,
      'PRINT 1',
    );
  }
  return out.join('\r\n') + '\r\n';
}

export function labelBytes(labels: LabelData[], size: LabelSize): Uint8Array {
  return new TextEncoder().encode(labelText(labels, size));
}
