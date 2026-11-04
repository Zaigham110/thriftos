/**
 * ESC/POS for the cheap Bluetooth thermal printers used in markets (58 mm and 80 mm, 203 dpi). Everything is sent as
 * a picture (GS v 0 raster), because these printers have no Urdu font: one path prints Urdu, English and QR codes alike.
 */

/** Printable width in dots at 203 dpi (8 dots per mm): 58 mm paper → 48 mm, 80 mm paper → 72 mm. */
export const PAPER_DOTS = { 58: 384, 80: 576 } as const;
export type PaperWidth = keyof typeof PAPER_DOTS;

/** A 1-bit picture: `bits[y * width + x]` is 1 for black. */
export interface MonoImage {
  width: number;
  height: number;
  bits: Uint8Array;
}

/** Dark pixels (and not transparent) become black. Width is rounded up to whole bytes, padded white. */
export function toMono(data: { width: number; height: number; data: Uint8ClampedArray | number[] }, threshold = 160): MonoImage {
  const width = Math.ceil(data.width / 8) * 8;
  const bits = new Uint8Array(width * data.height);
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const i = (y * data.width + x) * 4;
      const a = data.data[i + 3] / 255;
      // Composite on white, then luminance.
      const lum = (0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) bits[y * width + x] = 1;
    }
  }
  return { width, height: data.height, bits };
}

/** GS v 0 raster in bands (many printers have a small buffer), each row packed 8 dots per byte, MSB first. */
export function rasterCommands(img: MonoImage, band = 128): Uint8Array[] {
  const bytesPerRow = img.width / 8;
  const out: Uint8Array[] = [];
  for (let top = 0; top < img.height; top += band) {
    const rows = Math.min(band, img.height - top);
    const cmd = new Uint8Array(8 + bytesPerRow * rows);
    cmd.set([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8]);
    for (let y = 0; y < rows; y++) {
      for (let xb = 0; xb < bytesPerRow; xb++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          if (img.bits[(top + y) * img.width + xb * 8 + bit]) byte |= 0x80 >> bit;
        }
        cmd[8 + y * bytesPerRow + xb] = byte;
      }
    }
    out.push(cmd);
  }
  return out;
}

export const INIT = Uint8Array.of(0x1b, 0x40); // ESC @
export const feed = (lines: number) => Uint8Array.of(0x1b, 0x64, Math.max(0, Math.min(255, lines))); // ESC d n
export const CUT = Uint8Array.of(0x1d, 0x56, 0x42, 0x00); // GS V B 0: feed to the cutter and cut (ignored without one)

/** One printout: reset, the picture, a few blank lines to tear off, cut. */
export function ticketBytes(img: MonoImage, opts: { cut?: boolean; feedLines?: number } = {}): Uint8Array {
  const parts = [INIT, ...rasterCommands(img), feed(opts.feedLines ?? 3)];
  if (opts.cut ?? true) parts.push(CUT);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  return bytes;
}

/** Splits bytes into pieces small enough for one Bluetooth write. */
export function chunks(bytes: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size));
  return out;
}
