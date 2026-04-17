export type CurrencyMeta = {
  code: string;
  symbol: string;
  decimalPlaces: number;
};

export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', decimalPlaces: 2 },
  PKR: { code: 'PKR', symbol: '₨', decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', decimalPlaces: 2 },
  GBP: { code: 'GBP', symbol: '£', decimalPlaces: 2 },
  CAD: { code: 'CAD', symbol: '$', decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: '$', decimalPlaces: 2 },
  NGN: { code: 'NGN', symbol: '₦', decimalPlaces: 2 },
  KES: { code: 'KES', symbol: 'KSh', decimalPlaces: 2 },
  ZAR: { code: 'ZAR', symbol: 'R', decimalPlaces: 2 },
} as const satisfies Record<string, CurrencyMeta>;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export const SUPPORTED_CURRENCY_CODES = Object.keys(
  SUPPORTED_CURRENCIES,
) as CurrencyCode[];

export function isSupportedCurrencyCode(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCY_CODES as string[]).includes(code);
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  if (!isSupportedCurrencyCode(code)) {
    return SUPPORTED_CURRENCIES.USD;
  }
  return SUPPORTED_CURRENCIES[code];
}
