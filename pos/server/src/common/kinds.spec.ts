import { kindOf } from './kinds';
import { D } from './util';

const kind = (category: string | null, grade: string | null, weightKg: string | null, pieces: number | null, item = 'Item') =>
  kindOf({ item, category, grade, weightKg: weightKg === null ? null : new D(weightKg), pieces });

describe('shared bale codes', () => {
  it('reads as CATEGORY-GRADE-KG, with pieces ending in P', () => {
    expect(kind('Jeans', '1', '45', null).base).toBe('JEANS-1-45');
    expect(kind('Jeans', '1', null, 200).base).toBe('JEANS-1-200P');
    expect(kind('Jeans', '1', '45', 200).base).toBe('JEANS-1-45-200P');
    expect(kind('Jeans', null, '45', null).base).toBe('JEANS-45');
    expect(kind('Jeans', '', '45.00', 0).base).toBe('JEANS-45');
  });

  it('keeps Latin letters and digits, upper case, category to 10 and grade to 6', () => {
    expect(kind('Ladies summer tops', 'Premium+', '40', null).base).toBe('LADIESSUMM-PREMIU-40');
    expect(kind("men's t-shirts", 'a', '30', null).base).toBe('MENSTSHIRT-A-30');
  });

  it('reads "Grade A" as A, and a name with no Latin letters as K', () => {
    expect(kind('Jeans', 'Grade A', '45', null).base).toBe('JEANS-A-45');
    expect(kind('Jeans', 'grade-2', '45', null).base).toBe('JEANS-2-45');
    expect(kind('Jeans', 'Grade', '45', null).base).toBe('JEANS-GRADE-45');
    expect(kind('کپڑے', 'اول', '45', null).base).toBe('K-K-45');
  });

  it('makes two kinds of 45 kg and 45.5 kg, and one kind whatever the capitals', () => {
    expect(kind('Jeans', '1', '45', null).key).not.toBe(kind('Jeans', '1', '45.5', null).key);
    expect(kind('Jeans', '1', '45.5', null).base).toBe('JEANS-1-45.5');
    expect(kind(' JEANS ', 'a', '45', null).key).toBe(kind('jeans', 'A', '45.00', null).key);
    expect(kind('Jeans', 'A', '45', null).key).not.toBe(kind('Jeans', 'Grade A', '45', null).key); // same reading, two kinds
  });

  it('uses the item name when a bale has no category', () => {
    expect(kind(null, null, '45', null, 'Mixed rags').base).toBe('MIXEDRAGS-45');
    expect(kind(null, null, '45', null, 'Mixed rags').key).not.toBe(kind(null, null, '45', null, 'Shoes').key);
    expect(kind(null, 'B', null, null, 'Shoes')).toMatchObject({ base: 'SHOES-B', name: 'Shoes · B' });
  });
});
