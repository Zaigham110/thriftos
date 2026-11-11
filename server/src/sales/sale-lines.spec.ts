import { Decimal } from '@prisma/client/runtime/library';
import { saleTake, SaleLineError } from './sale-lines';

const item = (unit: 'KG' | 'BALE' | 'PIECE', quantity: string, used = '0', weightKg: string | null = null) => ({
  unit,
  quantity: new Decimal(quantity),
  usedQuantity: new Decimal(used),
  weightKg: weightKg === null ? null : new Decimal(weightKg),
});
const take = (...args: Parameters<typeof saleTake>) => {
  const t = saleTake(...args);
  return { unit: t.unit, use: t.use.toString(), kg: t.kg.toString(), pieces: t.pieces };
};
const error = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return [(e as SaleLineError).kind, (e as Error).message];
  }
  return null;
};

describe('saleTake', () => {
  it('sells part of a kg item', () => {
    expect(take(item('KG', '500', '120', '500'), { quantity: '80.5' })).toEqual({ unit: 'KG', use: '80.5', kg: '80.5', pieces: 0 });
  });

  it('sells whole bales, with their share of the weight', () => {
    expect(take(item('BALE', '4', '1', '200'), { quantity: 2 })).toEqual({ unit: 'BALE', use: '2', kg: '100', pieces: 0 });
    expect(take(item('BALE', '3'), { quantity: 1 })).toEqual({ unit: 'BALE', use: '1', kg: '0', pieces: 0 });
  });

  it('sells a bale by kg, in whole bales', () => {
    expect(take(item('BALE', '1', '0', '52.5'), { unit: 'KG', quantity: '52.5' })).toEqual({ unit: 'KG', use: '1', kg: '52.5', pieces: 0 });
    expect(take(item('BALE', '4', '0', '200'), { unit: 'KG', quantity: 100 })).toEqual({ unit: 'KG', use: '2', kg: '100', pieces: 0 });
    expect(error(() => saleTake(item('BALE', '4', '0', '200'), { unit: 'KG', quantity: 70 }))).toEqual(['invalid', 'Sell whole bales by kg: 50 kg each']);
  });

  it('sells pieces', () => {
    expect(take(item('PIECE', '30', '10'), { quantity: 5 })).toEqual({ unit: 'PIECE', use: '5', kg: '0', pieces: 5 });
  });

  it('refuses fractions of bales and pieces, and other units', () => {
    expect(error(() => saleTake(item('PIECE', '30'), { quantity: '1.5' }))).toEqual(['invalid', 'Sell whole pieces']);
    expect(error(() => saleTake(item('BALE', '3'), { quantity: '0.5' }))).toEqual(['invalid', 'Sell whole bales']);
    expect(error(() => saleTake(item('BALE', '3'), { unit: 'KG', quantity: 10 }))).toEqual(['invalid', 'This stock is sold by bales']);
    expect(error(() => saleTake(item('KG', '10', '0', '10'), { unit: 'PIECE', quantity: 1 }))).toEqual(['invalid', 'This stock is sold by kg']);
  });

  it('refuses more than is left', () => {
    expect(error(() => saleTake(item('KG', '500', '450', '500'), { quantity: 60 }))).toEqual(['short', 'Only 50 kg left']);
    expect(error(() => saleTake(item('BALE', '1', '0', '50'), { unit: 'KG', quantity: 100 }))).toEqual(['short', 'Only 1 bales left']);
  });
  it('sells pieces out of bales counted in pieces; the last pieces sell what is left', () => {
    const bale = { ...item('BALE', '2', '0', '90'), pcsCount: 200 };
    expect(take(bale, { unit: 'PIECE', quantity: 30 })).toEqual({ unit: 'PIECE', use: '0.3', kg: '13.5', pieces: 30 });
    const almost = { ...item('BALE', '2', '1.7', '90'), pcsCount: 200 };
    expect(take(almost, { unit: 'PIECE', quantity: 30 })).toEqual({ unit: 'PIECE', use: '0.3', kg: '13.5', pieces: 30 });
    expect(error(() => saleTake(almost, { unit: 'PIECE', quantity: 31 }))).toEqual(['short', 'Only 30 pieces left']);
    expect(error(() => saleTake(bale, { unit: 'PIECE', quantity: '1.5' }))).toEqual(['invalid', 'Sell whole pieces']);
    // A bale without a piece count is not sold by the piece.
    expect(error(() => saleTake(item('BALE', '2', '0', '90'), { unit: 'PIECE', quantity: 1 }))).toEqual(['invalid', 'This stock is sold by bales']);
  });
});
