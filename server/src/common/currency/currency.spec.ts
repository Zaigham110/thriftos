import { getCurrencyMeta, isSupportedCurrencyCode } from './currency';

describe('currency', () => {
  it('knows PKR', () => {
    expect(isSupportedCurrencyCode('PKR')).toBe(true);
    expect(getCurrencyMeta('PKR')).toEqual({ code: 'PKR', symbol: '₨', decimalPlaces: 2 });
  });

  it('falls back to USD for unknown codes', () => {
    expect(isSupportedCurrencyCode('XYZ')).toBe(false);
    expect(getCurrencyMeta('XYZ').code).toBe('USD');
  });
});
