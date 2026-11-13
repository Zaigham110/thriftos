import { Workbook } from 'exceljs';
import { D, Dec, fail } from '../common/util';

/**
 * Reads a shipment's bale list: an Excel or CSV file with one bale per row. Suppliers' lists differ, so headers are
 * matched by many names, title rows above the header are skipped and amounts like "Rs 1,25,000" are understood.
 * Pure (no database), so it is unit tested.
 */

export interface BaleColumn {
  key: 'baleNo' | 'item' | 'category' | 'grade' | 'brand' | 'weightKg' | 'pieces' | 'cost' | 'salePrice' | 'piecePrice' | 'notes';
  label: string;
  required?: boolean;
  aliases: string[];
  example: string;
  help: string;
}

export const BALE_COLUMNS: BaleColumn[] = [
  { key: 'baleNo', label: 'Bale no', aliases: ['bale', 'bale number', 'bale id', 'no', 'sr', 'sr no', 'serial', 'serial no', 's no', 'mark', 'گانٹھ نمبر'], example: 'TX-1001', help: 'The number on the bale. Each number once.' },
  { key: 'item', label: 'Item', required: true, aliases: ['description', 'product', 'product name', 'name', 'article', 'goods', 'item name', 'مال', 'تفصیل'], example: 'Mens jeans', help: 'What is in the bale. Needed.' },
  { key: 'category', label: 'Category', aliases: ['type', 'kind', 'group', 'قسم'], example: 'Jeans', help: 'Optional. Used to filter stock.' },
  { key: 'grade', label: 'Grade', aliases: ['quality', 'گریڈ'], example: 'A', help: 'Optional.' },
  { key: 'brand', label: 'Brand', aliases: ['label', 'make'], example: 'Mixed', help: 'Optional.' },
  { key: 'weightKg', label: 'Weight kg', aliases: ['weight', 'kg', 'kgs', 'net weight', 'wt', 'وزن'], example: '45', help: 'Optional. Shipment charges are shared by weight when every bale has one.' },
  { key: 'pieces', label: 'Pieces', aliases: ['pcs', 'pc', 'piece', 'qty', 'quantity', 'count', 'no of pieces', 'پیس'], example: '120', help: 'Optional. How many pieces are inside.' },
  { key: 'cost', label: 'Cost', aliases: ['purchase', 'purchase price', 'bale cost', 'cost price', 'amount', 'rate', 'لاگت'], example: '28000', help: 'What this bale cost you. Fill it for every bale, or leave the column empty and type the total on the shipment.' },
  { key: 'salePrice', label: 'Bale sale price', aliases: ['sale price', 'selling price', 'price', 'bale price', 'قیمت'], example: '36000', help: 'Optional. Your price for the whole bale.' },
  { key: 'piecePrice', label: 'Piece price', aliases: ['price per piece', 'pc price', 'retail price', 'retail', 'فی پیس'], example: '450', help: 'Optional. Your usual price for one piece.' },
  { key: 'notes', label: 'Notes', aliases: ['note', 'remarks', 'remark', 'comment'], example: '', help: 'Optional.' },
];

export const MAX_BALES = 3000;

export interface BaleRow {
  line: number; // row in the file, as the person sees it
  baleNo: string | null;
  item: string;
  category: string | null;
  grade: string | null;
  brand: string | null;
  weightKg: Dec | null;
  pieces: number | null;
  cost: Dec | null;
  salePrice: Dec | null;
  piecePrice: Dec | null;
  notes: string | null;
  errors: string[];
}

export interface BaleFile {
  rows: BaleRow[];
  /** Headers in the file that matched nothing, so the person knows they were not read. */
  ignoredHeaders: string[];
}

export function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matchHeaders(headers: string[]): Map<number, BaleColumn['key']> {
  const map = new Map<number, BaleColumn['key']>();
  const taken = new Set<string>();
  // Exact names first, so "Bale sale price" is not taken by the alias "bale".
  for (const exactOnly of [true, false]) {
    headers.forEach((header, index) => {
      if (map.has(index)) return;
      const h = norm(header);
      if (!h) return;
      const spec = BALE_COLUMNS.find((c) => !taken.has(c.key) && (exactOnly ? [c.label, c.key] : c.aliases).some((w) => norm(w) === h));
      if (spec) {
        map.set(index, spec.key);
        taken.add(spec.key);
      }
    });
  }
  return map;
}

/** One CSV line into cells; handles quotes and commas inside quotes. */
export function parseCsv(textIn: string): string[][] {
  const text = textIn.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    return '';
  }
  return String(value).trim();
}

