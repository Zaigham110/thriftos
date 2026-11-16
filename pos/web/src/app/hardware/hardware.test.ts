// Run with: npm run test:hardware (node --test). Pure code only: no browser needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawerBytes, EscPos, plain, receiptBytes, type ReceiptModel } from './escpos.ts';
import { ScanDetector } from './scan-detector.ts';
import { billRows } from '../kinds.ts';
import { labelData, labelText } from './tspl.ts';

const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

test('ESC/POS: starts clean, aligns, cuts and kicks the drawer with the standard bytes', () => {
  const bytes = new EscPos(32).align('center').bold(true).line('Hi').cut().bytes();
  assert.deepEqual([...bytes], [0x1b, 0x40, 0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x48, 0x69, 0x0a, 0x1d, 0x56, 66, 0]);
  assert.deepEqual([...drawerBytes()], [0x1b, 0x40, 0x1b, 0x70, 0, 25, 250, 0x1b, 0x70, 1, 25, 250]);
});

test('ESC/POS: a pair fills the paper width exactly and cuts long names', () => {
  const p = new EscPos(32);
  p.pair('Mens jeans', 'Rs 40,000');
  p.pair('A very long item name that cannot fit on the paper', 'Rs 1');
  const rows = ascii(p.bytes().slice(2)).split('\n').filter(Boolean);
  assert.equal(rows[0], 'Mens jeans' + ' '.repeat(13) + 'Rs 40,000');
  assert.ok(rows.every((r) => r.length === 32));
  assert.ok(rows[1].endsWith(' Rs 1'));
});

test('ESC/POS: letters the printer does not have become plain ones', () => {
  assert.equal(plain('Café · 2 × 5 – “ok”'), 'Cafe - 2 x 5 - "ok"');
  assert.equal(plain('جینز'), '????');
});

test('ESC/POS: barcode is Code 128 set B with the right length byte', () => {
  const bytes = [...new EscPos(48).barcode('T1-000147').bytes()];
  const at = bytes.indexOf(0x6b);
  assert.deepEqual(bytes.slice(at - 1, at + 5), [0x1d, 0x6b, 73, 11, 0x7b, 0x42]);
  assert.equal(String.fromCharCode(...bytes.slice(at + 5, at + 14)), 'T1-000147');
});

test('ESC/POS: a whole receipt has every part, the drawer kick first and the cut last', () => {
  const m: ReceiptModel = {
    title: 'Lunda Bazaar',
    header: ['Shop 12, Landa Bazaar, Lahore', '0300 1112223'],
    meta: [['Bill', 'T1-000147'], ['Cashier', 'Bilal']],
    lines: [{ name: 'Mens jeans - A', detail: 'B-00001 whole bale', total: '40,000' }],
    totals: [{ label: 'Discount', value: '-1,000' }, { label: 'TOTAL', value: 'Rs 39,000', big: true }],
    payments: [['Cash', '40,000'], ['Give back', '1,000']],
    notes: [],
    footer: ['Thank you'],
    barcode: 'T1-000147',
  };
  const bytes = receiptBytes(m, 48, { drawer: true });
  const text = ascii(bytes);
  assert.deepEqual([...bytes.slice(0, 7)], [0x1b, 0x40, 0x1b, 0x70, 0, 25, 250]);
  for (const part of ['Lunda Bazaar', 'T1-000147', 'Mens jeans - A', 'B-00001 whole bale', 'TOTAL', 'Give back', 'Thank you']) assert.ok(text.includes(part), part);
  assert.deepEqual([...bytes.slice(-4)], [0x1d, 0x56, 66, 0]);
  assert.ok(!text.includes('TOTAL' + ' '.repeat(40)), 'the big total is laid out for double-width letters');
});

test('TSPL: one sticker per bale with size, barcode and price', () => {
  const text = labelText([{ code: 'B-00001', item: 'Mens "jeans"', detail: 'Grade A - 30 kg', price: 'Rs 40,000' }], { widthMm: 50, heightMm: 30, gapMm: 2 });
  const rows = text.split('\r\n');
  assert.equal(rows[0], 'SIZE 50 mm,30 mm');
  assert.equal(rows[1], 'GAP 2 mm,0 mm');
  assert.ok(rows.includes('CLS') && rows.includes('PRINT 1'));
  assert.ok(text.includes(`TEXT 16,12,"2",0,1,1,"Mens 'jeans'"`));
  assert.ok(text.includes('BARCODE 16,64,"128",90,1,0,2,2,"B-00001"'));
  assert.ok(text.endsWith('PRINT 1\r\n'));
});

