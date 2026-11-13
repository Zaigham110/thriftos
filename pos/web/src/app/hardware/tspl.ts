/**
 * TSPL: the command language of sticker (label) printers such as TSC and the common Xprinter label models.
 * One sticker per bale: item, grade and weight, a Code 128 barcode of the shop's bale number, and the price.
 */
export interface LabelData {
  code: string;
  item: string;
  detail: string;
  price: string;
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
    out.push(
      `SIZE ${size.widthMm} mm,${size.heightMm} mm`,
      `GAP ${size.gapMm} mm,0 mm`,
      'DIRECTION 1',
      'CLS',
      `TEXT ${left},12,"2",0,1,1,"${safe(l.item).slice(0, letters)}"`,
      `TEXT ${left},40,"1",0,1,1,"${safe(l.detail).slice(0, Math.floor((w - left * 2) / 8))}"`,
      `BARCODE ${left},64,"128",${barcodeHeight},1,0,2,2,"${safe(l.code)}"`,
      `TEXT ${left},${64 + barcodeHeight + 30},"3",0,1,1,"${safe(l.price)}"`,
      'PRINT 1',
    );
  }
  return out.join('\r\n') + '\r\n';
}

export function labelBytes(labels: LabelData[], size: LabelSize): Uint8Array {
  return new TextEncoder().encode(labelText(labels, size));
}
