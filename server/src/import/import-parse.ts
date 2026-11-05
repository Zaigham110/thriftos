import { createHash } from 'crypto';
import { StockUnit } from '@prisma/client';
import { Workbook } from 'exceljs';

/**
 * Reading a business's old register (v2 6.1): Excel or CSV files typed by hand, with Urdu or English headers,
 * amounts like "Rs 1,25,000/-" or "1.25 lakh", phone numbers in any local format and blank rows in between.
 * Everything here is pure, so it is unit tested with messy real-world values.
 */

export type ImportKind = 'CUSTOMERS' | 'SUPPLIERS' | 'STOCK';
export const IMPORT_KINDS: ImportKind[] = ['CUSTOMERS', 'SUPPLIERS', 'STOCK'];
export const MAX_ROWS = 5000;

export interface ColumnSpec {
  key: string;
  en: string;
  ur: string;
  required?: boolean;
  /** Other words people write in the header row (lower case, English or Urdu). */
  aliases: string[];
  example: string;
  help: string;
}

export const COLUMNS: Record<ImportKind, ColumnSpec[]> = {
  CUSTOMERS: [
    { key: 'name', en: 'Name', ur: 'نام', required: true, aliases: ['customer', 'customer name', 'party', 'party name', 'buyer', 'گاہک', 'پارٹی', 'naam'], example: 'Haji Rafiq', help: 'The name you know them by. Each name once.' },
    { key: 'phone', en: 'Phone', ur: 'فون', aliases: ['mobile', 'whatsapp', 'number', 'phone number', 'cell', 'موبائل', 'نمبر', 'واٹس ایپ'], example: '0300-1234567', help: 'Any local format: 0300-1234567, 92 300 1234567, 3001234567.' },
    { key: 'city', en: 'City', ur: 'شہر', aliases: ['area', 'town', 'علاقہ', 'shehar'], example: 'Lahore', help: 'Optional.' },
    { key: 'openingBalance', en: 'Opening balance', ur: 'پرانا ادھار', aliases: ['udhaar', 'udhar', 'balance', 'opening balance', 'baqaya', 'baqi', 'due', 'ادھار', 'بقایا', 'باقی'], example: 'Rs 1,25,000', help: 'What they owe you today. "1,25,000", "Rs 125000/-" and "1.25 lakh" all work. An advance they paid you: write it with a minus, e.g. -5000.' },
    { key: 'creditLimit', en: 'Credit limit', ur: 'ادھار کی حد', aliases: ['limit', 'حد'], example: '200000', help: 'Optional. Most credit you allow.' },
    { key: 'notes', en: 'Notes', ur: 'نوٹ', aliases: ['note', 'remarks', 'تفصیل', 'ریمارکس'], example: 'Pays on Fridays', help: 'Optional.' },
  ],
  SUPPLIERS: [
    { key: 'name', en: 'Name', ur: 'نام', required: true, aliases: ['supplier', 'supplier name', 'vendor', 'company', 'سپلائر', 'کمپنی', 'naam'], example: 'Texas Recycling', help: 'Each name once.' },
    { key: 'country', en: 'Country', ur: 'ملک', aliases: ['origin', 'from', 'ملک سے'], example: 'USA', help: 'Where their containers come from.' },
    { key: 'contactPerson', en: 'Contact person', ur: 'رابطہ', aliases: ['contact', 'agent', 'ایجنٹ'], example: 'Mr Khan', help: 'Optional.' },
    { key: 'phone', en: 'Phone', ur: 'فون', aliases: ['mobile', 'whatsapp', 'number', 'موبائل', 'نمبر'], example: '+1 713 555 0100', help: 'Optional, any format.' },
    { key: 'notes', en: 'Notes', ur: 'نوٹ', aliases: ['note', 'remarks', 'ریمارکس'], example: '', help: 'Optional.' },
  ],
  STOCK: [
    { key: 'item', en: 'Item', ur: 'مال', aliases: ['name', 'description', 'stock', 'تفصیل', 'نام', 'maal'], example: 'Jeans A grade bale', help: 'What it is. Needed if there is no category.' },
    { key: 'category', en: 'Category', ur: 'قسم', aliases: ['type', 'kind', 'qism', 'کیٹیگری'], example: 'Jeans', help: 'Optional. Matched to your categories by name.' },
    { key: 'grade', en: 'Grade', ur: 'گریڈ', aliases: ['quality', 'کوالٹی'], example: 'A', help: 'Optional. Matched to your grades by name.' },
    { key: 'unit', en: 'Unit', ur: 'اکائی', required: true, aliases: ['in', 'uom', 'یونٹ'], example: 'bale', help: 'bale, kg or piece (گانٹھ، کلو، پیس).' },
    { key: 'quantity', en: 'Quantity', ur: 'تعداد', required: true, aliases: ['qty', 'count', 'bales', 'مقدار', 'tadaad'], example: '12', help: 'How many bales or pieces (whole numbers), or how many kg.' },
    { key: 'weightKg', en: 'Weight kg', ur: 'وزن کلو', aliases: ['weight', 'kg', 'وزن'], example: '540', help: 'Optional. Total weight of these bales.' },
    { key: 'totalCost', en: 'Total cost', ur: 'کل لاگت', aliases: ['cost', 'amount', 'total', 'purchase', 'لاگت', 'قیمت خرید', 'رقم'], example: 'Rs 3,60,000', help: 'What all of this cost you. Or fill "Cost per unit" instead.' },
    { key: 'unitCost', en: 'Cost per unit', ur: 'فی یونٹ لاگت', aliases: ['rate', 'unit cost', 'cost per bale', 'cost per kg', 'ریٹ'], example: '30000', help: 'Optional, used when there is no total cost.' },
    { key: 'salePrice', en: 'Sale price', ur: 'قیمت فروخت', aliases: ['price', 'selling price', 'sale rate', 'قیمت'], example: '36000', help: 'Optional. Your usual price per unit.' },
    { key: 'supplier', en: 'Supplier', ur: 'سپلائر', aliases: ['vendor', 'from', 'کمپنی'], example: 'Texas Recycling', help: 'Optional. A new name is added to your suppliers.' },
  ],
};

