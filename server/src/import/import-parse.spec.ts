import { StockUnit } from '@prisma/client';
import { matchHeaders, parseAmount, parseCsv, parseUnit, rowKeys } from './import-parse';

describe('register import parsing (v2 6.1)', () => {
  it.each([
    ['Rs 1,25,000', '125000.00'],
    ['Rs. 125000/-', '125000.00'],
    ['1,25,000=', '125000.00'],
    ['PKR 2,500.50', '2500.50'],
    ['1.25 lakh', '125000.00'],
    ['2 لاکھ', '200000.00'],
    ['۱۲۵۰۰۰ روپے', '125000.00'],
    ['15k', '15000.00'],
    ['-5,000', '-5000.00'],
    ['(5,000)', '-5000.00'],
    ['5000 advance', '-5000.00'],
    ['ایڈوانس 3000', '-3000.00'],
    [125000, '125000.00'],
    [1234.567, '1234.57'],
    ['0', '0.00'],
  ])('reads the amount %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', '  ', '-', '—'])('treats %p as no amount', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it.each(['abc', '12-34', 'Rs one lakh', '1.2.3'])('says %p is not an amount', (input) => {
    expect(() => parseAmount(input)).toThrow(/is not an amount/);
  });

  it.each([
    ['bale', StockUnit.BALE],
    ['Bales', StockUnit.BALE],
    ['گانٹھ', StockUnit.BALE],
    ['KG', StockUnit.KG],
    ['kilo', StockUnit.KG],
    ['کلو', StockUnit.KG],
    ['pcs', StockUnit.PIECE],
    ['Pc.', StockUnit.PIECE],
    ['عدد', StockUnit.PIECE],
  ])('reads the unit %p', (input, expected) => {
    expect(parseUnit(input)).toBe(expected);
  });

  it('says what to write when the unit is unknown', () => {
    expect(() => parseUnit('box')).toThrow('"box" is not a unit: write bale, kg or piece');
  });

  it('matches headers in English, Urdu, both, or the words people use', () => {
    const { map, missing } = matchHeaders('CUSTOMERS', ['Name * / نام', 'موبائل', 'Shehar', 'Baqaya', 'Something else']);
    expect([...map.entries()]).toEqual([[0, 'name'], [1, 'phone'], [2, 'city'], [3, 'openingBalance']]);
    expect(missing).toEqual([]);
    expect(matchHeaders('CUSTOMERS', ['City', 'Phone']).missing.map((c) => c.key)).toEqual(['name']);
    expect([...matchHeaders('STOCK', ['مال', 'اکائی', 'تعداد', 'لاگت']).map.values()]).toEqual(['item', 'unit', 'quantity', 'totalCost']);
  });

  it('reads CSV with quotes, commas and new lines inside quotes, and semicolon files', () => {
    expect(parseCsv('Name,Udhaar\r\n"Rafiq, Haji","1,25,000"\r\n"Said ""Bhai""",500\n')).toEqual([
      ['Name', 'Udhaar'],
      ['Rafiq, Haji', '1,25,000'],
      ['Said "Bhai"', '500'],
    ]);
    expect(parseCsv('Name;Phone\nAli;0300')).toEqual([['Name', 'Phone'], ['Ali', '0300']]);
  });

  it('gives the same row the same key, and a repeated row its own key', () => {
    const a = { name: 'Ali', openingBalance: '10.00' };
    const [k1, k2, k3] = rowKeys('CUSTOMERS', [a, { openingBalance: '10.00', name: 'Ali' }, { name: 'Bilal' }]);
    expect(k1).not.toBe(k2); // identical rows: first and second occurrence
    expect(k1.split('#')[0]).toBe(k2.split('#')[0]);
    expect(rowKeys('CUSTOMERS', [a])[0]).toBe(k1);
    expect(rowKeys('SUPPLIERS', [a])[0]).not.toBe(k1);
    expect(k3).toMatch(/#1$/);
  });
});