const feed = (d: ScanDetector, text: string, gap: number, start = 1000) => {
  let t = start;
  let got: string | null = null;
  for (const key of [...text, 'Enter']) got = d.key(key, (t += gap));
  return got;
};

test('scanner: fast keys then Enter is a scan', () => {
  assert.equal(feed(new ScanDetector(), 'B-00001', 8), 'B-00001');
});

test('scanner: a person typing, even quickly, is not a scan', () => {
  assert.equal(feed(new ScanDetector(), 'B-00001', 120), null);
  assert.equal(feed(new ScanDetector(), 'ab', 8), null); // too short to be a sticker
});

test('scanner: typing followed by a scan gives only the scanned code', () => {
  const d = new ScanDetector();
  let t = 0;
  for (const key of 'jea') d.key(key, (t += 200));
  assert.equal(feed(d, 'B-00002', 8, t + 500), 'B-00002');
  assert.equal(feed(d, 'TX-3', 8, t + 5000), 'TX-3');
});

test('Shared codes: every sticker of one kind is the same, and carries the shared code', () => {
  const kind = { kindCode: 'JEANS-1-45', category: 'Jeans', grade: '1', weightKg: '45', salePrice: '40000' };
  const first = labelData({ ...kind, code: 'B-00001', item: 'Mens jeans', baleNo: 'TX-1' });
  const second = labelData({ ...kind, code: 'B-00002', item: 'Ladies jeans', baleNo: 'TX-9' });
  assert.deepEqual(first, second);
  assert.deepEqual(first, { code: 'JEANS-1-45', item: 'Jeans', detail: 'Grade 1 - 45 kg', price: 'Rs 40,000' });
  const size = { widthMm: 50, heightMm: 30, gapMm: 2 };
  assert.equal(labelText([first], size), labelText([second], size));
  assert.ok(labelText([first], size).includes('BARCODE 16,64,"128",90,1,0,2,2,"JEANS-1-45"'));
  // A bale saved before shared codes keeps its own number on the sticker.
  assert.equal(labelData({ code: 'B-00007', item: 'Old bale', category: null, grade: null, weightKg: null, baleNo: null, salePrice: null }).code, 'B-00007');
});

test('Shared codes: a long code gets thin bars, and a QR code when even those do not fit', () => {
  const size = { widthMm: 50, heightMm: 30, gapMm: 2 };
  const label = (code: string) => labelText([{ code, item: 'x', detail: '', price: '' }], size);
  assert.ok(label('HOUSEHOLD-A-60-90P').includes(',1,0,1,1,"HOUSEHOLD-A-60-90P"'));
  const long = label('HOUSEHOLDX-GRADEA-1234.5-12345P');
  assert.ok(long.includes('QRCODE 16,64,M,3,A,0,"HOUSEHOLDX-GRADEA-1234.5-12345P"'));
  assert.ok(!long.includes('BARCODE'));
});

test('Shared codes: bill lines of one kind at one price read as one row with a quantity', () => {
  const line = (code: string, kindCode: string | null, unitPrice: string, extra = {}) => ({ kind: 'BALE', description: 'Mens jeans', quantity: 1, unitPrice, discount: '0', lineTotal: unitPrice, bale: { code, baleNo: null, kindCode }, ...extra });
  const rows = billRows([
    line('B-00001', 'JEANS-1-45', '40000'),
    line('B-00002', 'JEANS-1-45', '40000'),
    line('B-00003', 'JEANS-1-45', '38000'), // another price: its own row
    line('B-00009', null, '40000'), // a bale from before shared codes
    { kind: 'PIECE', description: 'Tops', quantity: 3, unitPrice: '200', discount: '0', lineTotal: '600', bale: { code: 'B-00004', baleNo: null, kindCode: 'TOPS-A-40' } },
    line('B-00005', 'JEANS-1-45', '40000', { discount: '500', lineTotal: '39500' }),
    { kind: 'ITEM', description: 'Bags', quantity: 2, unitPrice: '50', discount: '0', lineTotal: '100', bale: null },
  ]);
  assert.deepEqual(rows.map((r) => [r.code, r.quantity, r.total]), [['JEANS-1-45', 3, 119500], ['JEANS-1-45', 1, 38000], ['B-00009', 1, 40000], ['TOPS-A-40', 3, 600], ['', 2, 100]]);
  assert.equal(rows[0].discount, 500);
  assert.deepEqual(rows[0].lines.map((l) => l.bale?.code), ['B-00001', 'B-00002', 'B-00005']); // the bales behind the row
});
