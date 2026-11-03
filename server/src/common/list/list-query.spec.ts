import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListField, condition, localDayStart } from './list-engine';
import { parseListQuery } from './list-query';

describe('list query', () => {
  it('reads page, size, sort, filters, search and group-by', () => {
    const q = parseListQuery({ page: '2', pageSize: '50', sort: 'date:desc,customer', f: ['status:in:PAID|ISSUED', 'total:between:100..500', 'city:isnull', 'note:contains:a:b'], q: ' rafiq ', groupBy: 'status' });
    expect(q).toEqual({
      page: 2,
      pageSize: 50,
      sort: [{ field: 'date', dir: 'desc' }, { field: 'customer', dir: 'asc' }],
      filters: [
        { field: 'status', op: 'in', values: ['PAID', 'ISSUED'] },
        { field: 'total', op: 'between', values: ['100', '500'] },
        { field: 'city', op: 'isnull', values: [] },
        { field: 'note', op: 'contains', values: ['a:b'] },
      ],
      q: 'rafiq',
      groupBy: 'status',
    });
    expect(parseListQuery({})).toEqual({ page: 1, pageSize: 25, sort: [], filters: [], q: '', groupBy: null });
  });

  it('refuses malformed input', () => {
    for (const raw of [{ pageSize: '201' }, { page: '0' }, { page: 'x' }, { sort: 'date:up' }, { f: 'status' }, { f: 'status:eq' }, { f: 'total:between:5' }, { q: 'x'.repeat(101) }]) {
      expect(() => parseListQuery(raw)).toThrow(BadRequestException);
    }
    expect(() => parseListQuery({ f: Array.from({ length: 21 }, () => 'a:eq:b') })).toThrow(BadRequestException);
  });
});

describe('list filter conditions', () => {
  const num: ListField = { key: 'total', type: 'number', path: ['totalAmount'], filterable: true };
  const date: ListField = { key: 'date', type: 'date', path: ['createdAt'], filterable: true };
  const status: ListField = { key: 'status', type: 'enum', path: ['status'], enumValues: ['PAID', 'ISSUED'], filterable: true };
  const name: ListField = { key: 'customer', type: 'string', path: ['customer', 'name'], filterable: true };

  it('numbers are exact decimals; enums and operators are checked', () => {
    expect(condition(num, { field: 'total', op: 'gte', values: ['1000.50'] })).toEqual({ gte: new Prisma.Decimal('1000.50') });
    expect(() => condition(num, { field: 'total', op: 'eq', values: ['1e5'] })).toThrow(BadRequestException);
    expect(() => condition(num, { field: 'total', op: 'contains', values: ['1'] })).toThrow(BadRequestException);
    expect(condition(status, { field: 'status', op: 'in', values: ['PAID'] })).toEqual({ in: ['PAID'] });
    expect(() => condition(status, { field: 'status', op: 'eq', values: ['GONE'] })).toThrow(BadRequestException);
    expect(condition(name, { field: 'customer', op: 'contains', values: ['raf'] })).toEqual({ contains: 'raf', mode: 'insensitive' });
  });

  it('dates mean whole days in Pakistan time (UTC+5)', () => {
    expect(localDayStart('2026-11-03').toISOString()).toBe('2026-11-02T19:00:00.000Z');
    expect(condition(date, { field: 'date', op: 'eq', values: ['2026-11-03'] })).toEqual({ gte: new Date('2026-11-02T19:00:00Z'), lt: new Date('2026-11-03T19:00:00Z') });
    expect(condition(date, { field: 'date', op: 'lte', values: ['2026-11-03'] })).toEqual({ lt: new Date('2026-11-03T19:00:00Z') });
    expect(condition(date, { field: 'date', op: 'gt', values: ['2026-11-03'] })).toEqual({ gte: new Date('2026-11-03T19:00:00Z') });
    expect(() => condition(date, { field: 'date', op: 'eq', values: ['03/11/2026'] })).toThrow(BadRequestException);
  });
});