export type RawRow = { line: number; cells: Record<string, string | number> };

/** Lower case, Urdu digits to ASCII, spaces and punctuation collapsed. */
export function norm(text: string): string {
  return toAsciiDigits(text)
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // Arabic/Urdu diacritics
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function toAsciiDigits(text: string): string {
  return text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Finds which column each header cell is. A header may hold both languages, e.g. "Name / نام". */
export function matchHeaders(kind: ImportKind, headers: string[]): { map: Map<number, string>; missing: ColumnSpec[] } {
  const map = new Map<number, string>();
  const taken = new Set<string>();
  headers.forEach((header, index) => {
    const parts = [header, ...header.split(/[/|()\-–]/)].map(norm).filter(Boolean);
    const spec = COLUMNS[kind].find((c) => !taken.has(c.key) && [c.en, c.ur, c.key, ...c.aliases].map(norm).some((w) => parts.includes(w)));
    if (spec) {
      map.set(index, spec.key);
      taken.add(spec.key);
    }
  });
  const missing = COLUMNS[kind].filter((c) => c.required && !taken.has(c.key));
  return { map, missing };
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const NEGATIVE_WORDS = /\b(advance|adv|jama)\b|ایڈوانس|جمع/i;

/**
 * Reads an amount the way people write it in a register. Returns a plain decimal string, or null when there is no
 * number. Throws a plain-words message when the text cannot be a number.
 */
export function parseAmount(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  let text = toAsciiDigits(cleanText(value));
  if (!text || /^[-–—]+$/.test(text)) return null;
  let negative = /^\(.*\)$/.test(text) || /^[-–−]/.test(text) || NEGATIVE_WORDS.test(text);
  let multiplier = 1;
  if (/(lakh|lac|lacs|لاکھ)/i.test(text)) multiplier = 100_000;
  else if (/(crore|کروڑ)/i.test(text)) multiplier = 10_000_000;
  else if (/\d\s*k\b/i.test(text)) multiplier = 1000;
  text = text
    .replace(NEGATIVE_WORDS, '')
    .replace(/rs\.?|pkr|rupees?|روپے|روپیہ|lakh|lacs|lac|لاکھ|crore|کروڑ|\/-|=\/?|dr\b/gi, '')
    .replace(/(\d)\s*k\b/gi, '$1')
    .replace(/[(),\s'’]/g, '')
    .replace(/^[-–−+]/, '');
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`"${cleanText(value)}" is not an amount`);
  const amount = Number(text) * multiplier;
  if (amount > 1e12) throw new Error(`"${cleanText(value)}" is too large`);
  negative = negative && amount !== 0;
  return round2(negative ? -amount : amount);
}

function round2(n: number): string {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

export function parseQuantity(value: unknown): string | null {
  const amount = parseAmount(value);
  if (amount !== null && Number(amount) < 0) throw new Error('Quantity cannot be below zero');
  return amount;
}

const UNIT_WORDS: Array<[StockUnit, RegExp]> = [
  [StockUnit.BALE, /^(bales?|bale|b|gath|ghath|gaanth|ganth|گانٹھ|گٹھڑی|بیل|bundle)$/i],
  [StockUnit.KG, /^(kgs?|kilo|kilos|kilogram|kilograms|kg\.|کلو|کلوگرام)$/i],
  [StockUnit.PIECE, /^(pcs?|pieces?|piece|nag|adad|عدد|پیس|نگ|item|items)$/i],
];

export function parseUnit(value: unknown): StockUnit | null {
  const text = cleanText(value).replace(/\./g, '');
  if (!text) return null;
  const hit = UNIT_WORDS.find(([, re]) => re.test(text));
  if (!hit) throw new Error(`"${text}" is not a unit: write bale, kg or piece`);
  return hit[0];
}

/** Reads the first sheet with data (or a CSV) into header-keyed rows; blank rows are left out. */
export async function readRows(kind: ImportKind, buffer: Buffer, fileName: string): Promise<{ rows: RawRow[]; missing: ColumnSpec[]; unknownHeaders: string[] }> {
  const grid = /\.csv$/i.test(fileName) ? parseCsv(buffer.toString('utf8').replace(/^﻿/, '')) : await readXlsx(buffer);
  const headerIndex = grid.findIndex((r) => r.some((c) => cleanText(c)));
  if (headerIndex < 0) return { rows: [], missing: COLUMNS[kind].filter((c) => c.required), unknownHeaders: [] };
  const headers = grid[headerIndex].map((c) => cleanText(c));
  const { map, missing } = matchHeaders(kind, headers);
  const unknownHeaders = headers.filter((h, i) => h && !map.has(i));
  const rows: RawRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells: Record<string, string | number> = {};
    for (const [col, key] of map) {
      const v = grid[i][col];
      if (v !== undefined && v !== null && cleanText(v) !== '') cells[key] = typeof v === 'number' ? v : cleanText(v);
    }
    if (Object.keys(cells).length) rows.push({ line: i + 1, cells });
  }
  return { rows, missing, unknownHeaders };
}

async function readXlsx(buffer: Buffer): Promise<Array<Array<string | number>>> {
  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error('This file could not be read. Save it as Excel (.xlsx) or CSV and try again.');
  }
  for (const ws of wb.worksheets) {
    const grid: Array<Array<string | number>> = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: Array<string | number> = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellValue(cell.value, cell.text);
      });
      grid[rowNumber - 1] = cells;
    });
    for (let i = 0; i < grid.length; i++) grid[i] ??= [];
    if (grid.some((r) => r.some((c) => cleanText(c)))) return grid;
  }
  return [];
}

function cellValue(value: unknown, text: string): string | number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const v = value as { result?: unknown; richText?: Array<{ text: string }>; text?: string };
    if (typeof v.result === 'number') return v.result;
    if (v.result !== undefined) return String(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (typeof v.text === 'string') return v.text;
  }
  return text ?? '';
}

/** Small RFC 4180 reader: quotes, doubled quotes, commas and new lines inside quotes; ; or tab when there is no comma. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Same cleaned row → same key; the n-th identical row in a file gets its own key, so true repeats still import once each. */
export function rowKeys(kind: ImportKind, values: Array<Record<string, unknown>>): string[] {
  const seen = new Map<string, number>();
  return values.map((v) => {
    const base = createHash('sha256').update(`${kind}|${JSON.stringify(v, Object.keys(v).sort())}`).digest('hex').slice(0, 40);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  });
}
