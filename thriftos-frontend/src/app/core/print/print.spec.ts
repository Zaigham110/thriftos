import { CUT, INIT, chunks, rasterCommands, ticketBytes, toMono } from './escpos';
import { hasRtl, renderTicket, wrap } from './ticket';

describe('thermal printing (v2 6.3)', () => {
  it('turns dark pixels into black dots, transparent and light ones into white', () => {
    // 3 px wide, 1 row: black, light grey, transparent black
    const img = toMono({ width: 3, height: 1, data: [0, 0, 0, 255, 220, 220, 220, 255, 0, 0, 0, 0] });
    expect(img.width).toBe(8); // padded to whole bytes
    expect(Array.from(img.bits.slice(0, 3))).toEqual([1, 0, 0]);
  });

  it('packs rows into GS v 0 bands, 8 dots per byte, first dot in the top bit', () => {
    const bits = new Uint8Array(16 * 3);
    bits[0] = 1; // row 0, dot 0
    bits[16 + 15] = 1; // row 1, dot 15
    const [first, second] = rasterCommands({ width: 16, height: 3, bits }, 2);
    expect(Array.from(first.slice(0, 8))).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 2, 0]);
    expect(Array.from(first.slice(8))).toEqual([0x80, 0x00, 0x00, 0x01]);
    expect(Array.from(second.slice(0, 8))).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 1, 0]);
  });

  it('starts with a reset and ends with a cut, or without one for stickers', () => {
    const img = { width: 8, height: 1, bits: new Uint8Array(8) };
    const bytes = ticketBytes(img);
    expect(Array.from(bytes.slice(0, 2))).toEqual(Array.from(INIT));
    expect(Array.from(bytes.slice(-4))).toEqual(Array.from(CUT));
    expect(Array.from(ticketBytes(img, { cut: false, feedLines: 0 }).slice(-3))).toEqual([0x1b, 0x64, 0]);
  });

  it('splits bytes for Bluetooth writes', () => {
    expect(chunks(new Uint8Array(45), 20).map((c) => c.length)).toEqual([20, 20, 5]);
  });

  it('wraps by words and cuts a word longer than the line', () => {
    const measure = (s: string) => s.length;
    expect(wrap(measure, 'Jeans A grade bale from Texas', 10)).toEqual(['Jeans A', 'grade bale', 'from Texas']);
    expect(wrap(measure, 'ABCDEFGHIJKL', 5)).toEqual(['ABCDE', 'FGHIJ', 'KL']);
  });

  it('knows Urdu text', () => {
    expect(hasRtl('حاجی رفیق')).toBeTrue();
    expect(hasRtl('Haji Rafiq 0300')).toBeFalse();
  });

  it('draws a receipt the paper width wide, as tall as its content, and a sticker 50 × 30 mm', async () => {
    const receipt = await renderTicket(
      { dir: 'rtl', blocks: [{ kind: 'text', text: 'المدینہ ٹریڈرز', size: 'xl', bold: true, align: 'center' }, { kind: 'rule' }, { kind: 'row', start: 'کل', end: 'Rs 60,000', bold: true }] },
      576,
    );
    expect(receipt.width).toBe(576);
    expect(receipt.height).toBeGreaterThan(60);
    expect(receipt.height).toBeLessThan(400);
    const ink = toMono(receipt.getContext('2d')!.getImageData(0, 0, receipt.width, receipt.height)).bits.reduce((n, b) => n + b, 0);
    expect(ink).toBeGreaterThan(500); // text and the rule are really drawn

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1"/></svg>';
    const sticker = await renderTicket({ dir: 'ltr', height: 240, blocks: [{ kind: 'sticker', svg, lines: [{ text: 'B-000123', size: 'lg', bold: true }] }] }, 384);
    expect([sticker.width, sticker.height]).toEqual([384, 240]);
  });
});
