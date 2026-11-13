import { Workbook } from 'exceljs';
import { D, Dec, spread } from '../common/util';
import { baleTemplate, parseCsv, readBaleFile } from './bale-file';

const csv = (text: string) => readBaleFile(Buffer.from(text), 'list.csv');

describe('bale list file', () => {
  it('reads a supplier list with a title row, other header names and typed amounts', async () => {
    const file = await csv(
      [
        'TEXAS RECYCLING - PACKING LIST,,,,,',
        'Bale #,Description,Quality,Net Weight,Pcs,Amount,Retail,Seal',
        'TX-1,"Jeans, mens",A,45.5,120,"Rs 28,000",450,X1',
        ',,,,,,,',
        'TX-2,Ladies tops,B,40,,22000,,X2',
        'Total,,,85.5,,50000,,',
      ].join('\n'),
    );
    expect(file.ignoredHeaders).toEqual(['Seal']);
    expect(file.rows).toHaveLength(2);
    const [a, b] = file.rows;
    expect(a).toMatchObject({ line: 3, baleNo: 'TX-1', item: 'Jeans, mens', grade: 'A', pieces: 120, errors: [] });
    expect(a.weightKg!.toString()).toBe('45.5');
    expect(a.cost!.toString()).toBe('28000');
    expect(a.piecePrice!.toString()).toBe('450');
    expect(b).toMatchObject({ line: 5, baleNo: 'TX-2', pieces: null, salePrice: null });
  });

  it('says what is wrong on each row', async () => {
    const file = await csv('Bale no,Item,Weight kg,Pieces,Cost\nA1,Jeans,abc,1.5,100\nA1,,40,10,x');
    expect(file.rows[0].errors).toEqual(['Weight "abc" is not a number.', 'Pieces must be a whole number.']);
    expect(file.rows[1].errors).toEqual(['Item is missing.', 'Bale no "A1" is also on row 2.', 'Cost "x" is not a number.']);
  });

  it('keeps "Bale sale price" apart from the bale number', async () => {
    const file = await csv('Bale,Item,Bale sale price,Piece price\nB9,Shirts,36000,300');
    expect(file.rows[0]).toMatchObject({ baleNo: 'B9' });
    expect(file.rows[0].salePrice!.toString()).toBe('36000');
    expect(file.rows[0].piecePrice!.toString()).toBe('300');
  });

  it('refuses a file without an Item column, an empty list and other file types', async () => {
    await expect(csv('Weight,Cost\n40,100')).rejects.toMatchObject({ response: { code: 'NO_ITEM_COLUMN' } });
    await expect(csv('Item,Cost\n')).rejects.toMatchObject({ response: { code: 'EMPTY_FILE' } });
    await expect(readBaleFile(Buffer.from('x'), 'list.pdf')).rejects.toMatchObject({ response: { code: 'BAD_FILE' } });
  });

  it('reads Excel, and its own sample file', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('List');
    sheet.addRow(['Bale no', 'Item', 'Weight kg', 'Cost']);
    sheet.addRow(['K-1', 'Jackets', 50, { formula: '100*300', result: 30000 }]);
    const file = await readBaleFile(Buffer.from(await workbook.xlsx.writeBuffer()), 'list.xlsx');
    expect(file.rows[0]).toMatchObject({ baleNo: 'K-1', item: 'Jackets' });
    expect(file.rows[0].cost!.toString()).toBe('30000');

    const sample = await readBaleFile(await baleTemplate(), 'bale-list-sample.xlsx');
    expect(sample.rows).toHaveLength(2);
    expect(sample.rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,"b ""c"", d"\r\ne,f')).toEqual([['a', 'b "c", d'], ['e', 'f']]);
  });
});

describe('sharing a cost between bales', () => {
  const total = (parts: Dec[]) => parts.reduce((a, p) => a.plus(p), new D(0)).toString();

  it('shares by weight and always adds up', () => {
    const shares = spread(new D('1000'), [new D(30), new D(30), new D(30)]);
    expect(shares.map(String)).toEqual(['333.33', '333.33', '333.34']);
    expect(total(shares)).toBe('1000');
    expect(spread(new D('900'), [new D(10), new D(20)]).map(String)).toEqual(['300', '600']);
  });

  it('shares equally when any weight is missing', () => {
    expect(spread(new D('900'), [new D(10), null, new D(50)]).map(String)).toEqual(['300', '300', '300']);
    expect(spread(new D('0'), [null, null]).map(String)).toEqual(['0', '0']);
  });
});