async function readGrid(buffer: Buffer, fileName: string): Promise<string[][]> {
  if (/\.csv$/i.test(fileName)) return parseCsv(buffer.toString('utf8')).map((r) => r.map((c) => c.trim()));
  if (!/\.xlsx$/i.test(fileName)) fail('BAD_FILE', 'Choose an Excel file (.xlsx) or a CSV file.');
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    fail('BAD_FILE', 'This file could not be opened. Save it as Excel (.xlsx) and try again.');
  }
  const sheet = workbook.worksheets.find((s) => s.actualRowCount > 0);
  if (!sheet) fail('EMPTY_FILE', 'The file has no rows.');
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value);
    });
    grid[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
  });
  return Array.from(grid, (r) => r ?? []);
}

function number(raw: string, label: string, errors: string[]): Dec | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    errors.push(`${label} "${raw}" is not a number.`);
    return null;
  }
  return new D(cleaned).toDecimalPlaces(2);
}

export async function readBaleFile(buffer: Buffer, fileName: string): Promise<BaleFile> {
  const grid = await readGrid(buffer, fileName);

  // The header is the first of the top rows that names the Item column; lists often start with a title.
  let headerAt = -1;
  let columns = new Map<number, BaleColumn['key']>();
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const map = matchHeaders(grid[i]);
    if ([...map.values()].includes('item')) {
      headerAt = i;
      columns = map;
      break;
    }
  }
  if (headerAt < 0) fail('NO_ITEM_COLUMN', 'The file needs a column named "Item" (or Description). Download the sample file to see the columns.');
  const ignoredHeaders = grid[headerAt].filter((h, i) => h && !columns.has(i));

  const rows: BaleRow[] = [];
  const seen = new Map<string, number>();
  for (let i = headerAt + 1; i < grid.length; i++) {
    const cells: Partial<Record<BaleColumn['key'], string>> = {};
    columns.forEach((key, index) => (cells[key] = (grid[i][index] ?? '').trim()));
    if (Object.values(cells).every((v) => !v)) continue;
    // A "Total" line under the list is not a bale.
    if (!cells.item && /^(grand )?total/i.test(grid[i].find((c) => c) ?? '')) continue;

    const line = i + 1;
    const errors: string[] = [];
    if (!cells.item) errors.push('Item is missing.');
    else if (cells.item.length > 120) errors.push('Item is too long (120 letters at most).');

    const baleNo = cells.baleNo || null;
    if (baleNo) {
      const first = seen.get(baleNo.toLowerCase());
      if (first) errors.push(`Bale no "${baleNo}" is also on row ${first}.`);
      else seen.set(baleNo.toLowerCase(), line);
    }

    const weightKg = number(cells.weightKg ?? '', 'Weight', errors);
    const piecesDec = number(cells.pieces ?? '', 'Pieces', errors);
    if (piecesDec && (!piecesDec.isInteger() || piecesDec.lessThan(1))) errors.push('Pieces must be a whole number.');

    rows.push({
      line,
      baleNo,
      item: (cells.item ?? '').slice(0, 120),
      category: cells.category || null,
      grade: cells.grade || null,
      brand: cells.brand || null,
      weightKg: weightKg && weightKg.greaterThan(0) ? weightKg : null,
      pieces: piecesDec && piecesDec.isInteger() && piecesDec.greaterThan(0) ? piecesDec.toNumber() : null,
      cost: number(cells.cost ?? '', 'Cost', errors),
      salePrice: number(cells.salePrice ?? '', 'Bale sale price', errors),
      piecePrice: number(cells.piecePrice ?? '', 'Piece price', errors),
      notes: cells.notes ? cells.notes.slice(0, 200) : null,
      errors,
    });
  }
  if (rows.length === 0) fail('EMPTY_FILE', 'No bales were found under the header row.');
  if (rows.length > MAX_BALES) fail('TOO_MANY', `A file can hold ${MAX_BALES} bales at most. Split it in two.`);
  return { rows, ignoredHeaders };
}

/** The sample file a shop downloads, fills and uploads. */
export async function baleTemplate(): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Bale list');
  sheet.columns = BALE_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 4) }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(Object.fromEntries(BALE_COLUMNS.map((c) => [c.key, c.example])));
  sheet.addRow({ baleNo: 'TX-1002', item: 'Ladies tops', category: 'Tops', grade: 'A', weightKg: '40', pieces: '200', cost: '22000', salePrice: '29000', piecePrice: '250' });
  const help = workbook.addWorksheet('How to fill');
  help.columns = [{ header: 'Column', width: 20 }, { header: 'What to write', width: 90 }];
  help.getRow(1).font = { bold: true };
  BALE_COLUMNS.forEach((c) => help.addRow([c.label, c.help]));
  help.addRow([]);
  help.addRow(['', 'One row is one bale. Delete the two sample rows before you upload.']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
