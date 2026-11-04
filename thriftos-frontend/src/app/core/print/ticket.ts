/**
 * A printout described as simple blocks (title, text, two-column rows, rules, QR codes), drawn onto a canvas at the
 * printer's resolution. The same picture goes to a Bluetooth printer, the print dialog (or PDF) and WhatsApp.
 */

export type Size = 'sm' | 'md' | 'lg' | 'xl';
export type Block =
  | { kind: 'text'; text: string; size?: Size; bold?: boolean; align?: 'start' | 'center' | 'end' }
  | { kind: 'row'; start: string; end: string; size?: Size; bold?: boolean }
  | { kind: 'rule'; dashed?: boolean }
  | { kind: 'space'; dots: number }
  | { kind: 'qr'; svg: string; dots: number; caption?: string }
  /** A bale sticker: QR on one side, a few lines beside it. */
  | { kind: 'sticker'; svg: string; lines: Array<{ text: string; size?: Size; bold?: boolean }> };

export interface Ticket {
  blocks: Block[];
  /** Urdu tickets are laid out right to left. */
  dir: 'ltr' | 'rtl';
  /** Fixed height in dots (stickers); receipts grow with their content. */
  height?: number;
}

/** Font sizes in dots for 58 mm paper (384 dots); 80 mm scales up. */
const SIZE: Record<Size, number> = { sm: 19, md: 23, lg: 28, xl: 38 };
const FONT = "Inter, 'Noto Naskh Arabic', system-ui, sans-serif";
const RTL_CHARS = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function hasRtl(text: string): boolean {
  return RTL_CHARS.test(text);
}

/** Splits text into lines that fit `width` (by words; a very long word is cut). */
export function wrap(measure: (s: string) => number, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (measure(line) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

async function svgImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  return img;
}

/** Draws the ticket `width` dots wide. Fonts must be loaded (they are bundled with the app). */
export async function renderTicket(ticket: Ticket, width: number): Promise<HTMLCanvasElement> {
  const scale = width / 384;
  const pad = Math.round(4 * scale);
  const inner = width - pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = ticket.height ?? 6000;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textBaseline = 'top';
  await document.fonts?.ready;

  const rtl = ticket.dir === 'rtl';
  const startX = rtl ? width - pad : pad;
  const endX = rtl ? pad : width - pad;
  const font = (size: Size = 'md', bold = false) => {
    const px = Math.round(SIZE[size] * scale);
    ctx.font = `${bold ? 700 : 500} ${px}px ${FONT}`;
    return px;
  };
  const dirOf = (text: string): CanvasDirection => (hasRtl(text) ? 'rtl' : rtl ? 'rtl' : 'ltr');
  /** Draws text so that its start (in reading order) is at x. */
  const draw = (text: string, x: number, y: number, align: CanvasTextAlign) => {
    ctx.direction = dirOf(text);
    // 'left'/'right' are absolute; convert the ticket's start/end into them.
    const abs: CanvasTextAlign = align === 'center' ? 'center' : (align === 'start') !== rtl ? 'left' : 'right';
    ctx.textAlign = abs;
    ctx.fillText(text, x, y);
  };

  let y = pad;
  for (const block of ticket.blocks) {
    if (block.kind === 'space') {
      y += Math.round(block.dots * scale);
    } else if (block.kind === 'rule') {
      ctx.lineWidth = Math.max(2, Math.round(2 * scale));
      ctx.setLineDash(block.dashed ? [8 * scale, 6 * scale] : []);
      ctx.beginPath();
      ctx.moveTo(pad, y + 6 * scale);
      ctx.lineTo(width - pad, y + 6 * scale);
      ctx.stroke();
      ctx.setLineDash([]);
      y += Math.round(14 * scale);
    } else if (block.kind === 'text') {
      const px = font(block.size, block.bold);
      const align = block.align ?? 'start';
      const x = align === 'center' ? width / 2 : align === 'start' ? startX : endX;
      for (const line of wrap((s) => ctx.measureText(s).width, block.text, inner)) {
        draw(line, x, y, align);
        y += Math.round(px * 1.35);
      }
    } else if (block.kind === 'row') {
      const px = font(block.size, block.bold);
      const endWidth = ctx.measureText(block.end).width;
      const startLines = wrap((s) => ctx.measureText(s).width, block.start, Math.max(inner * 0.4, inner - endWidth - 12 * scale));
      draw(block.end, endX, y, 'end');
      for (const line of startLines) {
        draw(line, startX, y, 'start');
        y += Math.round(px * 1.35);
      }
    } else if (block.kind === 'qr') {
      const size = Math.round(block.dots * scale);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(await svgImage(block.svg), (width - size) / 2, y, size, size);
      y += size + Math.round(4 * scale);
      if (block.caption) {
        const px = font('sm');
        draw(block.caption, width / 2, y, 'center');
        y += Math.round(px * 1.35);
      }
    } else if (block.kind === 'sticker') {
      const height = (ticket.height ?? 240) - pad * 2;
      const qr = Math.min(height, Math.round(width * 0.48));
      ctx.imageSmoothingEnabled = false;
      const qrX = rtl ? width - pad - qr : pad;
      ctx.drawImage(await svgImage(block.svg), qrX, pad + (height - qr) / 2, qr, qr);
      const textWidth = width - qr - pad * 3;
      const textX = rtl ? width - pad * 2 - qr : pad * 2 + qr;
      let ty = pad;
      for (const line of block.lines) {
        const px = font(line.size ?? 'md', line.bold);
        const [first] = wrap((s) => ctx.measureText(s).width, line.text, textWidth);
        if (ty + px > pad + height) break;
        draw(first ?? '', textX, ty, 'start');
        ty += Math.round(px * 1.25);
      }
      y = pad + height;
    }
  }

  const finalHeight = ticket.height ?? Math.ceil(y + pad);
  if (finalHeight === canvas.height) return canvas;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = finalHeight;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
}
